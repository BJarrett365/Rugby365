/**
 * Ensure season teams exist for catalog competitions that look empty in Admin Teams.
 *
 * 1) Materialize fixture participants → standing_rows
 * 2) Propagate last known roster onto empty current/active seasons
 * 3) Seed known current rosters where Wikipedia/feeds left gaps
 * 4) Point is_active at the newest season that has teams
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-competition-season-teams.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-competition-season-teams.ts --slug=nationale
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, standingRows } from "@rugby365/db";
import { getCompetitionBySlug } from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";
import { resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import { importWikipediaSeasonPage } from "../apps/web/src/lib/wikipedia-season-import-service";

const args = process.argv.slice(2);
const onlySlug = args.find((a) => a.startsWith("--slug="))?.split("=")[1] ?? null;
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 2000);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Known current / stable rosters when feeds + wiki season pages are thin. */
const ROSTER_SEEDS: Record<string, { year: number; teams: string[] }> = {
  nationale: {
    year: 2024,
    teams: [
      "Albi",
      "Bourg-en-Bresse",
      "Bourgoin-Jallieu",
      "Carcassonne",
      "Chambéry",
      "Hyères",
      "Langon",
      "Marcq-en-Barœul",
      "Massy",
      "Narbonne",
      "Périgueux",
      "Rouen",
      "Suresnes",
      "Tarbes",
    ],
  },
  "national-league-2": {
    year: 2024,
    teams: [
      "Barnes",
      "Bournemouth",
      "Canterbury",
      "Dorking",
      "Guernsey Raiders",
      "Havant",
      "Henley Hawks",
      "Old Albanian",
      "Sevenoaks",
      "Tonbridge Juddians",
      "Westcombe Park",
      "Worthing Raiders",
    ],
  },
  "all-ireland-league": {
    year: 2024,
    teams: [
      "Clontarf",
      "Cork Constitution",
      "Garryowen",
      "Lansdowne",
      "Shannon",
      "St Mary's College",
      "Terenure College",
      "UCD",
      "Young Munster",
      "Ballynahinch",
      "City of Armagh",
      "Dublin University",
      "Nenagh Ormond",
      "Old Belvedere",
      "Queen's University",
      "UL Bohemian",
    ],
  },
  "welsh-premiership": {
    year: 2023,
    teams: [
      "Aberavon",
      "Bridgend Ravens",
      "Cardiff RFC",
      "Carmarthen Quins",
      "Llandovery",
      "Merthyr",
      "Newport RFC",
      "Pontypool",
      "Pontypridd",
      "RGC 1404",
      "Swansea",
      "Ebbw Vale",
    ],
  },
  "super-series": {
    year: 2023,
    teams: [
      "Ayrshire Bulls",
      "Boroughmuir Bears",
      "Edinburgh Rugby A",
      "FOSROC Future XV",
      "Glasgow Warriors A",
      "Heriot's Rugby",
      "Southern Knights",
      "Stirling Wolves",
      "Watsonians",
      "Currie Chieftains",
    ],
  },
  "serie-a-elite": {
    year: 2024,
    teams: [
      "Petrarca Padova",
      "Rovigo Delta",
      "Valorugby Emilia",
      "Colorno",
      "Mogliano",
      "Viola Rugby Firenze",
      "Lazio",
      "Fiamme Oro",
      "HBS Colorno",
      "Rugby Lyons",
    ],
  },
  "campeonato-portugues": {
    year: 2024,
    teams: [
      "Agronomia",
      "Belas",
      "Cascais",
      "CDUL",
      "CF Belenenses",
      "Direito",
      "Lisbon University",
      "SL Benfica",
      "Técnico",
      "CR Guilherme",
    ],
  },
  "division-de-honor": {
    year: 2024,
    teams: [
      "VRAC Quesos Entrepinares",
      "El Salvador",
      "Aparejadores Burgos",
      "Ordizia",
      "Santboiana",
      "Barcelona",
      "Cisneros",
      "Les Abelles",
      "Pozuelo",
      "Alcobendas",
      "La Vila",
      "Gernika",
    ],
  },
  "liga-nationala": {
    year: 2024,
    teams: [
      "CSM Știința Baia Mare",
      "Dinamo București",
      "Steaua București",
      "Timișoara Saracens",
      "CSM București",
      "Universitatea Cluj",
      "Tomitanii Constanța",
      "Gura Humorului",
    ],
  },
  "didi-10": {
    year: 2024,
    teams: [
      "Batumi RC",
      "Aia Kutaisi",
      "Lelo Saracens",
      "RC Armia",
      "Kharebi Rustavi",
      "RC Academy Tbilisi",
      "Jiki Gori",
      "RC Kazbegi",
      "RC Kochebi",
      "RC Rustavi",
    ],
  },
  "heartland-championship": {
    year: 2025,
    teams: [
      "Buller",
      "East Coast",
      "Horowhenua-Kapiti",
      "King Country",
      "Mid Canterbury",
      "North Otago",
      "Poverty Bay",
      "South Canterbury",
      "Thames Valley",
      "Wairarapa Bush",
      "West Coast",
      "Whanganui",
    ],
  },
  "ranfurly-shield": {
    year: 2025,
    teams: [
      "Auckland",
      "Bay of Plenty",
      "Canterbury",
      "Counties Manukau",
      "Hawke's Bay",
      "Manawatū",
      "North Harbour",
      "Northland",
      "Otago",
      "Southland",
      "Taranaki",
      "Tasman",
      "Waikato",
      "Wellington",
      "Buller",
      "South Canterbury",
      "North Otago",
      "Mid Canterbury",
      "Wairarapa Bush",
      "Whanganui",
    ],
  },
  "world-rugby-u20-trophy": {
    year: 2024,
    teams: [
      "Hong Kong China U20",
      "Kenya U20",
      "Netherlands U20",
      "Portugal U20",
      "Samoa U20",
      "Scotland U20",
      "Uruguay U20",
      "USA U20",
      "Zimbabwe U20",
      "Japan U20",
    ],
  },
  "world-rugby-pacific-challenge": {
    year: 2024,
    teams: [
      "Fiji Warriors",
      "Junior Japan",
      "Samoa A",
      "Tonga A",
      "Argentina XV",
      "Canada A",
    ],
  },
  "farah-palmer-cup": {
    year: 2024,
    teams: [
      "Auckland Storm",
      "Bay of Plenty Volcanix",
      "Canterbury",
      "Counties Manukau Heat",
      "Hawke's Bay",
      "Manawatū Cyclones",
      "North Harbour",
      "Northland Kauri",
      "Otago Spirit",
      "Taranaki",
      "Waikato",
      "Wellington Pride",
      "Tasman",
    ],
  },
  "sa-cup": {
    year: 2025,
    teams: [
      "Boland Cavaliers",
      "Border Bulldogs",
      "Eastern Province Elephants",
      "Free State Cheetahs",
      "Griquas",
      "Pumas",
      "SWD Eagles",
      "Valke",
      "Western Province",
      "Sharks",
      "Lions",
      "Bulls",
    ],
  },
};

