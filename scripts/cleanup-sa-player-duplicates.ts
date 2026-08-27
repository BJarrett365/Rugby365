/**
 * Clean up South Africa player duplicates + junk entity rows, then scrape
 * Alamy images for any still-missing SA profiles.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-sa-player-duplicates.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-sa-player-duplicates.ts --dry-run
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/cleanup-sa-player-duplicates.ts --skip-images
 */
import { writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { createDb, players } from "@rugby365/db";
import { mergePlayerRecords } from "../apps/web/src/lib/entity-dedup-service";
import { normalizePlayerName } from "../apps/web/src/lib/entity-normalize";
import { alamyStockPhotoSearchUrl } from "../apps/web/src/lib/alamy-image-utils";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const dryRun = process.argv.includes("--dry-run");
const skipImages = process.argv.includes("--skip-images");

type PlayerRow = {
  id: string;
  name: string;
  slug: string;
  international_team_id: string | null;
  club_team_id: string | null;
  image_url: string | null;
  fixtures: number;
  transfers: number;
  stints: number;
  images: number;
  source_provider: string | null;
  external_provider_id: string | null;
};

function isJunkPlayerName(name: string): boolean {
  const n = name.trim();
  if (/\((rugby union|sports|disambiguation)\)/i.test(n)) return true;
  if (/^(captain|coach|referee|stadium|union)$/i.test(n)) return true;
  if (/\b(released|retired|left|departed|joined|signed|loaned)\b/i.test(n) && n.split(/\s+/).length <= 4) {
    // e.g. "CJ van der Linde to"
    if (/\bto$/i.test(n) || /\bfrom$/i.test(n)) return true;
  }
  if (/\bto$/i.test(n) && n.split(/\s+/).length <= 5) return true;
  return false;
}

function scoreCanonical(p: PlayerRow): number {
  let score = 0;
  score += p.fixtures * 10;
  score += p.transfers * 4;
  score += p.stints * 3;
  score += p.images * 2;
  if (p.image_url) score += 5;
  if (p.international_team_id === SA_ID) score += 8;
  if (p.external_provider_id) score += 6;
  if (p.source_provider === "sdms" || p.source_provider === "sport365") score += 4;
  if (p.slug.includes("__legacy__")) score -= 40;
  if (isJunkPlayerName(p.name)) score -= 100;
  // Prefer real club over South Africa as club_team_id
  if (p.club_team_id && p.club_team_id !== SA_ID) score += 3;
  if (p.club_team_id === SA_ID) score -= 2;
  return score;
}

const FOCUS_NAMES = [
  "Asenathi Ntlabakanye",
  "Boan Venter",
  "Cameron Hanekom",
  "Celimpilo Gumede",
  "Chad Solomon",
  "Cheslin Kolbe",
  "Christiaan Scholtz",
  "Christie Grobbelaar",
  "Christopher William Smith",
  "CJ Van der Linde",
  "Dale Santon",
  "Danie Rossouw",
  "Dylan Sjoblom",
];

async function loadSaLinkedPlayers() {
  const db = createDb();
  const rows = await db.execute(sql`
    select
      p.id,
      p.name,
      p.slug,
      p.international_team_id,
      p.club_team_id,
      p.image_url,
      p.source_provider,
      p.external_provider_id,
      (select count(*)::int from fixture_players fp where fp.player_id = p.id) as fixtures,
      (select count(*)::int from player_transfers t where t.player_id = p.id) as transfers,
      (select count(*)::int from player_career_stints cs where cs.player_id = p.id) as stints,
      (select count(*)::int from player_images pi where pi.player_id = p.id) as images
    from players p
    where p.international_team_id = ${SA_ID}
       or p.club_team_id = ${SA_ID}
       or exists (
         select 1 from players p2
         where lower(p2.name) = lower(p.name)
           and (p2.international_team_id = ${SA_ID} or p2.club_team_id = ${SA_ID})
       )
    order by p.name
  `);
  const byId = new Map<string, PlayerRow>();
  for (const row of rows as unknown as PlayerRow[]) byId.set(row.id, row);

  // Ensure named focus players are included even if not SA-tagged
  for (const name of FOCUS_NAMES) {
    const extra = await db.execute(sql`
      select
        p.id,
        p.name,
        p.slug,
        p.international_team_id,
        p.club_team_id,
        p.image_url,
        p.source_provider,
        p.external_provider_id,
        (select count(*)::int from fixture_players fp where fp.player_id = p.id) as fixtures,
        (select count(*)::int from player_transfers t where t.player_id = p.id) as transfers,
        (select count(*)::int from player_career_stints cs where cs.player_id = p.id) as stints,
        (select count(*)::int from player_images pi where pi.player_id = p.id) as images
      from players p
      where lower(p.name) = lower(${name})
    `);
    for (const row of extra as unknown as PlayerRow[]) byId.set(row.id, row);
  }

  return [...byId.values()];
}

async function deleteJunkPlayers() {
  const db = createDb();
  const junk = await db.execute(sql`
    select id, name, slug,
      (select count(*)::int from fixture_players fp where fp.player_id = players.id) as fixtures,
      (select count(*)::int from player_transfers t where t.player_id = players.id) as transfers
    from players
    where name ~* '\\((rugby union|sports|disambiguation)\\)'
       or name ~* '^(captain|coach|referee)$'
       or name ~* '\\bto$'
       or slug in ('bulls-rugby-union', 'captain-sports', 'cj-van-der-linde-to')
  `);
  const list = junk as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    fixtures: number;
    transfers: number;
  }>;

  let deleted = 0;
  for (const row of list) {
    if (row.fixtures > 0 || row.transfers > 0) {
      console.log(`skip junk (has data): ${row.name} fixtures=${row.fixtures} transfers=${row.transfers}`);
      continue;
    }
    console.log(`${dryRun ? "would delete" : "delete"} junk: ${row.name} (${row.slug})`);
    if (!dryRun) {
      await db.delete(players).where(eq(players.id, row.id));
    }
    deleted += 1;
  }
  return { found: list.length, deleted };
}

