/**
 * Repair Rugby Championship / Tri-Nations tables:
 * - merge orphan + nickname team duplicates onto canonical nations
 * - collapse duplicate fixture imports
 * - rebuild standing_rows from the deduped fixture calc
 */
import { eq, inArray, sql } from "drizzle-orm";
import { competitionSeasons, fixtures, standingRows, teams } from "@rugby365/db";
import { getCompetitionBySlug, type StandingView } from "./competition-admin-service";
import { getDb } from "./db";
import { dedupeTeams, mergeTeamRecords } from "./entity-dedup-service";
import { deleteFixture } from "./fixture-admin-service";
import { calculateRugbyTable } from "./table-lab/table-calculation-service";
import {
  canonicalStandingsTeamName,
  isActivelyLiveFixture,
  isUnknownStandingsTeamName,
  pickCanonicalFixturesForStandings,
  pickCanonicalTeamIdByName,
  resolveTeamNamesFromFixtureSlug,
  RUGBY_CHAMPIONSHIP_TEAM_KEYS,
} from "./table-lab/standings-fixture-dedupe";
import { isLiveFixtureStatus } from "./table-lab/live-table-service";

const VIEWS: StandingView[] = ["overall", "home", "away"];

/** Close abandoned "live" CMS rows so tables never light up after full time. */
export async function clearStaleLiveFixtureStatuses(competitionId?: string) {
  const db = getDb();
  const rows = competitionId
    ? await db.select().from(fixtures).where(eq(fixtures.competitionId, competitionId))
    : await db.select().from(fixtures);

  let cleared = 0;
  const now = Date.now();
  for (const row of rows) {
    if (!isLiveFixtureStatus(row.status)) continue;
    if (isActivelyLiveFixture(row.status, row.kickoffAt, now)) continue;
    const nextStatus =
      row.kickoffAt && new Date(row.kickoffAt).getTime() > now + 2 * 60 * 1000
        ? "scheduled"
        : "full_time";
    await db
      .update(fixtures)
      .set({ status: nextStatus })
      .where(eq(fixtures.id, row.id));
    cleared += 1;
  }
  return { cleared };
}

function nationFromSlugToken(token: string): string | null {
  const name = canonicalStandingsTeamName(
    token
      .replace(/\bwrmru\d+\b/gi, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (ch) => ch.toUpperCase()),
  );
  const key = name.toLowerCase();
  return RUGBY_CHAMPIONSHIP_TEAM_KEYS.has(key) ? name : null;
}

/** Vote for which nation an orphan team actually is, using fixture slug sides. */
export async function inferOrphanNationVotes(competitionId: string) {
  const db = getDb();
  const rows = await db.execute<{
    team_id: string;
    team_name: string;
    fixture_slug: string;
    home_team_id: string | null;
    away_team_id: string | null;
  }>(sql`
    SELECT t.id AS team_id, t.name AS team_name, f.slug AS fixture_slug,
           f.home_team_id, f.away_team_id
    FROM teams t
    JOIN fixtures f
      ON f.home_team_id = t.id OR f.away_team_id = t.id
    WHERE f.competition_id = ${competitionId}::uuid
      AND (t.name ILIKE 'Unknown team%' OR t.slug LIKE 'orphan-%')
  `);

  const votes = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const base = (row.fixture_slug ?? "").split("__legacy__")[0] ?? "";
    const withoutDate = base.replace(/-\d{4}-\d{2}-\d{2}$/, "");
    const parts = withoutDate.split("-v-");
    if (parts.length !== 2) continue;
    const side = row.home_team_id === row.team_id ? 0 : row.away_team_id === row.team_id ? 1 : -1;
    if (side < 0) continue;
    const nation = nationFromSlugToken(parts[side]!);
    if (!nation) continue;
    const byNation = votes.get(row.team_id) ?? new Map<string, number>();
    byNation.set(nation, (byNation.get(nation) ?? 0) + 1);
    votes.set(row.team_id, byNation);
  }

  const resolved: Array<{ orphanId: string; nation: string; votes: number }> = [];
  for (const [orphanId, byNation] of votes) {
    const ranked = [...byNation.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked[0];
    if (!top) continue;
    resolved.push({ orphanId, nation: top[0], votes: top[1] });
  }
  return resolved;
}

