#!/usr/bin/env npx tsx
/**
 * Full Premiership Wikipedia audit — standings, fixtures, playoffs, clubs table.
 *
 * Usage:
 *   npx tsx scripts/audit-premiership-wikipedia-full.ts
 *   npx tsx scripts/audit-premiership-wikipedia-full.ts --year=2024
 *   npx tsx scripts/audit-premiership-wikipedia-full.ts --json
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  coaches,
  competitionSeasons,
  fixtures,
  standingRows,
  teamCoachingStaff,
  teams,
  venues,
} from "@rugby365/db";
import {
  fetchWikipediaSeasonPage,
  fetchWikipediaTeamsSection,
  parseClubsTableFromWikitext,
  parsePremiershipSeasonWikitext,
  type WikipediaClubRow,
} from "@rugby365/import-sdk";
import { getCompetitionBySlug } from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";
import { formatSeasonRangeLabel } from "../apps/web/src/lib/season-label-utils";
import { canonicalPremiershipTeamName } from "../apps/web/src/lib/transfer-match-service";
import { premiershipWikipediaSeasonUrls } from "../apps/web/src/lib/wikipedia-season-import-service";

const COMPETITION_SLUG = "premiership";
const asJson = process.argv.includes("--json");
const onlyYear = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];

function norm(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function looseMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return !na && !nb;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  let overlap = 0;
  for (const w of ta) if (tb.has(w)) overlap++;
  const minLen = Math.min(ta.size, tb.size);
  return minLen > 0 && overlap / minLen >= 0.6;
}

type ClubAuditRow = {
  club: string;
  wikiCoach: string | null;
  dbCoach: string | null;
  coachOk: boolean | null;
  wikiCaptain: string | null;
  wikiStadium: string | null;
  dbStadium: string | null;
  stadiumOk: boolean;
  wikiCapacity: number | null;
  dbCapacity: number | null;
  capacityOk: boolean;
  wikiCity: string | null;
  dbCity: string | null;
  cityOk: boolean;
  inStandings: boolean;
};

type SeasonFullAudit = {
  startYear: number;
  label: string;
  wikipediaUrl: string;
  status: "ok" | "warn" | "fail";
  issues: string[];
  wikiChampion: string | null;
  dbChampion: string | null;
  championOk: boolean;
  wikiStandingsTeams: number;
  dbStandingsTeams: number;
  wikiPlayed: number | null;
  dbPlayedMin: number | null;
  dbPlayedMax: number | null;
  standingsOk: boolean;
  wikiRegularFixtures: number;
  dbRegularFixtures: number;
  wikiPlayoffFixtures: number;
  dbPlayoffFixtures: number;
  wikiClubs: number;
  clubsWithCoachData: number;
  coachMatches: number;
  coachMismatches: number;
  coachMissingInDb: number;
  stadiumMatches: number;
  stadiumMismatches: number;
  capacityMatches: number;
  capacityMismatches: number;
  cityMatches: number;
  cityMismatches: number;
  clubs: ClubAuditRow[];
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function loadDbSeasonContext(competitionId: string, startYear: number) {
  const db = getDb();
  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(
      and(
        eq(competitionSeasons.competitionId, competitionId),
        eq(competitionSeasons.year, startYear),
      ),
    )
    .limit(1);

  if (!season) {
    return {
      season: null,
      standings: [] as Array<{ teamId: string; teamName: string; played: number }>,
      championName: null as string | null,
      regularFixtures: 0,
      playoffFixtures: 0,
      teamById: new Map<string, { name: string; homeVenueId: string | null }>(),
      venueById: new Map<string, { name: string; city: string | null; capacity: number | null }>(),
      coachesByTeamId: new Map<string, string>(),
    };
  }

  const standings = await db
    .select({
      teamId: standingRows.teamId,
      teamName: teams.name,
      played: standingRows.played,
    })
    .from(standingRows)
    .innerJoin(teams, eq(standingRows.teamId, teams.id))
    .where(eq(standingRows.seasonId, season.id));

  let championName: string | null = null;
  if (season.championTeamId) {
    const [champ] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, season.championTeamId))
      .limit(1);
    championName = champ?.name ?? null;
  }

  const fixtureCounts = await db
    .select({
      stage: fixtures.stage,
      count: sql<number>`count(*)::int`,
    })
    .from(fixtures)
    .where(eq(fixtures.seasonId, season.id))
    .groupBy(fixtures.stage);

  const regularFixtures =
    fixtureCounts.find((r) => r.stage === "regular" || r.stage == null)?.count ?? 0;
  const playoffFixtures = fixtureCounts
    .filter((r) => r.stage && r.stage !== "regular")
    .reduce((sum, r) => sum + r.count, 0);

  const teamIds = standings.map((s) => s.teamId);
  const allTeams =
    teamIds.length > 0
      ? await db
          .select({
            id: teams.id,
            name: teams.name,
            homeVenueId: teams.homeVenueId,
          })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [];

  const venueIds = allTeams.map((t) => t.homeVenueId).filter((id): id is string => Boolean(id));
  const allVenues =
    venueIds.length > 0
      ? await db
          .select({
            id: venues.id,
            name: venues.name,
            city: venues.city,
            capacity: venues.capacity,
          })
          .from(venues)
          .where(inArray(venues.id, venueIds))
      : [];

  const staff =
    teamIds.length > 0
      ? await db
          .select({
            teamId: teamCoachingStaff.teamId,
            coachName: coaches.name,
            role: teamCoachingStaff.role,
            seasonId: teamCoachingStaff.seasonId,
          })
          .from(teamCoachingStaff)
          .innerJoin(coaches, eq(teamCoachingStaff.coachId, coaches.id))
          .where(
            and(
              inArray(teamCoachingStaff.teamId, teamIds),
              eq(teamCoachingStaff.seasonId, season.id),
            ),
          )
      : [];

  const teamById = new Map(allTeams.map((t) => [t.id, { name: t.name, homeVenueId: t.homeVenueId }]));
  const venueById = new Map(
    allVenues.map((v) => [v.id, { name: v.name, city: v.city, capacity: v.capacity }]),
  );
  const coachesByTeamId = new Map<string, string>();
  for (const row of staff) {
    if (/director|head coach|coach/i.test(row.role)) {
      coachesByTeamId.set(row.teamId, row.coachName);
    }
  }

  return {
    season,
    standings,
    championName,
    regularFixtures,
    playoffFixtures,
    teamById,
    venueById,
    coachesByTeamId,
  };
}

function auditClubs(
  wikiClubs: WikipediaClubRow[],
  ctx: Awaited<ReturnType<typeof loadDbSeasonContext>>,
  standingTeamNames: Set<string>,
): ClubAuditRow[] {
  const rows: ClubAuditRow[] = [];

  for (const club of wikiClubs) {
    const canonical = canonicalPremiershipTeamName(club.clubName);
    const standing = ctx.standings.find((s) =>
      looseMatch(canonicalPremiershipTeamName(s.teamName), canonical),
    );
    const teamId = standing?.teamId;
    const dbCoach = teamId ? (ctx.coachesByTeamId.get(teamId) ?? null) : null;
    const team = teamId ? ctx.teamById.get(teamId) : null;
    const venue = team?.homeVenueId ? ctx.venueById.get(team.homeVenueId) : null;

    const coachOk = club.headCoach
      ? dbCoach
        ? looseMatch(club.headCoach, dbCoach)
        : false
      : null;

    rows.push({
      club: canonical,
      wikiCoach: club.headCoach,
      dbCoach,
      coachOk,
      wikiCaptain: club.captain,
      wikiStadium: club.stadium,
      dbStadium: venue?.name ?? null,
      stadiumOk: looseMatch(club.stadium, venue?.name),
      wikiCapacity: club.capacity,
      dbCapacity: venue?.capacity ?? null,
      capacityOk:
        club.capacity == null ||
        venue?.capacity == null ||
        Math.abs(club.capacity - venue.capacity) <= Math.max(500, venue.capacity * 0.05),
      wikiCity: club.cityArea,
      dbCity: venue?.city ?? null,
      cityOk: looseMatch(club.cityArea?.split(",")[0], venue?.city),
      inStandings: standingTeamNames.has(norm(canonical)),
    });
  }

  return rows;
}

async function auditSeason(
  startYear: number,
  url: string,
  competitionId: string,
): Promise<SeasonFullAudit> {
  const label = formatSeasonRangeLabel(startYear);
  const issues: string[] = [];

  const page = await fetchWikipediaSeasonPage(url);
  const teamsWikitext = await fetchWikipediaTeamsSection(page);
  const wikiClubsRaw = parseClubsTableFromWikitext(teamsWikitext);
  const parsed = parsePremiershipSeasonWikitext(page);
  const wikiTeamNames = new Set(
    parsed.standings.map((s) => norm(canonicalPremiershipTeamName(s.teamName))),
  );
  const wikiClubs = wikiClubsRaw.filter((c) =>
    wikiTeamNames.has(norm(canonicalPremiershipTeamName(c.clubName))),
  );
  const ctx = await loadDbSeasonContext(competitionId, startYear);

  const standingNames = new Set(
    ctx.standings.map((s) => norm(canonicalPremiershipTeamName(s.teamName))),
  );
  const clubs = auditClubs(wikiClubs, ctx, standingNames);

  const wikiPlayed =
    parsed.standings.length > 0
      ? parsed.standings[0]!.played
      : null;
  const dbPlayed = ctx.standings.map((s) => s.played);
  const dbPlayedMin = dbPlayed.length ? Math.min(...dbPlayed) : null;
  const dbPlayedMax = dbPlayed.length ? Math.max(...dbPlayed) : null;

  const championOk = looseMatch(parsed.championName, ctx.championName);
  const standingsOk =
    parsed.standings.length === ctx.standings.length &&
    dbPlayedMin === dbPlayedMax &&
    dbPlayedMin === wikiPlayed;

  if (!ctx.season) issues.push("Season row missing in DB");
  if (!championOk) {
    issues.push(`Champion mismatch: wiki=${parsed.championName ?? "—"} db=${ctx.championName ?? "—"}`);
  }
  if (!standingsOk) {
    issues.push(
      `Standings mismatch: wiki ${parsed.standings.length} teams P=${wikiPlayed}; db ${ctx.standings.length} teams P=${dbPlayedMin}-${dbPlayedMax}`,
    );
  }
  if (parsed.fixtures.length !== ctx.regularFixtures) {
    issues.push(
      `Regular fixtures: wiki=${parsed.fixtures.length} db=${ctx.regularFixtures} (db may include legacy LiveSport rows)`,
    );
  }
  if (parsed.playoffFixtures.length !== ctx.playoffFixtures) {
    issues.push(
      `Playoff fixtures: wiki=${parsed.playoffFixtures.length} db=${ctx.playoffFixtures}`,
    );
  }
  if (!wikiClubs.length) issues.push("No Wikipedia clubs table parsed");

  const coachRows = clubs.filter((c) => c.wikiCoach);
  const coachMatches = coachRows.filter((c) => c.coachOk === true).length;
  const coachMismatches = coachRows.filter((c) => c.coachOk === false).length;
  const coachMissingInDb = coachRows.filter((c) => !c.dbCoach).length;
  if (coachMismatches > 0) issues.push(`${coachMismatches} coach name mismatch(es)`);
  if (coachMissingInDb > 0) issues.push(`${coachMissingInDb} wiki coach(es) not in DB for season`);

  const stadiumMismatches = clubs.filter((c) => c.wikiStadium && !c.stadiumOk).length;
  const capacityMismatches = clubs.filter((c) => c.wikiCapacity && !c.capacityOk).length;
  const cityMismatches = clubs.filter((c) => c.wikiCity && !c.cityOk).length;
  if (stadiumMismatches) issues.push(`${stadiumMismatches} stadium mismatch(es)`);
  if (capacityMismatches) issues.push(`${capacityMismatches} capacity mismatch(es)`);
  if (cityMismatches) issues.push(`${cityMismatches} city mismatch(es)`);

  for (const w of parsed.warnings) issues.push(`Wiki: ${w}`);

  const critical = issues.some(
    (i) =>
      i.startsWith("Season row") ||
      i.startsWith("Champion") ||
      i.startsWith("Standings") ||
      i.startsWith("No Wikipedia"),
  );
  const status: SeasonFullAudit["status"] = critical
    ? "fail"
    : issues.length
      ? "warn"
      : "ok";

  return {
    startYear,
    label,
    wikipediaUrl: url,
    status,
    issues,
    wikiChampion: parsed.championName,
    dbChampion: ctx.championName,
    championOk,
    wikiStandingsTeams: parsed.standings.length,
    dbStandingsTeams: ctx.standings.length,
    wikiPlayed,
    dbPlayedMin,
    dbPlayedMax,
    standingsOk,
    wikiRegularFixtures: parsed.fixtures.length,
    dbRegularFixtures: ctx.regularFixtures,
    wikiPlayoffFixtures: parsed.playoffFixtures.length,
    dbPlayoffFixtures: ctx.playoffFixtures,
    wikiClubs: wikiClubs.length,
    clubsWithCoachData: coachRows.length,
    coachMatches,
    coachMismatches,
    coachMissingInDb,
    stadiumMatches: clubs.filter((c) => c.stadiumOk).length,
    stadiumMismatches,
    capacityMatches: clubs.filter((c) => c.capacityOk).length,
    capacityMismatches,
    cityMatches: clubs.filter((c) => c.cityOk).length,
    cityMismatches,
    clubs,
  };
}

function renderMarkdown(results: SeasonFullAudit[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const ok = results.filter((r) => r.status === "ok").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;

  let md = `# Premiership Wikipedia Full Audit (${date})\n\n`;
  md += `Audited **${results.length}** seasons against Wikipedia (standings, fixtures, playoffs, clubs table).\n\n`;
  md += `| Status | Count |\n|--------|------:|\n| ok | ${ok} |\n| warn | ${warn} |\n| fail | ${fail} |\n\n`;

  md += `## Season summary\n\n`;
  md += `| Season | Status | Champion | Table | P | Fixtures (W→DB) | Playoffs (W→DB) | Clubs | Coaches | Venues |\n`;
  md += `|--------|--------|----------|------:|--:|------------------:|----------------:|------:|--------:|-------:|\n`;

  for (const r of results) {
    const champ = r.championOk ? "✓" : "✗";
    const table = r.standingsOk ? "✓" : "✗";
    const coach =
      r.clubsWithCoachData === 0
        ? "n/a"
        : `${r.coachMatches}/${r.clubsWithCoachData}`;
    const venue = `${r.stadiumMatches}/${r.wikiClubs}`;
    md += `| ${r.label} | ${r.status} | ${champ} | ${table} | ${r.wikiPlayed ?? "—"} | ${r.wikiRegularFixtures}→${r.dbRegularFixtures} | ${r.wikiPlayoffFixtures}→${r.dbPlayoffFixtures} | ${r.wikiClubs} | ${coach} | ${venue} |\n`;
  }

  md += `\n## Club tables (Wikipedia vs DB)\n\n`;
  md += `Columns: **Club**, Director of Rugby/Head Coach, Captain (wiki only — not stored in DB), Stadium, Capacity, City/Area.\n\n`;

  for (const r of results) {
    if (!r.clubs.length) continue;
    md += `### ${r.label}\n\n`;
    if (r.issues.length) {
      md += `Issues: ${r.issues.map((i) => `\`${i}\``).join("; ")}\n\n`;
    }
    md += `| Club | Wiki coach | DB coach | Captain | Wiki stadium | DB stadium | Wiki cap | DB cap | Wiki city | DB city |\n`;
    md += `|------|------------|----------|---------|--------------|------------|---------:|-------:|-----------|--------|\n`;
    for (const c of r.clubs) {
      const coachFlag = c.coachOk === null ? "" : c.coachOk ? "" : " ⚠";
      const stadiumFlag = c.stadiumOk ? "" : " ⚠";
      const capFlag = c.capacityOk ? "" : " ⚠";
      md += `| ${c.club} | ${c.wikiCoach ?? "—"} | ${c.dbCoach ?? "—"}${coachFlag} | ${c.wikiCaptain ?? "—"} | ${c.wikiStadium ?? "—"} | ${c.dbStadium ?? "—"}${stadiumFlag} | ${c.wikiCapacity ?? "—"} | ${c.dbCapacity ?? "—"}${capFlag} | ${c.wikiCity ?? "—"} | ${c.dbCity ?? "—"} |\n`;
    }
    md += `\n`;
  }

  md += `## Notes\n\n`;
  md += `- **Captain** is published on Wikipedia but has no dedicated DB field yet; shown for reference only.\n`;
  md += `- **Coach** comparison uses \`team_coaching_staff\` for the season (or current head coach when season-scoped row missing).\n`;
  md += `- **Fixture counts** may exceed Wikipedia when legacy LiveSport imports remain linked to the same \`season_id\`.\n`;
  md += `- Older seasons (pre-~2010) often omit coach/captain columns on Wikipedia.\n`;

  return md;
}

async function main() {
  const competition = await getCompetitionBySlug(COMPETITION_SLUG);
  if (!competition) {
    console.error(`Competition not found: ${COMPETITION_SLUG}`);
    process.exit(1);
  }

  const seasons = premiershipWikipediaSeasonUrls()
    .filter((s) => (onlyYear ? String(s.startYear) === onlyYear : true))
    .sort((a, b) => a.startYear - b.startYear);

  console.log(`Auditing ${seasons.length} Wikipedia season(s)…\n`);

  const results: SeasonFullAudit[] = [];
  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(4000);
    process.stdout.write(`${season.startYear}… `);
    try {
      const row = await auditSeason(season.startYear, season.url, competition.id);
      results.push(row);
      console.log(row.status.toUpperCase(), row.issues.length ? `(${row.issues.length} issues)` : "");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log("ERROR", message);
      results.push({
        startYear: season.startYear,
        label: formatSeasonRangeLabel(season.startYear),
        wikipediaUrl: season.url,
        status: "fail",
        issues: [message],
        wikiChampion: null,
        dbChampion: null,
        championOk: false,
        wikiStandingsTeams: 0,
        dbStandingsTeams: 0,
        wikiPlayed: null,
        dbPlayedMin: null,
        dbPlayedMax: null,
        standingsOk: false,
        wikiRegularFixtures: 0,
        dbRegularFixtures: 0,
        wikiPlayoffFixtures: 0,
        dbPlayoffFixtures: 0,
        wikiClubs: 0,
        clubsWithCoachData: 0,
        coachMatches: 0,
        coachMismatches: 0,
        coachMissingInDb: 0,
        stadiumMatches: 0,
        stadiumMismatches: 0,
        capacityMatches: 0,
        capacityMismatches: 0,
        cityMatches: 0,
        cityMismatches: 0,
        clubs: [],
      });
    }
  }

  const reportPath = join(
    process.cwd(),
    "docs/audits",
    `PREMIERSHIP_WIKIPEDIA_FULL_AUDIT_${new Date().toISOString().slice(0, 10)}.md`,
  );
  const markdown = renderMarkdown(results);
  writeFileSync(reportPath, markdown, "utf8");

  if (asJson) {
    console.log(JSON.stringify({ reportPath, results }, null, 2));
  } else {
    console.log(`\nReport written: ${reportPath}`);
    const fail = results.filter((r) => r.status === "fail").length;
    const warn = results.filter((r) => r.status === "warn").length;
    const ok = results.filter((r) => r.status === "ok").length;
    console.log(`Summary: ${ok} ok, ${warn} warn, ${fail} fail`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
