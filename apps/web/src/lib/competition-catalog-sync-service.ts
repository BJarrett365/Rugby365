/**
 * Sync taxonomy tags onto competitions that already have data.
 * Never creates empty competition shells for unpopulated catalog entries.
 */
import "server-only";
import { eq, sql } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import { getDb } from "./db";
import {
  COMPETITION_CATALOG,
  findCatalogEntryForCompetitionName,
  groupCompetitionCatalog,
  type CompetitionCatalogEntry,
} from "./competition-catalog";

export type PopulatedCompetitionRow = {
  id: string;
  name: string;
  slug: string;
  competitionType: string;
  seasons: number;
  fixtures: number;
  standings: number;
  catalogKey: string | null;
  catalogGroup: string | null;
  countryName: string | null;
  region: string | null;
  gender: string | null;
  ageGroup: string | null;
  format: string | null;
  level: string | null;
  seasonStructure: string | null;
  lifecycleStatus: string | null;
};

function isPopulated(row: { seasons: number; fixtures: number; standings: number }) {
  return row.seasons > 0 || row.fixtures > 0 || row.standings > 0;
}

export async function listPopulatedCompetitions(): Promise<PopulatedCompetitionRow[]> {
  const db = getDb();
  const rows = await db.execute(sql`
    select
      c.id,
      c.name,
      c.slug,
      c.competition_type as "competitionType",
      c.catalog_key as "catalogKey",
      c.catalog_group as "catalogGroup",
      c.country_name as "countryName",
      c.region,
      c.gender,
      c.age_group as "ageGroup",
      c.format,
      c.level,
      c.season_structure as "seasonStructure",
      c.lifecycle_status as "lifecycleStatus",
      count(distinct cs.id)::int as seasons,
      count(distinct f.id)::int as fixtures,
      count(distinct sr.id)::int as standings
    from competitions c
    left join competition_seasons cs on cs.competition_id = c.id
    left join fixtures f on f.competition_id = c.id
    left join standing_rows sr on sr.season_id = cs.id
    group by c.id
    order by c.name asc
  `);
  const list = ((rows as { rows?: PopulatedCompetitionRow[] }).rows ??
    rows) as PopulatedCompetitionRow[];
  return list.filter(isPopulated);
}

function taxonomyPatch(entry: CompetitionCatalogEntry) {
  return {
    catalogKey: entry.key,
    catalogGroup: entry.group,
    countryName: entry.country,
    region: entry.region,
    gender: entry.gender,
    ageGroup: entry.ageGroup,
    format: entry.format,
    level: entry.level,
    seasonStructure: entry.seasonStructure,
    lifecycleStatus: entry.lifecycle,
    competitionType: entry.competitionType,
  };
}

/**
 * Tag populated competitions from the catalog. Does not insert new competitions.
 */
export async function syncCatalogTaxonomyToPopulatedCompetitions() {
  const db = getDb();
  const populated = await listPopulatedCompetitions();
  const matched: Array<{
    competitionId: string;
    name: string;
    catalogKey: string;
    catalogName: string;
  }> = [];
  const unmatched: Array<{ competitionId: string; name: string }> = [];

  for (const row of populated) {
    const entry = findCatalogEntryForCompetitionName(row.name);
    if (!entry) {
      unmatched.push({ competitionId: row.id, name: row.name });
      continue;
    }
    await db.update(competitions).set(taxonomyPatch(entry)).where(eq(competitions.id, row.id));
    matched.push({
      competitionId: row.id,
      name: row.name,
      catalogKey: entry.key,
      catalogName: entry.name,
    });
  }

  return {
    catalogSize: COMPETITION_CATALOG.length,
    populatedCount: populated.length,
    matched,
    unmatched,
  };
}

export async function getCompetitionCatalogAdminView() {
  const populated = await listPopulatedCompetitions();
  const byCatalogKey = new Map(
    populated.filter((p) => p.catalogKey).map((p) => [p.catalogKey!, p]),
  );
  const byNameMatch = new Map<string, PopulatedCompetitionRow>();
  for (const p of populated) {
    const entry = findCatalogEntryForCompetitionName(p.name);
    if (entry) byNameMatch.set(entry.key, p);
  }

  const groups = [...groupCompetitionCatalog().entries()].map(([group, entries]) => ({
    group,
    competitions: entries.map((entry) => {
      const linked = byCatalogKey.get(entry.key) ?? byNameMatch.get(entry.key) ?? null;
      return {
        ...entry,
        populated: Boolean(linked && isPopulated(linked)),
        competitionId: linked?.id ?? null,
        dbName: linked?.name ?? null,
        seasons: linked?.seasons ?? 0,
        fixtures: linked?.fixtures ?? 0,
        standings: linked?.standings ?? 0,
      };
    }),
  }));

  const populatedTagged = populated.filter((p) => p.catalogKey).length;
  const roadmapOnly = COMPETITION_CATALOG.length - groups.reduce(
    (n, g) => n + g.competitions.filter((c) => c.populated).length,
    0,
  );

  return {
    catalogSize: COMPETITION_CATALOG.length,
    populatedInDb: populated.length,
    populatedTagged,
    roadmapUnpopulated: Math.max(0, roadmapOnly),
    unmatchedPopulated: populated.filter((p) => !findCatalogEntryForCompetitionName(p.name)),
    groups,
  };
}