async function loadCanonicalNationTeams(competitionId: string) {
  const db = getDb();
  const teamIds = await db.execute<{ id: string }>(sql`
    SELECT DISTINCT x.id
    FROM (
      SELECT home_team_id AS id FROM fixtures WHERE competition_id = ${competitionId}::uuid
      UNION
      SELECT away_team_id AS id FROM fixtures WHERE competition_id = ${competitionId}::uuid
    ) x
    WHERE x.id IS NOT NULL
  `);
  const ids = teamIds.map((row) => row.id);
  if (!ids.length) return new Map<string, { id: string; name: string }>();
  const rows = await db.select().from(teams).where(inArray(teams.id, ids));
  return pickCanonicalTeamIdByName(
    rows.map((row) => ({
      id: row.id,
      name: canonicalStandingsTeamName(row.name),
      slug: row.slug,
    })),
  );
}

export async function mergeRugbyChampionshipTeamAliases(competitionId: string) {
  const db = getDb();
  const canonicalByNation = await loadCanonicalNationTeams(competitionId);
  const orphanVotes = await inferOrphanNationVotes(competitionId);

  const mergePlan = new Map<string, Set<string>>();
  const ensure = (canonicalId: string) => {
    if (!mergePlan.has(canonicalId)) mergePlan.set(canonicalId, new Set());
    return mergePlan.get(canonicalId)!;
  };

  for (const vote of orphanVotes) {
    const canonical = canonicalByNation.get(vote.nation.toLowerCase());
    if (!canonical || canonical.id === vote.orphanId) continue;
    ensure(canonical.id).add(vote.orphanId);
  }

  const allTeams = await db.select().from(teams);
  const byKey = new Map<string, typeof allTeams>();
  for (const team of allTeams) {
    const name = canonicalStandingsTeamName(team.name);
    if (isUnknownStandingsTeamName(name)) continue;
    if (!RUGBY_CHAMPIONSHIP_TEAM_KEYS.has(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    const list = byKey.get(key) ?? [];
    list.push(team);
    byKey.set(key, list);
  }
  for (const [key, group] of byKey) {
    const canonical = canonicalByNation.get(key) ?? {
      id: group.sort((a, b) => a.slug.length - b.slug.length)[0]!.id,
      name: canonicalStandingsTeamName(group[0]!.name),
    };
    for (const row of group) {
      if (row.id === canonical.id) continue;
      ensure(canonical.id).add(row.id);
    }
  }

  let merged = 0;
  for (const [canonicalId, dupes] of mergePlan) {
    const ids = [...dupes].filter((id) => id !== canonicalId);
    if (!ids.length) continue;
    await mergeTeamRecords(canonicalId, ids);
    merged += ids.length;
  }

  const deduped = await dedupeTeams();
  return { orphanResolved: orphanVotes.length, teamsMerged: merged + deduped.deleted, dedupe: deduped };
}

export async function dedupeRugbyChampionshipFixtures(competitionId: string) {
  const db = getDb();
  const fixtureRows = await db.select().from(fixtures).where(eq(fixtures.competitionId, competitionId));
  const teamRows = await db.select().from(teams);
  const teamNameById = Object.fromEntries(teamRows.map((row) => [row.id, row.name]));

  const keepers = pickCanonicalFixturesForStandings(fixtureRows, (fixture) => {
    const homeName = fixture.homeTeamId ? (teamNameById[fixture.homeTeamId] ?? "Unknown") : "Unknown";
    const awayName = fixture.awayTeamId ? (teamNameById[fixture.awayTeamId] ?? "Unknown") : "Unknown";
    const resolved = resolveTeamNamesFromFixtureSlug(fixture.slug, homeName, awayName);
    return {
      id: fixture.id,
      slug: fixture.slug,
      status: fixture.status,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      homeName: resolved.homeName,
      awayName: resolved.awayName,
      kickoffAt: fixture.kickoffAt,
    };
  });

  const keeperIds = new Set(keepers.map((row) => row.id));
  const losers = fixtureRows.filter((row) => !keeperIds.has(row.id));

  const keeperKeys = new Set(
    keepers
      .map((fixture) => {
        const homeName = fixture.homeTeamId ? (teamNameById[fixture.homeTeamId] ?? "Unknown") : "Unknown";
        const awayName = fixture.awayTeamId ? (teamNameById[fixture.awayTeamId] ?? "Unknown") : "Unknown";
        const resolved = resolveTeamNamesFromFixtureSlug(fixture.slug, homeName, awayName);
        if (!fixture.kickoffAt) return null;
        if (
          isUnknownStandingsTeamName(resolved.homeName) ||
          isUnknownStandingsTeamName(resolved.awayName)
        ) {
          return null;
        }
        const day = new Date(fixture.kickoffAt).toISOString().slice(0, 10);
        return `${day}:${[resolved.homeName.toLowerCase(), resolved.awayName.toLowerCase()].sort().join(":")}`;
      })
      .filter(Boolean),
  );

  let removed = 0;
  for (const loser of losers) {
    const homeName = loser.homeTeamId ? (teamNameById[loser.homeTeamId] ?? "Unknown") : "Unknown";
    const awayName = loser.awayTeamId ? (teamNameById[loser.awayTeamId] ?? "Unknown") : "Unknown";
    const resolved = resolveTeamNamesFromFixtureSlug(loser.slug, homeName, awayName);
    if (!loser.kickoffAt) continue;
    if (
      isUnknownStandingsTeamName(resolved.homeName) ||
      isUnknownStandingsTeamName(resolved.awayName)
    ) {
      continue;
    }
    const day = new Date(loser.kickoffAt).toISOString().slice(0, 10);
    const key = `${day}:${[resolved.homeName.toLowerCase(), resolved.awayName.toLowerCase()].sort().join(":")}`;
    if (!keeperKeys.has(key)) continue;
    await deleteFixture(loser.id);
    removed += 1;
  }

  return { fixtureCount: fixtureRows.length, kept: keepers.length, removed };
}

export async function rebuildSeasonStandingsFromFixtures(seasonId: string) {
  const db = getDb();
  let upserted = 0;

  // Clear first so live_table does not re-read polluted synced rows.
  await db.delete(standingRows).where(eq(standingRows.seasonId, seasonId));

  for (const view of VIEWS) {
    const tableView = view === "home" ? "home" : view === "away" ? "away" : "all";
    const result = await calculateRugbyTable("live_table", {
      seasonId,
      tableView,
      includeLiveMatches: true,
      includeScheduledMatches: false,
      showMovement: false,
    });

    for (const row of result.rows) {
      if (isUnknownStandingsTeamName(row.teamName)) continue;
      if (!RUGBY_CHAMPIONSHIP_TEAM_KEYS.has(canonicalStandingsTeamName(row.teamName).toLowerCase())) {
        continue;
      }
      await db.insert(standingRows).values({
        seasonId,
        teamId: row.teamId,
        view,
        rank: row.rank,
        played: row.played,
        won: row.won,
        draw: row.drawn,
        lost: row.lost,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        pointsDiff: row.pointsDiff,
        bonusPoints: row.bonusPoints,
        points: row.leaguePoints,
        form: null,
      });
      upserted += 1;
    }
  }

  return { upserted };
}

export async function repairRugbyChampionshipTables(options?: { dryRun?: boolean }) {
  const dryRun = options?.dryRun ?? false;
  const competition = await getCompetitionBySlug("rugby-championship");
  if (!competition) throw new Error("rugby-championship competition not found");

  const db = getDb();
  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id));

  if (dryRun) {
    const orphanVotes = await inferOrphanNationVotes(competition.id);
    return {
      dryRun: true,
      competitionId: competition.id,
      seasons: seasons.length,
      orphanVotes,
    };
  }

  const teamRepair = await mergeRugbyChampionshipTeamAliases(competition.id);
  const staleLive = await clearStaleLiveFixtureStatuses(competition.id);
  const fixtureRepair = await dedupeRugbyChampionshipFixtures(competition.id);

  const seasonResults: Array<{ seasonId: string; label: string; upserted: number }> = [];
  for (const season of seasons.sort((a, b) => (b.year ?? 0) - (a.year ?? 0))) {
    const rebuilt = await rebuildSeasonStandingsFromFixtures(season.id);
    seasonResults.push({ seasonId: season.id, label: season.label, upserted: rebuilt.upserted });
  }

  return {
    dryRun: false,
    competitionId: competition.id,
    teams: teamRepair,
    staleLive,
    fixtures: fixtureRepair,
    seasons: seasonResults,
  };
}