const WIKI_RETRY: Array<{ slug: string; startYear: number; url: string }> = [
  {
    slug: "nationale",
    startYear: 2024,
    url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_Championnat_F%C3%A9d%C3%A9ral_Nationale_season",
  },
  {
    slug: "nationale",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Championnat_F%C3%A9d%C3%A9ral_Nationale_season",
  },
  {
    slug: "nationale",
    startYear: 2022,
    url: "https://en.wikipedia.org/wiki/2022%E2%80%9323_Nationale",
  },
  {
    slug: "national-league-2",
    startYear: 2024,
    url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_National_League_2_East",
  },
  {
    slug: "national-league-2",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_National_League_2_East",
  },
  {
    slug: "welsh-premiership",
    startYear: 2018,
    url: "https://en.wikipedia.org/wiki/2018%E2%80%9319_Welsh_Premier_Division",
  },
  {
    slug: "welsh-premiership",
    startYear: 2019,
    url: "https://en.wikipedia.org/wiki/2019%E2%80%9320_Welsh_Premier_Division",
  },
  {
    slug: "all-ireland-league",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_All-Ireland_League",
  },
  {
    slug: "all-ireland-league",
    startYear: 2024,
    url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_All-Ireland_League",
  },
  {
    slug: "world-rugby-u20-trophy",
    startYear: 2024,
    url: "https://en.wikipedia.org/wiki/2024_World_Rugby_Under_20_Trophy",
  },
  {
    slug: "world-rugby-u20-trophy",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023_World_Rugby_Under_20_Trophy",
  },
  {
    slug: "world-rugby-pacific-challenge",
    startYear: 2019,
    url: "https://en.wikipedia.org/wiki/2019_World_Rugby_Pacific_Challenge",
  },
  {
    slug: "serie-a-elite",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Serie_A_Elite",
  },
  {
    slug: "division-de-honor",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Divisi%C3%B3n_de_Honor_de_Rugby",
  },
  {
    slug: "division-de-honor",
    startYear: 2024,
    url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_Divisi%C3%B3n_de_Honor_de_Rugby",
  },
  {
    slug: "liga-nationala",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023_Liga_Na%C8%9Bional%C4%83_de_Rugby_season",
  },
  {
    slug: "didi-10",
    startYear: 2023,
    url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Didi_10_season",
  },
  {
    slug: "didi-10",
    startYear: 2024,
    url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_Didi_10_season",
  },
];

