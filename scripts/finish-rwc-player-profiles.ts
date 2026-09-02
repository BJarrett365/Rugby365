/**
 * Finish Rugby World Cup player rankings + public profiles:
 * club badges, photos, Wikipedia career/bio like Grant Williams.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/finish-rwc-player-profiles.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/finish-rwc-player-profiles.ts --wiki-only
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { players, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { registerWikipediaHeadshotIfMissing } from "../apps/web/src/lib/player-image-service";
import {
  foldRankingClubKey,
  isGarbageRankingClubTeam,
  pickRankingClubCrest,
  usableRankingClubImageUrl,
} from "../apps/web/src/lib/player-ranking-engine";
import { parsePlayerNameAndStatus } from "../apps/web/src/lib/player-career-status";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import {
  fetchWikipediaClubLogos,
  fetchWikipediaPlayerHeadshots,
  fetchWikipediaThumbnails,
  fetchWikidataLogo,
  thumbnailForName,
  wikipediaTitleCandidates,
} from "../apps/web/src/lib/wikipedia-page-image";

const YEARS = [1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023];
const CACHE_ROOT = join(process.cwd(), "docs/scraped/wikipedia/rugby-world-cup-players");
const skipWiki = process.argv.includes("--skip-wiki");
const wikiOnly = process.argv.includes("--wiki-only");
const wikiLimit = Number(process.argv.find((arg) => arg.startsWith("--wiki-limit="))?.split("=")[1] ?? 0);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: T[] }).rows;
  return rows ?? [];
}

async function rwcPlayers() {
  const db = getDb();
  return asRows(await db.execute<{
    id: string;
    name: string;
    slug: string;
    club_name: string | null;
    club_team_id: string | null;
    image_url: string | null;
    wikipedia_url: string | null;
    stints: number;
  }>(sql`
    SELECT DISTINCT p.id, p.name, p.slug, p.club_name, p.club_team_id, p.image_url, p.wikipedia_url,
      (SELECT count(*)::int FROM player_career_stints st WHERE st.player_id = p.id) AS stints
    FROM players p
    JOIN player_match_ratings pmr ON pmr.player_id = p.id
    JOIN competitions c ON c.id = pmr.competition_id
    WHERE c.slug = 'rugby-world-cup'
      AND p.name !~* 'to be announced|^tba$|^tbc$'
    ORDER BY p.name
  `));
}

async function cleanDirtyPlayerNames() {
  const db = getDb();
  const rows = asRows(await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT p.id, p.name
    FROM players p
    JOIN player_match_ratings pmr ON pmr.player_id = p.id
    JOIN competitions c ON c.id = pmr.competition_id
    WHERE c.slug = 'rugby-world-cup'
      AND p.name ~* '\\s+(retired|released)$|\\s*\\((retired|released)\\)\\s*$'
  `));
  let cleaned = 0;
  for (const row of rows) {
    const parsed = parsePlayerNameAndStatus(row.name);
    if (!parsed.name || parsed.name === row.name) continue;
    await db.update(players).set({
      name: parsed.name,
      careerStatus: parsed.statusHint === "released" ? "released" : "retired",
    }).where(eq(players.id, row.id));
    cleaned += 1;
  }
  console.log(`cleaned dirty player names=${cleaned}`);
}

async function copyExistingPhotos() {
  const db = getDb();
  await db.execute(sql`
    UPDATE players SET image_url = badge_image_url
    WHERE (image_url IS NULL OR length(trim(image_url)) = 0)
      AND badge_image_url IS NOT NULL AND length(trim(badge_image_url)) > 0
  `);
  await db.execute(sql`
    UPDATE players p
    SET image_url = g.image_url
    FROM (
      SELECT DISTINCT ON (player_id) player_id, image_url
      FROM player_images
      WHERE archived_at IS NULL AND image_url IS NOT NULL AND status IN ('approved', 'candidate')
      ORDER BY player_id,
        CASE role WHEN 'primary' THEN 0 WHEN 'legend' THEN 1 WHEN 'portrait' THEN 2 ELSE 3 END,
        confidence_score DESC NULLS LAST
    ) g
    WHERE p.id = g.player_id AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
  `);
  await db.execute(sql`
    UPDATE players p
    SET image_url = src.image_url
    FROM (
      SELECT DISTINCT ON (lower(trim(name))) id, name, image_url
      FROM players
      WHERE image_url IS NOT NULL AND length(trim(image_url)) > 0
      ORDER BY lower(trim(name)), id
    ) src
    WHERE p.id <> src.id
      AND lower(trim(p.name)) = lower(trim(src.name))
      AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
  `);
  console.log("copied existing player photos");
}

async function fillClubBadges() {
  const db = getDb();
  const catalog = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, imageUrl: teams.imageUrl })
    .from(teams)
    .where(sql`${teams.slug} not like '%__legacy__%'`);
  const usable = catalog.filter((row) => !isGarbageRankingClubTeam(row.name, row.slug));

  let wiped = 0;
  for (const team of usable) {
    if (!team.imageUrl || usableRankingClubImageUrl(team.imageUrl)) continue;
    await db.update(teams).set({ imageUrl: null }).where(eq(teams.id, team.id));
    team.imageUrl = null;
    wiped += 1;
  }

  const clubRows = asRows(await db.execute<{ club: string }>(sql`
    SELECT DISTINCT coalesce(nullif(p.club_name, ''), ct.name) AS club
    FROM player_match_ratings pmr
    JOIN players p ON p.id = pmr.player_id
    JOIN competitions c ON c.id = pmr.competition_id
    LEFT JOIN teams ct ON ct.id = p.club_team_id
    WHERE c.slug = 'rugby-world-cup'
      AND coalesce(nullif(p.club_name, ''), ct.name) IS NOT NULL
  `));
  let copied = 0;
  let linked = 0;
  const stillMissing: string[] = [];
  for (const row of clubRows) {
    const club = row.club?.trim();
    if (!club || club.startsWith("<")) continue;
    const crest = pickRankingClubCrest(club, usable);
    const goodUrl = usableRankingClubImageUrl(crest?.imageUrl);
    if (!goodUrl) {
      stillMissing.push(club);
      continue;
    }
    const targetKeys = new Set<string>([foldRankingClubKey(club)]);
    const crestTeam = usable.find((team) => team.slug === crest.slug);
    if (crestTeam) targetKeys.add(foldRankingClubKey(crestTeam.name));
    for (const team of usable) {
      if (usableRankingClubImageUrl(team.imageUrl)) continue;
      if (!targetKeys.has(foldRankingClubKey(team.name))) continue;
      await db.update(teams).set({ imageUrl: goodUrl }).where(eq(teams.id, team.id));
      team.imageUrl = goodUrl;
      copied += 1;
    }
  }
  const titles = stillMissing.flatMap((name) => wikipediaTitleCandidates(name, "club"));
  const logos = titles.length ? await fetchWikipediaClubLogos(titles) : new Map<string, string>();
  const thumbs = titles.length ? await fetchWikipediaThumbnails(titles) : new Map<string, string>();
  let fetched = 0;
  const remaining: string[] = [];
  for (const clubName of stillMissing) {
    let url =
      thumbnailForName(logos, clubName, "club") ?? thumbnailForName(thumbs, clubName, "club") ?? null;
    if (url && !usableRankingClubImageUrl(url)) url = null;
    if (!url) {
      for (const title of wikipediaTitleCandidates(clubName, "club")) {
        const logo = await fetchWikidataLogo(title);
        if (logo && usableRankingClubImageUrl(logo)) {
          url = logo;
          break;
        }
      }
    }
    if (!url) {
      remaining.push(clubName);
      continue;
    }
    const existing =
      usable.find((row) => foldRankingClubKey(row.name) === foldRankingClubKey(clubName)) ??
      usable.find((row) => pickRankingClubCrest(clubName, usable)?.slug === row.slug);
    if (existing) {
      if (!usableRankingClubImageUrl(existing.imageUrl)) {
        await db.update(teams).set({ imageUrl: url }).where(eq(teams.id, existing.id));
        existing.imageUrl = url;
        fetched += 1;
      }
      continue;
    }
    const slugBase = clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "club";
    const slug = usable.some((row) => row.slug === slugBase) ? `${slugBase}-rwc` : slugBase;
    const [inserted] = await db
      .insert(teams)
      .values({
        name: clubName,
        slug,
        imageUrl: url,
        sourceProvider: "wikipedia",
        teamType: "club",
      })
      .returning({ id: teams.id });
    usable.push({ id: inserted.id, name: clubName, slug, imageUrl: url });
    fetched += 1;
  }

  const people = await rwcPlayers();
  for (const player of people) {
    const club = player.club_name?.trim();
    if (!club) continue;
    const crest = pickRankingClubCrest(club, usable);
    const goodUrl = usableRankingClubImageUrl(crest?.imageUrl);
    if (player.club_team_id) {
      const own = usable.find((row) => row.id === player.club_team_id);
      const nextUrl = usableRankingClubImageUrl(own?.imageUrl) ?? goodUrl;
      if (own && nextUrl && own.imageUrl !== nextUrl) {
        await db.update(teams).set({ imageUrl: nextUrl }).where(eq(teams.id, own.id));
        own.imageUrl = nextUrl;
      }
      continue;
    }
    const named = usable.find((row) => foldRankingClubKey(row.name) === foldRankingClubKey(club));
    const team = named ?? usable.find((row) => row.slug === crest?.slug);
    if (!team) continue;
    await db.update(players).set({ clubTeamId: team.id }).where(eq(players.id, player.id));
    linked += 1;
  }
  console.log(
    `club badges wiped-bad=${wiped} copied=${copied} fetched=${fetched} players linked=${linked} still-unmatched=${remaining.length}`,
  );
  if (remaining.length) {
    console.log(`  unmatched clubs: ${remaining.slice(0, 25).join(" | ")}${remaining.length > 25 ? "…" : ""}`);
  }
}

function foldPersonKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function copySiblingProfiles() {
  const db = getDb();
  await db.execute(sql`
    UPDATE players p SET
      image_url = COALESCE(NULLIF(btrim(p.image_url), ''), s.image_url),
      bio_summary = COALESCE(NULLIF(btrim(p.bio_summary), ''), s.bio_summary),
      birth_date = COALESCE(p.birth_date, s.birth_date),
      birth_place = COALESCE(p.birth_place, s.birth_place),
      height_cm = COALESCE(p.height_cm, s.height_cm),
      weight_kg = COALESCE(p.weight_kg, s.weight_kg),
      club_name = COALESCE(NULLIF(btrim(p.club_name), ''), s.club_name),
      club_team_id = COALESCE(p.club_team_id, s.club_team_id),
      country_name = COALESCE(p.country_name, s.country_name),
      position_name = COALESCE(p.position_name, s.position_name),
      archive_synced_at = COALESCE(p.archive_synced_at, s.archive_synced_at),
      profile_updated_at = now()
    FROM (
      SELECT DISTINCT ON (lower(trim(name)))
        id, name, image_url, bio_summary, birth_date, birth_place,
        height_cm, weight_kg, club_name, club_team_id, country_name, position_name, archive_synced_at
      FROM players
      WHERE wikipedia_url IS NOT NULL
         OR (bio_summary IS NOT NULL AND length(trim(bio_summary)) > 0)
         OR EXISTS (SELECT 1 FROM player_career_stints st WHERE st.player_id = players.id)
      ORDER BY lower(trim(name)),
        (wikipedia_url IS NOT NULL)::int DESC,
        COALESCE(length(bio_summary), 0) DESC
    ) s
    WHERE p.id <> s.id
      AND lower(trim(p.name)) = lower(trim(s.name))
      AND EXISTS (
        SELECT 1 FROM player_match_ratings pmr
        JOIN competitions c ON c.id = pmr.competition_id
        WHERE pmr.player_id = p.id AND c.slug = 'rugby-world-cup'
      )
  `);
  await db.execute(sql`
    INSERT INTO player_career_stints (
      player_id, career_type, start_year, end_year, years_label, team_name, team_id,
      apps, points, sort_order, source_provider, source_url
    )
    SELECT DISTINCT ON (p.id, src.career_type, src.years_label, src.team_name)
      p.id, src.career_type, src.start_year, src.end_year, src.years_label, src.team_name, src.team_id,
      src.apps, src.points, src.sort_order, src.source_provider, src.source_url
    FROM players p
    JOIN players s ON s.id <> p.id AND lower(trim(s.name)) = lower(trim(p.name))
    JOIN player_career_stints src ON src.player_id = s.id
    WHERE EXISTS (
      SELECT 1 FROM player_match_ratings pmr
      JOIN competitions c ON c.id = pmr.competition_id
      WHERE pmr.player_id = p.id AND c.slug = 'rugby-world-cup'
    )
      AND NOT EXISTS (SELECT 1 FROM player_career_stints mine WHERE mine.player_id = p.id)
      AND EXISTS (SELECT 1 FROM player_career_stints rich WHERE rich.player_id = s.id)
    ORDER BY p.id, src.career_type, src.years_label, src.team_name, src.sort_order
    ON CONFLICT DO NOTHING
  `);
  console.log("copied sibling profile fields and career stints onto RWC player rows");
}

function loadWikiUrlsByName(): Map<string, string> {
  const map = new Map<string, string>();
  for (const year of YEARS) {
    const path = join(CACHE_ROOT, String(year), "category-members.json");
    if (!existsSync(path)) continue;
    const cache = JSON.parse(readFileSync(path, "utf8")) as {
      members: Array<{ name: string; title: string; url: string }>;
    };
    for (const member of cache.members) {
      const exact = member.name.trim().toLowerCase();
      const folded = foldPersonKey(member.name);
      if (!map.has(exact)) map.set(exact, member.url);
      if (folded && !map.has(folded)) map.set(folded, member.url);
    }
  }
  return map;
}

async function enrichWikipediaProfiles() {
  if (skipWiki) {
    console.log("skip wikipedia profile enrich");
    return;
  }
  const wikiUrls = loadWikiUrlsByName();
  const people = await rwcPlayers();
  const todo = people.filter((row) => row.stints < 1 || !row.wikipedia_url);
  const batch = wikiLimit > 0 ? todo.slice(0, wikiLimit) : todo;
  console.error(`wikipedia profiles to fill=${batch.length}/${todo.length}`);
  let enriched = 0;
  let failed = 0;
  let cursor = 0;
  const workers = 1;
  async function worker() {
    while (cursor < batch.length) {
      const index = cursor;
      cursor += 1;
      const row = batch[index];
      const parsed = parsePlayerNameAndStatus(row.name);
      const sourceUrl =
        wikiUrls.get(row.name.trim().toLowerCase()) ??
        wikiUrls.get(foldPersonKey(row.name)) ??
        wikiUrls.get(parsed.name.trim().toLowerCase()) ??
        wikiUrls.get(foldPersonKey(parsed.name)) ??
        row.wikipedia_url ??
        undefined;
      try {
        const result = await withTimeout(
          enrichPlayerFromWikipedia(row.id, parsed.name || row.name, {
            fillMissingOnly: true,
            upsertCareer: row.stints < 1,
            sourceUrl,
          }),
          40000,
          parsed.name || row.name,
        );
        if (result.enriched || (result.fieldsUpdated?.length ?? 0) > 0 || (result.careerStints ?? 0) > 0) {
          enriched += 1;
        } else {
          failed += 1;
          if (result.reason) {
            console.error(`  miss ${row.name}: ${result.reason}`);
          }
        }
      } catch (error) {
        failed += 1;
        console.error(`  miss ${row.name}: ${error instanceof Error ? error.message : "error"}`);
      }
      if ((index + 1) % 10 === 0 || index + 1 === batch.length) {
        console.error(`  wikipedia ${index + 1}/${batch.length} enriched=${enriched} failed=${failed}`);
      }
      await sleep(80);
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));
}

async function fillMissingPhotos() {
  const people = (await rwcPlayers()).filter((row) => !row.image_url);
  console.log(`players still missing photos=${people.length}`);
  if (!people.length) return;
  const titles = people.flatMap((row) => [
    row.name,
    `${row.name} (rugby union)`,
    `${row.name} (rugby)`,
  ]);
  const thumbs = await fetchWikipediaThumbnails(titles);
  const extras = await fetchWikipediaPlayerHeadshots(
    people.slice(0, 40).map((row) => ({ name: row.name })),
  );
  let attached = 0;
  for (const row of people) {
    const url =
      extras.get(row.name) ??
      thumbs.get(row.name) ??
      thumbs.get(`${row.name} (rugby union)`) ??
      thumbs.get(`${row.name} (rugby)`) ??
      thumbnailForName(thumbs, row.name, "player");
    if (!url) continue;
    const ok = await registerWikipediaHeadshotIfMissing(row.id, url, row.name);
    if (ok) attached += 1;
  }
  console.log(`wikipedia photos attached=${attached}`);
}

async function reportCoverage() {
  const db = getDb();
  const rows = asRows(await db.execute<{
    year: number;
    players: number;
    photos: number;
    club: number;
    crest: number;
    wiki: number;
    bio: number;
    dob: number;
    stints: number;
  }>(sql`
    SELECT cs.year,
      count(DISTINCT p.id)::int AS players,
      count(DISTINCT p.id) FILTER (WHERE p.image_url IS NOT NULL AND length(trim(p.image_url)) > 0)::int AS photos,
      count(DISTINCT p.id) FILTER (WHERE coalesce(nullif(p.club_name, ''), ct.name) IS NOT NULL)::int AS club,
      count(DISTINCT p.id) FILTER (
        WHERE ct.image_url IS NOT NULL
          AND length(trim(ct.image_url)) > 0
          AND ct.image_url NOT ILIKE '%wiktionary%'
      )::int AS crest,
      count(DISTINCT p.id) FILTER (WHERE p.wikipedia_url IS NOT NULL)::int AS wiki,
      count(DISTINCT p.id) FILTER (WHERE p.bio_summary IS NOT NULL AND length(trim(p.bio_summary)) > 0)::int AS bio,
      count(DISTINCT p.id) FILTER (WHERE p.birth_date IS NOT NULL)::int AS dob,
      count(DISTINCT p.id) FILTER (
        WHERE EXISTS (SELECT 1 FROM player_career_stints st WHERE st.player_id = p.id)
      )::int AS stints
    FROM players p
    JOIN player_match_ratings pmr ON pmr.player_id = p.id
    JOIN competitions c ON c.id = pmr.competition_id
    LEFT JOIN competition_seasons cs ON cs.id = pmr.season_id
    LEFT JOIN teams ct ON ct.id = p.club_team_id
    WHERE c.slug = 'rugby-world-cup'
      AND p.name !~* 'to be announced|^tba$|^tbc$'
      AND cs.year IS NOT NULL
    GROUP BY cs.year
    ORDER BY cs.year
  `));
  console.log("coverage year players photos club crest wiki bio dob stints");
  for (const row of rows) {
    console.log(
      `  ${row.year} ${row.players} ${row.photos} ${row.club} ${row.crest} ${row.wiki} ${row.bio} ${row.dob} ${row.stints}`,
    );
  }
}

async function main() {
  if (!wikiOnly) {
    await cleanDirtyPlayerNames();
    await copyExistingPhotos();
    await fillClubBadges();
  }
  await copySiblingProfiles();
  await enrichWikipediaProfiles();
  if (!skipWiki) {
    await copyExistingPhotos();
    await fillMissingPhotos();
  }
  await reportCoverage();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