async function fixSaAsClub() {
  const db = createDb();
  // South Africa international team should not be stored as club_team_id
  const rows = await db.execute(sql`
    select id, name, international_team_id
    from players
    where club_team_id = ${SA_ID}
  `);
  const list = rows as unknown as Array<{
    id: string;
    name: string;
    international_team_id: string | null;
  }>;
  console.log(`Players with SA as club_team_id: ${list.length}`);
  if (!dryRun) {
    for (const row of list) {
      await db
        .update(players)
        .set({
          clubTeamId: null,
          internationalTeamId: row.international_team_id ?? SA_ID,
          updatedAt: new Date(),
        })
        .where(eq(players.id, row.id));
    }
  }
  return list.length;
}

async function mergeSaDuplicates(all: PlayerRow[]) {
  const byKey = new Map<string, PlayerRow[]>();
  for (const p of all) {
    const key = normalizePlayerName(p.name) || p.name.toLowerCase();
    if (!key) continue;
    const arr = byKey.get(key) ?? [];
    arr.push(p);
    byKey.set(key, arr);
  }

  let groups = 0;
  let removed = 0;
  const details: Array<{ name: string; keep: string; drop: string[] }> = [];

  for (const [, rows] of byKey) {
    // Merge when SA-linked OR name is in the focus cleanup list
    const keyNorm = normalizePlayerName(rows[0]!.name);
    const focus = FOCUS_NAMES.some((n) => normalizePlayerName(n) === keyNorm);
    const saLinked = rows.some((r) => r.international_team_id === SA_ID || r.club_team_id === SA_ID);
    if ((!saLinked && !focus) || rows.length < 2) continue;

    const ranked = [...rows].sort((a, b) => scoreCanonical(b) - scoreCanonical(a));
    const canonical = ranked[0]!;
    const duplicates = ranked.slice(1);
    groups += 1;
    details.push({
      name: canonical.name,
      keep: `${canonical.slug} (${canonical.id.slice(0, 8)}) fixtures=${canonical.fixtures}`,
      drop: duplicates.map((d) => `${d.slug} fixtures=${d.fixtures}`),
    });
    console.log(
      `${dryRun ? "would merge" : "merge"} ${canonical.name}: keep ${canonical.slug} ← ${duplicates.length} dupes`,
    );
    if (!dryRun) {
      await mergePlayerRecords(
        canonical.id,
        duplicates.map((d) => d.id),
        { displayName: canonical.name.replace(/\s+/g, " ").trim() },
      );
      const db = createDb();
      const [fresh] = await db.select().from(players).where(eq(players.id, canonical.id)).limit(1);
      const hadSaIntl =
        canonical.international_team_id === SA_ID ||
        duplicates.some((d) => d.international_team_id === SA_ID);
      const patch: Partial<typeof players.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (fresh?.clubTeamId === SA_ID) patch.clubTeamId = null;
      if (hadSaIntl) patch.internationalTeamId = SA_ID;

      // Prefer a clean non-legacy slug when available
      if (fresh?.slug.includes("__legacy__")) {
        const base = fresh.slug.split("__legacy__")[0]!;
        const [taken] = await db
          .select({ id: players.id })
          .from(players)
          .where(eq(players.slug, base))
          .limit(1);
        if (!taken) patch.slug = base;
      }
      // Avoid empty SET (Postgres syntax error) when nothing needs patching
      if (Object.keys(patch).length > 1) {
        await db.update(players).set(patch).where(eq(players.id, canonical.id));
      }
    }
    removed += duplicates.length;
  }

  return { groups, removed, details };
}