const TARGET_SLUGS = [
  "world-rugby-u20-trophy",
  "world-rugby-pacific-challenge",
  "nationale",
  "national-league-1",
  "national-league-2",
  "all-ireland-league",
  "welsh-premiership",
  "super-series",
  "serie-a-elite",
  "campeonato-portugues",
  "division-de-honor",
  "liga-nationala",
  "didi-10",
  "heartland-championship",
  "ranfurly-shield",
  "farah-palmer-cup",
  "sa-cup",
  "celtic-league",
  "pro12",
  "pro14",
  "anglo-welsh-cup",
  "european-challenge-cup-historic",
  "air-new-zealand-cup",
  "itm-cup",
  "mitre-10-cup",
  "currie-cup-first-division",
];

/** Historic brand eras must not keep teams / active flags on post-era season shells. */
const HISTORIC_LAST_YEAR: Record<string, number> = {
  "celtic-league": 2010,
  pro12: 2016,
  pro14: 2020,
  "anglo-welsh-cup": 2017,
  "european-challenge-cup-historic": 2020,
  "air-new-zealand-cup": 2009,
  "itm-cup": 2015,
  "mitre-10-cup": 2020,
  "super-series": 2023,
};

const CURRENT_YEAR = new Date().getFullYear();
const repairOnly = args.includes("--repair-only");
const skipWiki = args.includes("--skip-wiki") || repairOnly;

async function insertRoster(seasonId: string, teamIds: string[]) {
  const db = getDb();
  const existing = await db
    .select({ teamId: standingRows.teamId })
    .from(standingRows)
    .where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, "overall")));
  const have = new Set(existing.map((r) => r.teamId));
  let rank = have.size;
  let added = 0;
  for (const teamId of teamIds) {
    if (have.has(teamId)) continue;
    rank += 1;
    await db.insert(standingRows).values({
      seasonId,
      teamId,
      view: "overall",
      rank,
      played: 0,
      won: 0,
      draw: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: 0,
      bonusPoints: 0,
      tryBonusPoints: 0,
      losingBonusPoints: 0,
      pointsDeduction: 0,
      points: 0,
      form: null,
      syncedAt: new Date(),
    });
    added += 1;
  }
  return added;
}

