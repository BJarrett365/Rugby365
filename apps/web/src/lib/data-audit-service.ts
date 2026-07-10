import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  playerSeasonStats,
  players,
  standingRows,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { reportDuplicateCompetitionSeasons } from "./competition-admin-service";
import {
  currentDomesticSeasonStartYear,
  formatSeasonRangeLabel,
  kickoffInSeason,
  parseSeasonStartYear,
} from "./season-label-utils";
import { canonicalTeamIdentityKey } from "./season-scoped-picker-service";

export type AuditSeverity = "error" | "warning" | "info";

export type AuditFinding = {
  severity: AuditSeverity;
  message: string;
  suggestedFix?: string;
  recordCount?: number;
  sourceSystem?: string;
  lastSyncedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type AuditSection = {
  id: string;
  label: string;
  errors: AuditFinding[];
  warnings: AuditFinding[];
  info: AuditFinding[];
  recordCounts: Record<string, number>;
};

export type DataHealthAuditReport = {
  generatedAt: string;
  sections: {
    competitions: AuditSection;
    seasons: AuditSection;
    teams: AuditSection;
    players: AuditSection;
    fixtures: AuditSection;
    standings: AuditSection;
    aliases: AuditSection;
  };
  summary: {
    errors: number;
    warnings: number;
    info: number;
  };
};

function emptySection(id: string, label: string): AuditSection {
  return { id, label, errors: [], warnings: [], info: [], recordCounts: {} };
}

function pushFinding(section: AuditSection, finding: AuditFinding) {
  if (finding.severity === "error") section.errors.push(finding);
  else if (finding.severity === "warning") section.warnings.push(finding);
  else section.info.push(finding);
}

export async function runDataHealthAudit(): Promise<DataHealthAuditReport> {
  const db = getDb();
  const generatedAt = new Date().toISOString();
  const sections = {
    competitions: emptySection("competitions", "Competitions"),
    seasons: emptySection("seasons", "Seasons"),
    teams: emptySection("teams", "Teams"),
    players: emptySection("players", "Players"),
    fixtures: emptySection("fixtures", "Fixtures"),
    standings: emptySection("standings", "Standings"),
    aliases: emptySection("aliases", "Aliases"),
  };

  const [competitionRows, seasonRows, teamRows, playerRows, fixtureRows] = await Promise.all([
    db.select().from(competitions).orderBy(asc(competitions.name)),
    db.select().from(competitionSeasons).orderBy(desc(competitionSeasons.year)),
    db.select().from(teams).orderBy(asc(teams.name)),
    db.select({ id: players.id }).from(players),
    db
      .select({
        id: fixtures.id,
        competitionId: fixtures.competitionId,
        kickoffAt: fixtures.kickoffAt,
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
      })
      .from(fixtures),
  ]);

  sections.competitions.recordCounts.total = competitionRows.length;
  sections.seasons.recordCounts.total = seasonRows.length;
  sections.teams.recordCounts.total = teamRows.length;
  sections.players.recordCounts.total = playerRows.length;
  sections.fixtures.recordCounts.total = fixtureRows.length;
  sections.aliases.recordCounts.total = 0;

  const compById = new Map(competitionRows.map((row) => [row.id, row]));
  const seasonsByComp = new Map<string, typeof seasonRows>();
  for (const season of seasonRows) {
    const list = seasonsByComp.get(season.competitionId) ?? [];
    list.push(season);
    seasonsByComp.set(season.competitionId, list);
  }

  for (const competition of competitionRows) {
    const dupes = await reportDuplicateCompetitionSeasons(competition.id);
    if (dupes.length > 0) {
      pushFinding(sections.seasons, {
        severity: "warning",
        message: `${competition.name}: ${dupes.length} season year(s) have duplicate rows`,
        suggestedFix: "Run mergeDuplicateCompetitionSeasons and mark numeric duplicates is_deprecated",
        recordCount: dupes.reduce((sum, row) => sum + row.seasons.length, 0),
        metadata: { competitionId: competition.id, years: dupes.map((row) => row.year) },
      });
    }

    const compSeasons = seasonsByComp.get(competition.id) ?? [];
    const activeSeasons = compSeasons.filter((row) => row.isActive && !row.isDeprecated);
    const activeByYear = new Map<number, number>();
    for (const row of activeSeasons) {
      const year = row.year ?? parseSeasonStartYear(row.label);
      if (year == null) continue;
      activeByYear.set(year, (activeByYear.get(year) ?? 0) + 1);
    }
    for (const [year, count] of activeByYear) {
      if (count > 1) {
        pushFinding(sections.seasons, {
          severity: "error",
          message: `${competition.name} ${formatSeasonRangeLabel(year)}: ${count} active seasons`,
          suggestedFix: "Set is_active on one canonical slug season only",
          recordCount: count,
          metadata: { competitionId: competition.id, year },
        });
      }
    }
  }

  const deprecatedActive = seasonRows.filter((row) => row.isDeprecated && row.isActive);
  if (deprecatedActive.length > 0) {
    pushFinding(sections.seasons, {
      severity: "error",
      message: `${deprecatedActive.length} deprecated season(s) still marked active`,
      suggestedFix: "Clear is_active on deprecated rows",
      recordCount: deprecatedActive.length,
    });
  }

  const standingCounts = await db
    .select({
      seasonId: standingRows.seasonId,
      count: sql<number>`count(*)`,
      syncedAt: sql<string | null>`max(${standingRows.syncedAt})`,
    })
    .from(standingRows)
    .groupBy(standingRows.seasonId);

  const standingsBySeason = new Map(
    standingCounts.map((row) => [row.seasonId, { count: Number(row.count), syncedAt: row.syncedAt }]),
  );
  sections.standings.recordCounts.rows = standingCounts.reduce((sum, row) => sum + Number(row.count), 0);

  for (const season of seasonRows.filter((row) => !row.isDeprecated)) {
    const stats = standingsBySeason.get(season.id);
    const competition = compById.get(season.competitionId);
    if (!stats || stats.count === 0) continue;

    const seasonYear = season.year ?? parseSeasonStartYear(season.label);
    if (seasonYear == null) continue;

    const compFixtures = fixtureRows.filter((row) => row.competitionId === season.competitionId);
    const inWindow = compFixtures.filter((row) => kickoffInSeason(row.kickoffAt, seasonYear));
    const outOfWindow = compFixtures.filter(
      (row) => row.kickoffAt && !kickoffInSeason(row.kickoffAt, seasonYear),
    );

    if (inWindow.length === 0 && stats.count > 0) {
      pushFinding(sections.standings, {
        severity: "warning",
        message: `${competition?.name ?? "Competition"} ${season.label}: standings but no fixtures in season window`,
        suggestedFix: "Verify season year label matches fixture kickoffs",
        recordCount: stats.count,
        lastSyncedAt: stats.syncedAt,
        metadata: { seasonId: season.id },
      });
    }

    if (outOfWindow.length > 20 && inWindow.length > 0) {
      pushFinding(sections.fixtures, {
        severity: "info",
        message: `${competition?.name ?? "Competition"} ${season.label}: ${outOfWindow.length} fixtures outside season window (fixtures have no season_id FK)`,
        suggestedFix: "Filter fixtures by kickoffInSeason when scoping selectors",
        recordCount: outOfWindow.length,
        metadata: { seasonId: season.id, competitionId: season.competitionId },
      });
    }
  }

  const currentYear = currentDomesticSeasonStartYear();
  const premiership = competitionRows.find((row) => row.slug === "premiership");
  if (premiership) {
    const currentSeason = seasonRows.find(
      (row) =>
        row.competitionId === premiership.id &&
        !row.isDeprecated &&
        (row.year === currentYear || row.isActive),
    );
    if (currentSeason) {
      const standingTeamRows = await db
        .select({ teamId: standingRows.teamId, name: teams.name })
        .from(standingRows)
        .innerJoin(teams, eq(standingRows.teamId, teams.id))
        .where(and(eq(standingRows.seasonId, currentSeason.id), eq(standingRows.view, "overall")));

      const canonicalKeys = new Map<string, string[]>();
      for (const row of standingTeamRows) {
        const key = canonicalTeamIdentityKey("premiership", row.name);
        const names = canonicalKeys.get(key) ?? [];
        names.push(row.name);
        canonicalKeys.set(key, names);
      }

      for (const [key, names] of canonicalKeys) {
        if (names.length > 1) {
          pushFinding(sections.teams, {
            severity: "warning",
            message: `Premiership ${currentSeason.label}: duplicate canonical club "${key}" (${names.join(", ")})`,
            suggestedFix: "Merge team rows and map aliases to canonical team_id",
            recordCount: names.length,
            metadata: { seasonId: currentSeason.id, names },
          });
        }
      }

      const historicNames = [
        "London Irish",
        "London Welsh",
        "Wasps",
        "Worcester Warriors",
        "Yorkshire",
      ];
      for (const name of historicNames) {
        const found = standingTeamRows.find((row) => row.name === name);
        if (found) {
          pushFinding(sections.teams, {
            severity: "error",
            message: `Premiership current season includes historic club "${name}" in standings`,
            suggestedFix: "Re-sync standings for canonical season or merge wrong season_id",
            metadata: { teamId: found.teamId, seasonId: currentSeason.id },
          });
        }
      }
    }
  }

  const duplicateTeamNames = await db
    .select({
      name: teams.name,
      count: sql<number>`count(*)`,
    })
    .from(teams)
    .groupBy(teams.name)
    .having(sql`count(*) > 1`);

  if (duplicateTeamNames.length > 0) {
    pushFinding(sections.teams, {
      severity: "warning",
      message: `${duplicateTeamNames.length} team name(s) appear on multiple team rows`,
      suggestedFix: "Run entity dedup and link aliases",
      recordCount: duplicateTeamNames.reduce((sum, row) => sum + Number(row.count), 0),
      metadata: { names: duplicateTeamNames.map((row) => row.name).slice(0, 20) },
    });
  }

  pushFinding(sections.aliases, {
    severity: "info",
    message: "Team alias mappings are defined in PREMIERSHIP_TEAM_ALIASES and entity dedup — no team_aliases table yet",
    suggestedFix: "Run entity dedup for duplicate team rows; extend alias map for import sources",
  });

  const multiTeamPlayers = await db
    .select({
      playerId: playerSeasonStats.playerId,
      seasonId: playerSeasonStats.seasonId,
      teamCount: sql<number>`count(distinct ${playerSeasonStats.teamId})`,
    })
    .from(playerSeasonStats)
    .groupBy(playerSeasonStats.playerId, playerSeasonStats.seasonId)
    .having(sql`count(distinct ${playerSeasonStats.teamId}) > 1`);

  if (multiTeamPlayers.length > 0) {
    pushFinding(sections.players, {
      severity: "warning",
      message: `${multiTeamPlayers.length} player-season row(s) linked to multiple clubs (transfers or duplicate imports)`,
      suggestedFix: "Split stats by team or verify transfer dates against season window",
      recordCount: multiTeamPlayers.length,
      sourceSystem: "sdms",
    });
  }

  const playersWithoutSeasonLink = await db
    .select({ count: sql<number>`count(*)` })
    .from(players)
    .leftJoin(playerSeasonStats, eq(players.id, playerSeasonStats.playerId))
    .where(isNull(playerSeasonStats.id));

  const orphanCount = Number(playersWithoutSeasonLink[0]?.count ?? 0);
  if (orphanCount > 0) {
    pushFinding(sections.players, {
      severity: "info",
      message: `${orphanCount} player(s) have no player_season_stats link`,
      suggestedFix: "Import squads or map from fixture_players for active seasons",
      recordCount: orphanCount,
    });
  }

  const summary = {
    errors: Object.values(sections).reduce((sum, section) => sum + section.errors.length, 0),
    warnings: Object.values(sections).reduce((sum, section) => sum + section.warnings.length, 0),
    info: Object.values(sections).reduce((sum, section) => sum + section.info.length, 0),
  };

  return { generatedAt, sections, summary };
}