async function scrapeMissingImages() {
  const db = createDb();
  const rows = await db.execute(sql`
    select distinct on (lower(name)) id, name
    from players
    where (international_team_id = ${SA_ID} or club_team_id = ${SA_ID})
      and coalesce(image_url, '') = ''
      and slug not like '%__legacy__%'
    order by lower(name), name
    limit 80
  `);
  const list = (rows as any[]).map((p) => ({
    playerId: p.id,
    playerName: p.name,
    searchUrl: alamyStockPhotoSearchUrl(`${p.name} rugby`),
  }));
  writeFileSync("/tmp/alamy-search-sa-after-dedupe.json", JSON.stringify(list, null, 2));
  console.log(`Missing SA images after dedupe: ${list.length}`);
  return list.length;
}

async function main() {
  console.log(dryRun ? "DRY RUN\n" : "APPLYING SA PLAYER CLEANUP\n");

  const junk = await deleteJunkPlayers();
  console.log(`Junk: found=${junk.found} deleted=${junk.deleted}`);

  const saAsClub = await fixSaAsClub();
  console.log(`Cleared SA-as-club on ${saAsClub} players`);

  const all = await loadSaLinkedPlayers();
  const merged = await mergeSaDuplicates(all);
  console.log(`\nDuplicate groups merged: ${merged.groups}, rows removed: ${merged.removed}`);
  for (const d of merged.details.slice(0, 25)) {
    console.log(`  ${d.name}: keep ${d.keep}`);
    for (const drop of d.drop) console.log(`    - ${drop}`);
  }
  if (merged.details.length > 25) console.log(`  …and ${merged.details.length - 25} more`);

  // Spot-check requested names
  const db = createDb();
  const checkNames = [
    "Asenathi Ntlabakanye",
    "Boan Venter",
    "Cameron Hanekom",
    "Celimpilo Gumede",
    "Chad Solomon",
    "Cheslin Kolbe",
    "Christiaan Scholtz",
    "Christie Grobbelaar",
    "Christopher William Smith",
    "CJ Van der Linde",
    "Dale Santon",
    "Danie Rossouw",
    "Dylan Sjoblom",
    "Bulls (rugby union)",
    "Captain (sports)",
  ];
  console.log("\nSpot check:");
  for (const name of checkNames) {
    const rows = await db.execute(sql`
      select name, slug, left(coalesce(image_url,''),40) as img,
        (select count(*)::int from fixture_players fp where fp.player_id = p.id) as fixtures
      from players p where lower(name) = lower(${name}) order by slug
    `);
    console.log(name, rows);
  }

  if (!skipImages && !dryRun) {
    const missing = await scrapeMissingImages();
    if (missing > 0) {
      console.log(
        `\nNext: run Alamy scrape:\n  npx tsx scripts/scrape-alamy-player-searches.ts --batch=/tmp/alamy-search-sa-after-dedupe.json --out=/tmp/alamy-sa-after-dedupe-hits.json\n  npx tsx --require ./scripts/stub-server-only.cjs scripts/import-alamy-player-search-hits.ts --file=/tmp/alamy-sa-after-dedupe-hits.json`,
      );
    }
  }

  const counts = await db.execute(sql`
    select
      (select count(*)::int from players where international_team_id = ${SA_ID}) as sa_intl,
      (select count(*)::int from players where international_team_id = ${SA_ID} and coalesce(image_url,'')='') as sa_missing_img,
      (select count(*)::int from (
         select lower(name) from players
         where international_team_id = ${SA_ID}
         group by lower(name) having count(*) > 1
       ) d) as remaining_dup_names
  `);
  console.log("\nFinal counts", counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