async function materializeFromFixtures(competitionId: string) {
  const db = getDb();
  const seasons = await db.execute(sql`
    select cs.id as season_id, cs.label
    from competition_seasons cs
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and not exists (
        select 1 from standing_rows sr where sr.season_id = cs.id and sr.view = 'overall'
      )
      and exists (select 1 from fixtures f where f.season_id = cs.id)
  `);
  let total = 0;
  for (const season of seasons as Array<{ season_id: string; label: string }>) {
    const teams = await db.execute(sql`
      select distinct t.id
      from fixtures f
      join teams t on t.id in (f.home_team_id, f.away_team_id)
      where f.season_id = ${season.season_id}
        and t.name !~ '\\{\\{'
    `);
    const ids = (teams as Array<{ id: string }>).map((t) => t.id);
    const added = await insertRoster(season.season_id, ids);
    if (added) {
      console.log(`  fixtures→standings ${season.label}: +${added}`);
      total += added;
    }
  }
  return total;
}

async function seasonTeamIds(seasonId: string) {
  const rows = await getDb()
    .select({ teamId: standingRows.teamId })
    .from(standingRows)
    .where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, "overall")));
  return rows.map((r) => r.teamId);
}

async function bestSourceSeason(competitionId: string, maxYear?: number) {
  const rows = await getDb().execute(sql`
    select cs.id, cs.year, cs.label, count(distinct sr.team_id)::int as teams
    from competition_seasons cs
    join standing_rows sr on sr.season_id = cs.id and sr.view = 'overall'
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and (${maxYear ?? null}::int is null or cs.year <= ${maxYear ?? null})
    group by cs.id, cs.year, cs.label
    having count(distinct sr.team_id) >= 4
    order by cs.year desc, count(distinct sr.team_id) desc
    limit 1
  `);
  return (rows as Array<{ id: string; year: number; label: string; teams: number }>)[0] ?? null;
}

async function clearStandingsBeyondYear(competitionId: string, lastYear: number) {
  const result = await getDb().execute(sql`
    delete from standing_rows sr
    using competition_seasons cs
    where sr.season_id = cs.id
      and cs.competition_id = ${competitionId}
      and cs.year > ${lastYear}
  `);
  const deleted = Number((result as { rowCount?: number }).rowCount ?? 0);
  if (deleted) console.log(`  cleared standings after ${lastYear}: ${deleted} rows`);
  return deleted;
}

async function propagateRoster(competitionId: string, slug: string) {
  const lastYear = HISTORIC_LAST_YEAR[slug] ?? CURRENT_YEAR + 1;
  const source = await bestSourceSeason(competitionId, lastYear);
  if (!source || source.teams < 4) return 0;
  const teamIds = await seasonTeamIds(source.id);
  const empty = await getDb().execute(sql`
    select cs.id, cs.label, cs.year
    from competition_seasons cs
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and not exists (
        select 1 from standing_rows sr where sr.season_id = cs.id and sr.view = 'overall'
      )
      and cs.year >= ${source.year}
      and cs.year <= ${lastYear}
    order by cs.year desc
  `);
  let total = 0;
  for (const season of empty as Array<{ id: string; label: string; year: number }>) {
    const added = await insertRoster(season.id, teamIds);
    if (added) {
      console.log(`  propagate ${source.label} → ${season.label}: +${added}`);
      total += added;
    }
  }
  return total;
}

async function seedKnownRoster(slug: string, competitionId: string) {
  const seed = ROSTER_SEEDS[slug];
  if (!seed) return 0;
  const db = getDb();
  let season = (
    await db
      .select()
      .from(competitionSeasons)
      .where(
        and(
          eq(competitionSeasons.competitionId, competitionId),
          eq(competitionSeasons.year, seed.year),
          eq(competitionSeasons.isDeprecated, false),
        ),
      )
      .limit(1)
  )[0];
  if (!season) {
    // fall back to active season
    season = (
      await db
        .select()
        .from(competitionSeasons)
        .where(
          and(
            eq(competitionSeasons.competitionId, competitionId),
            eq(competitionSeasons.isActive, true),
            eq(competitionSeasons.isDeprecated, false),
          ),
        )
        .limit(1)
    )[0];
  }
  if (!season) return 0;

  const teamIds: string[] = [];
  for (const name of seed.teams) {
    const team = await resolveTeam({ name, createIfMissing: true, sourceProvider: "wikipedia" });
    if (team) teamIds.push(team.id);
  }
  const added = await insertRoster(season.id, teamIds);
  if (added) console.log(`  roster seed ${season.label}: +${added}`);
  return added;
}

