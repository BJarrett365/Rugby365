/**
 * Fill-missing team image_url from Wikipedia article thumbnails.
 * Does not overwrite existing images. Does not create teams.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-team-images-wikipedia.ts --audit
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-team-images-wikipedia.ts --limit=100
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-team-images-wikipedia.ts --active-only --limit=200
 */
import { and, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import { createDb, fixtures, teams } from "@rugby365/db";
import { parseWikipediaArchive } from "@rugby365/import-sdk";
// Uses public Wikipedia summary thumbnail via parseWikipediaArchive.

const args = process.argv.slice(2);
const auditOnly = args.includes("--audit");
const activeOnly = args.includes("--active-only");
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 100;
const delayArg = args.find((a) => a.startsWith("--delay="));
const delayMs = delayArg ? Number(delayArg.split("=")[1]) : 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function coverage() {
  const db = createDb();
  const [row] = await db.execute(sql`
    select
      count(*)::int as teams,
      count(*) filter (where coalesce(image_url, '') <> '')::int as with_image,
      count(*) filter (where coalesce(wikipedia_url, '') <> '')::int as with_wiki,
      count(*) filter (
        where coalesce(image_url, '') = '' and coalesce(wikipedia_url, '') <> ''
      )::int as wiki_missing_image
    from teams
  `);
  return row as {
    teams: number;
    with_image: number;
    with_wiki: number;
    wiki_missing_image: number;
  };
}

async function main() {
  const before = await coverage();
  console.log(
    `Before: ${before.teams} teams — images ${before.with_image}, wiki ${before.with_wiki}, wiki+no-image ${before.wiki_missing_image}`,
  );
  if (auditOnly) return;

  const db = createDb();
  const activeTeamIds = activeOnly
    ? new Set(
        (
          await db
            .selectDistinct({ id: fixtures.homeTeamId })
            .from(fixtures)
            .where(isNotNull(fixtures.homeTeamId))
        )
          .map((r) => r.id)
          .concat(
            (
              await db
                .selectDistinct({ id: fixtures.awayTeamId })
                .from(fixtures)
                .where(isNotNull(fixtures.awayTeamId))
            ).map((r) => r.id),
          )
          .filter((id): id is string => Boolean(id)),
      )
    : null;

  const candidates = await db
    .select({
      id: teams.id,
      name: teams.name,
      wikipediaUrl: teams.wikipediaUrl,
    })
    .from(teams)
    .where(
      and(
        or(isNull(teams.imageUrl), eq(teams.imageUrl, "")),
        isNotNull(teams.wikipediaUrl),
        sql`coalesce(trim(${teams.wikipediaUrl}), '') <> ''`,
      ),
    )
    .limit(Math.max(limit * 3, limit));

  const list = candidates
    .filter((row) => !activeTeamIds || activeTeamIds.has(row.id))
    .slice(0, limit);

  console.log(`Enriching ${list.length} team(s) from Wikipedia…\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, row] of list.entries()) {
    if (index > 0) await sleep(delayMs);
    try {
      const archive = await parseWikipediaArchive({
        articleTitleOrUrl: row.wikipediaUrl!,
        entityType: "team",
      });
      const imageUrl = archive.imageUrl?.trim() || null;
      if (!imageUrl) {
        skipped += 1;
        console.log(`[${index + 1}/${list.length}] ${row.name} — no thumbnail`);
        continue;
      }
      await db
        .update(teams)
        .set({
          imageUrl,
          ...(archive.wikidataId ? { wikidataId: archive.wikidataId } : {}),
          archiveSyncedAt: new Date(),
        })
        .where(and(eq(teams.id, row.id), or(isNull(teams.imageUrl), eq(teams.imageUrl, ""))));
      updated += 1;
      console.log(`[${index + 1}/${list.length}] ${row.name} — ${imageUrl.slice(0, 72)}`);
    } catch (error) {
      failed += 1;
      console.warn(
        `[${index + 1}/${list.length}] ${row.name} — ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  const after = await coverage();
  console.log(
    `\nDone: updated=${updated} skipped=${skipped} failed=${failed}\nAfter: images ${after.with_image} (was ${before.with_image}), wiki+no-image ${after.wiki_missing_image}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
