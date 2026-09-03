/**
 * Roll the Grant Williams public-player template onto other players:
 * same profile/stats/career/intelligence pipeline, each player's own data.
 *
 * Uses Wikipedia, RugbyPass, Ultimate Rugby, and Rugby Data (iPublisher
 * rugby-union) feeds. Does not copy Grant Williams' numbers.
 *
 * Phase 1: Rugby World Cup squads (1987–present).
 * Phase 2: every remaining public player.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/hydrate-player-public-profiles.ts --player=thibaud-flament-g9nq5r9l__legacy__20ac01b2
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/hydrate-player-public-profiles.ts --phase=rwc
 */
import { and, eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { hydratePlayerGoldStandard } from "../apps/web/src/lib/hydrate-player-gold-standard-service";
import { getPublicPlayerRankingsBoard } from "../apps/web/src/lib/public-player-rankings-product-service";

const TEMPLATE_SLUG = "grant-williams";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function argValue(flag: string): string | null {
  const hit = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] }).rows;
  return rows ?? [];
}

type PlayerRow = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  wikipediaUrl: string | null;
  countryName: string | null;
  internationalTeamId: string | null;
  birthDate: string | null;
  heightCm: number | null;
};

async function printTemplate(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      wikipediaUrl: players.wikipediaUrl,
      bioSummary: players.bioSummary,
      countryName: players.countryName,
      clubName: players.clubName,
      positionName: players.positionName,
    })
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);
  if (!row) {
    console.log(`template ${slug} not found`);
    return;
  }
  const [counts] = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM player_career_stints WHERE player_id = ${row.id}) AS stints,
      (SELECT count(*)::int FROM player_match_ratings WHERE player_id = ${row.id}) AS match_ratings,
      (SELECT count(*)::int FROM player_ratings WHERE player_id = ${row.id}) AS ratings,
      (SELECT count(*)::int FROM player_value_history WHERE player_id = ${row.id}) AS value_hist,
      (SELECT count(*)::int FROM player_titles WHERE player_id = ${row.id}) AS titles
  `);
  console.log("template", row.name, row.slug, {
    image: Boolean(row.imageUrl),
    wiki: Boolean(row.wikipediaUrl),
    bio: Boolean(row.bioSummary),
    country: row.countryName,
    club: row.clubName,
    position: row.positionName,
    ...(counts as object),
  });
}

async function loadRwcPlayers(): Promise<PlayerRow[]> {
  const db = getDb();
  const rows = asRows<{
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    image_url?: string | null;
    wikipediaUrl?: string | null;
    wikipedia_url?: string | null;
    countryName?: string | null;
    country_name?: string | null;
    internationalTeamId?: string | null;
    international_team_id?: string | null;
    birthDate?: string | Date | null;
    birth_date?: string | Date | null;
    heightCm?: number | null;
    height_cm?: number | null;
  }>(
    await db.execute(sql`
      SELECT DISTINCT p.id, p.name, p.slug, p.image_url, p.wikipedia_url,
        p.country_name, p.international_team_id, p.birth_date, p.height_cm
      FROM players p
      WHERE p.name !~* 'to be announced|^tba$|^tbc$|^[-_.\\s]+$'
        AND (
          EXISTS (
            SELECT 1
            FROM fixture_players fp
            JOIN fixtures f ON f.id = fp.fixture_id
            JOIN competitions c ON c.id = f.competition_id
            WHERE fp.player_id = p.id
              AND (c.slug = 'rugby-world-cup' OR c.name ILIKE '%world cup%')
          )
          OR EXISTS (
            SELECT 1
            FROM player_match_ratings pmr
            JOIN competitions c ON c.id = pmr.competition_id
            WHERE pmr.player_id = p.id
              AND (c.slug = 'rugby-world-cup' OR c.name ILIKE '%world cup%')
          )
        )
      ORDER BY p.name
    `),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.imageUrl ?? row.image_url ?? null,
    wikipediaUrl: row.wikipediaUrl ?? row.wikipedia_url ?? null,
    countryName: row.countryName ?? row.country_name ?? null,
    internationalTeamId: row.internationalTeamId ?? row.international_team_id ?? null,
    birthDate: row.birthDate
      ? String(row.birthDate).slice(0, 10)
      : row.birth_date
        ? String(row.birth_date).slice(0, 10)
        : null,
    heightCm: row.heightCm ?? row.height_cm ?? null,
  }));
}

async function loadAllPublicPlayers(excludeIds: Set<string>): Promise<PlayerRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      wikipediaUrl: players.wikipediaUrl,
      countryName: players.countryName,
      internationalTeamId: players.internationalTeamId,
      birthDate: players.birthDate,
      heightCm: players.heightCm,
    })
    .from(players)
    .where(and(eq(players.isPublic, true)));
  return rows
    .filter((row) => !excludeIds.has(row.id) && !/to be announced|^tba$|^tbc$/i.test(row.name))
    .map((row) => ({
      ...row,
      birthDate: row.birthDate ? String(row.birthDate).slice(0, 10) : null,
    }));
}

let wikiCooldownUntil = 0;

function wikiCoolingDown() {
  return Date.now() < wikiCooldownUntil;
}

async function hydratePlayer(row: PlayerRow, opts: { includeUr: boolean; skipWiki: boolean }) {
  const notes = await hydratePlayerGoldStandard(row.id, {
    includeUr: opts.includeUr,
    includeRugbyData: Boolean(argValue("--player")) || hasFlag("--include-rd"),
    rugbyDataClubSweep: hasFlag("--rugby-data-club"),
    skipWiki: opts.skipWiki || wikiCoolingDown(),
  });
  if (notes.some((note) => /rate_limited|429/i.test(note))) {
    wikiCooldownUntil = Date.now() + 90_000;
  }
  return notes;
}

async function runPhase(
  label: string,
  rows: PlayerRow[],
  opts: { includeUr: boolean; skipWiki: boolean; limit: number | null; delayMs: number },
) {
  const ranked = [...rows].sort((a, b) => {
    const gap = (row: PlayerRow) =>
      (row.birthDate ? 0 : 4) +
      (row.heightCm != null && row.heightCm > 0 ? 0 : 2) +
      (row.wikipediaUrl ? 0 : 1);
    const diff = gap(b) - gap(a);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
  const subset = opts.limit != null ? ranked.slice(0, opts.limit) : ranked;
  console.log(`\n${label}: ${subset.length} / ${ranked.length} players`);
  let ok = 0;
  let failed = 0;
  for (const [index, row] of subset.entries()) {
    process.stdout.write(`  [${index + 1}/${subset.length}] ${row.name}… `);
    try {
      const notes = await hydratePlayer(row, { includeUr: opts.includeUr, skipWiki: opts.skipWiki });
      console.log(notes.join(","));
      ok += 1;
    } catch (error) {
      failed += 1;
      console.log("FAILED", error instanceof Error ? error.message : error);
    }
    await sleep(opts.delayMs);
  }
  console.log(`${label} done ok=${ok} failed=${failed}`);
  return subset.map((row) => row.id);
}

async function rebuildBoards() {
  console.log("\nRebuild player ranking boards");
  for (const mode of ["current", "alltime"] as const) {
    try {
      const board = await getPublicPlayerRankingsBoard({ mode, top: 50, forceRebuild: true });
      console.log(`  ${mode} rows=${board.rows.length} status=${board.status}`);
    } catch (error) {
      console.log(`  ${mode} FAILED`, error instanceof Error ? error.message : error);
    }
  }
}

async function main() {
  const phase = (argValue("--phase") ?? "both").toLowerCase();
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : null;
  const delayMs = Number(argValue("--delay-ms") ?? "1600");
  const skipUr = hasFlag("--skip-ur");
  const skipWiki = hasFlag("--skip-wiki");

  console.log("Grant Williams template (do not copy these numbers onto other players)");
  await printTemplate(TEMPLATE_SLUG);

  const onlySlug = argValue("--player");
  if (onlySlug) {
    const db = getDb();
    const [row] = await db
      .select({
        id: players.id,
        name: players.name,
        slug: players.slug,
        imageUrl: players.imageUrl,
        wikipediaUrl: players.wikipediaUrl,
        countryName: players.countryName,
        internationalTeamId: players.internationalTeamId,
        birthDate: players.birthDate,
        heightCm: players.heightCm,
      })
      .from(players)
      .where(eq(players.slug, onlySlug))
      .limit(1);
    if (!row) {
      throw new Error(`Player not found: ${onlySlug}`);
    }
    process.stdout.write(`  [1/1] ${row.name}… `);
    const notes = await hydratePlayer(
      {
        ...row,
        birthDate: row.birthDate ? String(row.birthDate).slice(0, 10) : null,
      },
      { includeUr: !skipUr, skipWiki },
    );
    console.log(notes.join(","));
    console.log("\nDone.");
    return;
  }

  const processed = new Set<string>();
  if (phase === "rwc" || phase === "both") {
    const rwc = await loadRwcPlayers();
    console.log(`RWC player pool ${rwc.length}`);
    const ids = await runPhase("RWC", rwc, {
      includeUr: !skipUr,
      skipWiki,
      limit,
      delayMs,
    });
    ids.forEach((id) => processed.add(id));
    await rebuildBoards();
  }

  if (phase === "all" || phase === "both") {
    const rest = await loadAllPublicPlayers(processed);
    await runPhase("ALL", rest, {
      includeUr: false,
      skipWiki,
      limit,
      delayMs,
    });
    await rebuildBoards();
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