async function activateBestSeason(competitionId: string, slug: string) {
  const maxYear = HISTORIC_LAST_YEAR[slug] ?? CURRENT_YEAR + 1;
  const source = await bestSourceSeason(competitionId, maxYear);
  if (!source) return;
  const db = getDb();
  await db
    .update(competitionSeasons)
    .set({ isActive: false })
    .where(eq(competitionSeasons.competitionId, competitionId));
  await db
    .update(competitionSeasons)
    .set({ isActive: true })
    .where(eq(competitionSeasons.id, source.id));
  console.log(`  active → ${source.label} (${source.teams} teams)`);
}

/** Re-seed thin current/next shells from the best completed-season roster (live comps only). */
async function refreshForwardFromRecent(competitionId: string, slug: string) {
  if (HISTORIC_LAST_YEAR[slug]) return 0;
  const completedMax = CURRENT_YEAR - 1;
  const rows = await getDb().execute(sql`
    select cs.id, cs.year, cs.label, count(distinct sr.team_id)::int as teams
    from competition_seasons cs
    join standing_rows sr on sr.season_id = cs.id and sr.view = 'overall'
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and cs.year <= ${completedMax}
    group by cs.id, cs.year, cs.label
    having count(distinct sr.team_id) >= 4
    order by
      count(distinct sr.team_id) desc,
      cs.year desc
    limit 1
  `);
  const source = (rows as Array<{ id: string; year: number; label: string; teams: number }>)[0];
  if (!source) return 0;
  const teamIds = await seasonTeamIds(source.id);
  const targets = await getDb().execute(sql`
    select cs.id, cs.label, cs.year,
      coalesce((
        select count(distinct sr.team_id)::int
        from standing_rows sr
        where sr.season_id = cs.id and sr.view = 'overall'
      ), 0) as teams
    from competition_seasons cs
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and cs.year > ${completedMax}
      and cs.year <= ${CURRENT_YEAR + 1}
    order by cs.year
  `);
  let total = 0;
  for (const season of targets as Array<{ id: string; label: string; year: number; teams: number }>) {
    if (season.teams >= source.teams) continue;
    await getDb().execute(sql`delete from standing_rows where season_id = ${season.id}`);
    const added = await insertRoster(season.id, teamIds);
    if (added) {
      console.log(`  refresh ${source.label} → ${season.label}: +${added}`);
      total += added;
    }
  }
  return total;
}

async function fillHistoricGaps(competitionId: string, slug: string) {
  const lastYear = HISTORIC_LAST_YEAR[slug];
  if (lastYear == null) return 0;
  const rows = await getDb().execute(sql`
    select cs.id, cs.year, cs.label, count(distinct sr.team_id)::int as teams
    from competition_seasons cs
    join standing_rows sr on sr.season_id = cs.id and sr.view = 'overall'
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and cs.year <= ${lastYear}
    group by cs.id, cs.year, cs.label
    having count(distinct sr.team_id) >= 8
    order by count(distinct sr.team_id) desc, cs.year desc
    limit 1
  `);
  const source = (rows as Array<{ id: string; year: number; label: string; teams: number }>)[0];
  if (!source) return 0;
  const teamIds = await seasonTeamIds(source.id);
  const thin = await getDb().execute(sql`
    select cs.id, cs.label, cs.year,
      coalesce((
        select count(distinct sr.team_id)::int
        from standing_rows sr
        where sr.season_id = cs.id and sr.view = 'overall'
      ), 0) as teams
    from competition_seasons cs
    where cs.competition_id = ${competitionId}
      and cs.is_deprecated = false
      and cs.year <= ${lastYear}
    order by cs.year
  `);
  let total = 0;
  for (const season of thin as Array<{ id: string; label: string; year: number; teams: number }>) {
    if (season.teams >= Math.min(8, source.teams)) continue;
    await getDb().execute(sql`delete from standing_rows where season_id = ${season.id}`);
    const added = await insertRoster(season.id, teamIds);
    if (added) {
      console.log(`  historic fill ${source.label} → ${season.label}: +${added}`);
      total += added;
    }
  }
  return total;
}

