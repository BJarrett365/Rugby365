/**
 * Fast tables-facing cleanup: for each duplicate competition display name,
 * keep the best row and delete overall standing_rows on the losers so /tables
 * cannot list them. Does not wait on full fixture merges.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/dedupe-tables-competition-cards.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/dedupe-tables-competition-cards.ts --write
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";

const write = process.argv.includes("--write");

type Row = {
  id: string;
  name: string;
  slug: string;
  standing_rows: number;
  seasons_with_table: number;
};

function score(row: Row): number {
  let s = row.standing_rows;
  if (!row.slug.includes("__legacy__")) s += 1_000_000;
  s += row.seasons_with_table * 10;
  return s;
}

async function main() {
  const db = getDb();
  const rows = (await db.execute(sql`
    select
      c.id,
      c.name,
      c.slug,
      count(sr.id)::int as standing_rows,
      count(distinct cs.id) filter (where sr.id is not null)::int as seasons_with_table
    from competitions c
    left join competition_seasons cs on cs.competition_id = c.id
    left join standing_rows sr on sr.season_id = cs.id and sr.view = 'overall'
    group by c.id, c.name, c.slug
    having count(sr.id) > 0
    order by lower(c.name), c.slug
  `).then((r) => ((r as unknown as { rows?: Row[] }).rows ?? (r as unknown as Row[])))) as Row[];

  const byName = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }

  let groups = 0;
  let deletedRows = 0;
  for (const [name, list] of byName) {
    if (list.length < 2) continue;
    groups += 1;
    const sorted = [...list].sort((a, b) => score(b) - score(a));
    const keeper = sorted[0]!;
    const losers = sorted.slice(1);
    console.log(
      `${name}: keep ${keeper.slug} (rows=${keeper.standing_rows}) remove ${losers
        .map((l) => `${l.slug}(${l.standing_rows})`)
        .join(", ")}`,
    );
    if (!write) continue;
    for (const loser of losers) {
      const result = await db.execute(sql`
        delete from standing_rows sr
        using competition_seasons cs
        where sr.season_id = cs.id
          and cs.competition_id = ${loser.id}::uuid
          and sr.view = 'overall'
      `);
      const n =
        typeof (result as { rowCount?: number }).rowCount === "number"
          ? (result as { rowCount: number }).rowCount
          : loser.standing_rows;
      deletedRows += n;
    }
  }

  console.log(
    write
      ? `\nDone. Groups cleaned: ${groups}, standing rows deleted: ${deletedRows}`
      : `\nDry run. Duplicate name groups with tables: ${groups}. Pass --write to delete loser standings.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