async function copyFromSibling(opts: {
  targetSlug: string;
  sourceSlug: string;
  fromYear: number;
  toYear: number;
  force?: boolean;
}) {
  const target = await getCompetitionBySlug(opts.targetSlug);
  const source = await getCompetitionBySlug(opts.sourceSlug);
  if (!target || !source) return 0;
  let total = 0;
  for (let year = opts.fromYear; year <= opts.toYear; year += 1) {
    const [sourceSeason] = await getDb()
      .select()
      .from(competitionSeasons)
      .where(
        and(
          eq(competitionSeasons.competitionId, source.id),
          eq(competitionSeasons.year, year),
          eq(competitionSeasons.isDeprecated, false),
        ),
      )
      .limit(1);
    const [targetSeason] = await getDb()
      .select()
      .from(competitionSeasons)
      .where(
        and(
          eq(competitionSeasons.competitionId, target.id),
          eq(competitionSeasons.year, year),
          eq(competitionSeasons.isDeprecated, false),
        ),
      )
      .limit(1);
    if (!sourceSeason || !targetSeason) continue;
    const ids = await seasonTeamIds(sourceSeason.id);
    if (ids.length < 4) continue;
    if (opts.force) {
      await getDb().execute(sql`delete from standing_rows where season_id = ${targetSeason.id}`);
    } else {
      const existing = await seasonTeamIds(targetSeason.id);
      if (existing.length >= 8) continue;
    }
    const added = await insertRoster(targetSeason.id, ids);
    if (added) {
      console.log(`  copy ${opts.sourceSlug} ${year} → ${opts.targetSlug}: +${added}`);
      total += added;
    }
  }
  return total;
}

async function main() {
  console.log("=== Seed competition season teams ===");
  const slugs = onlySlug ? [onlySlug] : TARGET_SLUGS;

  // Fix Currie Cup picker confusion: rename First Division display is already in admin groups;
  // ensure premier Currie Cup name is clear.
  const currie = await getCompetitionBySlug("currie-cup-pd9ro98v");
  if (currie && (currie.name === "Currie Cup" || currie.name === "Currie Cup (South Africa)")) {
    await getDb()
      .update(competitions)
      .set({ name: "Currie Cup Premier Division" })
      .where(eq(competitions.id, currie.id));
    console.log("Renamed currie-cup-pd9ro98v → Currie Cup Premier Division");
  }

  // Heartland is a calendar-year competition; fix mislabeled shells.
  const heartland = await getCompetitionBySlug("heartland-championship");
  if (heartland) {
    const fixed = await getDb().execute(sql`
      update competition_seasons
      set label = year::text
      where competition_id = ${heartland.id}
        and label ~ '–'
        and is_deprecated = false
      returning year, label
    `);
    for (const row of fixed as Array<{ year: number; label: string }>) {
      console.log(`  heartland label → ${row.label}`);
    }
  }

  if (!skipWiki) {
    console.log("\n=== Wikipedia retries (fixed titles) ===");
    for (const [index, item] of WIKI_RETRY.filter((w) => !onlySlug || w.slug === onlySlug).entries()) {
      if (index > 0) await sleep(delayMs);
      console.log(`  ${item.slug} ${item.startYear}`);
      try {
        const report = await importWikipediaSeasonPage(item.url, {
          competitionSlug: item.slug,
          seasonStartYear: item.startYear,
          mode: "update_existing",
          createMissingTeams: true,
          importFixtures: true,
          importPlayoffs: true,
        });
        console.log(
          `    ✓ table ${report.table.created}c/${report.table.updated}u fixtures ${report.fixtures.created}c/${report.fixtures.updated}u`,
        );
      } catch (error) {
        console.error(`    ✗ ${error instanceof Error ? error.message : error}`);
      }
    }
  } else {
    console.log("\n=== Wikipedia retries skipped ===");
  }

  console.log("\n=== Materialize / propagate / seed ===");
  for (const slug of slugs) {
    const competition = await getCompetitionBySlug(slug);
    if (!competition) {
      console.log(`\n→ ${slug} missing`);
      continue;
    }
    console.log(`\n→ ${slug}`);
    const lastYear = HISTORIC_LAST_YEAR[slug];
    if (lastYear != null) {
      await clearStandingsBeyondYear(competition.id, lastYear);
    }
    if (!repairOnly) {
      await materializeFromFixtures(competition.id);
      await seedKnownRoster(slug, competition.id);
      await propagateRoster(competition.id, slug);
    } else {
      // Repair path still re-applies known current rosters where wiki left gaps.
      await seedKnownRoster(slug, competition.id);
    }
    await refreshForwardFromRecent(competition.id, slug);
    await fillHistoricGaps(competition.id, slug);
    await activateBestSeason(competition.id, slug);
  }

  // Historic brand eras: copy from canonical modern comps for overlapping years.
  console.log("\n=== Historic / sibling copies ===");
  if (!onlySlug || HISTORIC_LAST_YEAR[onlySlug]) {
  await copyFromSibling({
    targetSlug: "air-new-zealand-cup",
    sourceSlug: "npc",
    fromYear: 2006,
    toYear: 2009,
    force: true,
  });
  await copyFromSibling({
    targetSlug: "itm-cup",
    sourceSlug: "npc",
    fromYear: 2010,
    toYear: 2015,
    force: true,
  });
  await copyFromSibling({
    targetSlug: "mitre-10-cup",
    sourceSlug: "npc",
    fromYear: 2016,
    toYear: 2020,
    force: true,
  });
  await copyFromSibling({
    targetSlug: "european-challenge-cup-historic",
    sourceSlug: "challenge-cup",
    fromYear: 2014,
    toYear: 2020,
    force: true,
  });
  await copyFromSibling({
    targetSlug: "celtic-league",
    sourceSlug: "united-rugby-championship",
    fromYear: 2001,
    toYear: 2010,
    force: true,
  });
  await copyFromSibling({
    targetSlug: "pro12",
    sourceSlug: "united-rugby-championship",
    fromYear: 2011,
    toYear: 2016,
    force: true,
  });
  await copyFromSibling({
    targetSlug: "pro14",
    sourceSlug: "united-rugby-championship",
    fromYear: 2017,
    toYear: 2020,
    force: true,
  });
  }

  console.log("\n=== Re-activate after historic copies ===");
  for (const slug of Object.keys(HISTORIC_LAST_YEAR)) {
    if (onlySlug && slug !== onlySlug) continue;
    const competition = await getCompetitionBySlug(slug);
    if (!competition) continue;
    console.log(`\n→ ${slug}`);
    await clearStandingsBeyondYear(competition.id, HISTORIC_LAST_YEAR[slug]!);
    await fillHistoricGaps(competition.id, slug);
    await activateBestSeason(competition.id, slug);
  }

  console.log("\n=== Coverage check ===");
  for (const slug of slugs) {
    const competition = await getCompetitionBySlug(slug);
    if (!competition) continue;
    const [active] = await getDb().execute(sql`
      select cs.label,
        count(distinct sr.team_id) filter (where sr.view='overall')::int as teams
      from competition_seasons cs
      left join standing_rows sr on sr.season_id = cs.id
      where cs.competition_id = ${competition.id}
        and cs.is_active = true and cs.is_deprecated = false
      group by cs.label
    `);
    const row = active as { label?: string; teams?: number } | undefined;
    console.log(`  ${slug}: active=${row?.label ?? "—"} teams=${row?.teams ?? 0}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
