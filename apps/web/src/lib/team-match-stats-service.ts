import {
  averageTeamMatchSummary,
  buildTeamMatchImportKey,
  parseSdmsMatchTeamStats,
  sumTeamMatchSummaries,
  type ParsedTeamMatchStats,
  type TeamMatchSide,
} from "@rugby365/import-sdk";
import {
  competitionSeasons,
  competitions,
  fixtures,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  buildSeasonStatsFilterOptions,
  type SeasonStatsFilterOptions,
} from "./player-season-stats-service";

export type TeamMatchStatsRow = {
  id: string;
  fixtureId: string;
  fixtureSlug: string;
  kickoffAt: string | null;
  teamId: string;
  teamName: string;
  opponentName: string | null;
  side: TeamMatchSide;
  seasonId: string | null;
  seasonLabel: string | null;
  competitionId: string | null;
  competitionName: string | null;
  externalMatchId: string | null;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  carries: number;
  metres: number;
  tackles: number;
  turnoversWon: number;
  sections: Record<string, Record<string, number>>;
  syncedAt: string;
};

export type TeamSeasonMatchSummary = {
  seasonId: string;
  seasonLabel: string;
  competitionId: string;
  competitionName: string;
  matches: number;
  totals: ReturnType<typeof sumTeamMatchSummaries>;
  averages: ReturnType<typeof averageTeamMatchSummary>;
};

export type TeamMatchStatsFilters = {
  seasonId?: string;
  competitionId?: string;
  search?: string;
};

function mapTeamMatchRow(input: {
  stat: typeof teamMatchStats.$inferSelect;
  fixtureSlug: string;
  kickoffAt: Date | null;
  teamName: string;
  opponentName: string | null;
  seasonLabel: string | null;
  competitionName: string | null;
}): TeamMatchStatsRow {
  const { stat } = input;
  return {
    id: stat.id,
    fixtureId: stat.fixtureId,
    fixtureSlug: input.fixtureSlug,
    kickoffAt: input.kickoffAt?.toISOString() ?? null,
    teamId: stat.teamId,
    teamName: input.teamName,
    opponentName: input.opponentName,
    side: stat.side as TeamMatchSide,
    seasonId: stat.seasonId,
    seasonLabel: input.seasonLabel,
    competitionId: stat.competitionId,
    competitionName: input.competitionName,
    externalMatchId: stat.externalMatchId,
    tries: stat.tries,
    conversions: stat.conversions,
    penalties: stat.penalties,
    dropGoals: stat.dropGoals,
    carries: stat.carries,
    metres: stat.metres,
    tackles: stat.tackles,
    turnoversWon: stat.turnoversWon,
    sections: (stat.sections ?? {}) as Record<string, Record<string, number>>,
    syncedAt: stat.syncedAt.toISOString(),
  };
}

export async function upsertTeamMatchStat(input: {
  fixtureId: string;
  teamId: string;
  side: TeamMatchSide;
  seasonId?: string | null;
  competitionId?: string | null;
  externalMatchId: string;
  stats: ParsedTeamMatchStats;
  sourceProvider?: string;
}) {
  const db = getDb();
  const sourceProvider = input.sourceProvider ?? "sdms";
  const importKey = buildTeamMatchImportKey(input.externalMatchId, input.side);
  const values = {
    fixtureId: input.fixtureId,
    teamId: input.teamId,
    side: input.side,
    seasonId: input.seasonId ?? null,
    competitionId: input.competitionId ?? null,
    externalMatchId: input.externalMatchId,
    tries: input.stats.tries,
    conversions: input.stats.conversions,
    penalties: input.stats.penalties,
    dropGoals: input.stats.dropGoals,
    carries: input.stats.carries,
    metres: input.stats.metres,
    tackles: input.stats.tackles,
    turnoversWon: input.stats.turnoversWon,
    sections: input.stats.sections,
    sourceProvider,
    importKey,
    syncedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: teamMatchStats.id })
    .from(teamMatchStats)
    .where(
      and(
        eq(teamMatchStats.fixtureId, input.fixtureId),
        eq(teamMatchStats.teamId, input.teamId),
        eq(teamMatchStats.sourceProvider, sourceProvider),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(teamMatchStats)
      .set(values)
      .where(eq(teamMatchStats.id, existing.id))
      .returning();
    return { row: updated!, created: false };
  }

  const [created] = await db.insert(teamMatchStats).values(values).returning();
  return { row: created!, created: true };
}

export async function getFixtureTeamMatchStats(fixtureId: string) {
  const db = getDb();
  const [fixtureRow] = await db
    .select({
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  const teamRows = fixtureRow?.homeTeamId
    ? await db.select({ id: teams.id, name: teams.name }).from(teams)
    : [];
  const teamNameById = new Map(teamRows.map((team) => [team.id, team.name]));

  const rows = await db
    .select({
      stat: teamMatchStats,
      teamName: teams.name,
      seasonLabel: competitionSeasons.label,
      competitionName: competitions.name,
    })
    .from(teamMatchStats)
    .innerJoin(teams, eq(teamMatchStats.teamId, teams.id))
    .leftJoin(competitionSeasons, eq(teamMatchStats.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(teamMatchStats.competitionId, competitions.id))
    .where(eq(teamMatchStats.fixtureId, fixtureId));

  return rows.map(({ stat, teamName, seasonLabel, competitionName }) => {
    const opponentId =
      stat.teamId === fixtureRow?.homeTeamId ? fixtureRow?.awayTeamId : fixtureRow?.homeTeamId;
    return mapTeamMatchRow({
      stat,
      fixtureSlug: fixtureRow?.slug ?? "",
      kickoffAt: fixtureRow?.kickoffAt ?? null,
      teamName,
      opponentName: opponentId ? (teamNameById.get(opponentId) ?? null) : null,
      seasonLabel,
      competitionName,
    });
  });
}

export async function getTeamMatchStatsHistory(teamId: string, filters: TeamMatchStatsFilters = {}) {
  const db = getDb();
  const conditions = [eq(teamMatchStats.teamId, teamId)];
  if (filters.seasonId) conditions.push(eq(teamMatchStats.seasonId, filters.seasonId));
  if (filters.competitionId) conditions.push(eq(teamMatchStats.competitionId, filters.competitionId));

  const rows = await db
    .select({
      stat: teamMatchStats,
      fixtureSlug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      teamName: teams.name,
      seasonLabel: competitionSeasons.label,
      competitionName: competitions.name,
      homeTeamName: teams.name,
    })
    .from(teamMatchStats)
    .innerJoin(fixtures, eq(teamMatchStats.fixtureId, fixtures.id))
    .innerJoin(teams, eq(teamMatchStats.teamId, teams.id))
    .leftJoin(competitionSeasons, eq(teamMatchStats.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(teamMatchStats.competitionId, competitions.id))
    .where(and(...conditions))
    .orderBy(desc(fixtures.kickoffAt));

  const opponentTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamNameById = new Map(opponentTeams.map((team) => [team.id, team.name]));

  const stats = rows.map(({ stat, fixtureSlug, kickoffAt, homeTeamId, awayTeamId, teamName, seasonLabel, competitionName }) => {
    const opponentId = stat.teamId === homeTeamId ? awayTeamId : homeTeamId;
    return mapTeamMatchRow({
      stat,
      fixtureSlug,
      kickoffAt,
      teamName,
      opponentName: opponentId ? (teamNameById.get(opponentId) ?? null) : null,
      seasonLabel,
      competitionName,
    });
  });

  const filterOptions = buildSeasonStatsFilterOptions(
    stats
      .filter((row) => row.seasonId && row.competitionId && row.seasonLabel && row.competitionName)
      .map((row) => ({
        seasonId: row.seasonId!,
        seasonLabel: row.seasonLabel!,
        competitionId: row.competitionId!,
        competitionName: row.competitionName!,
      })),
  );

  const seasonSummaries = aggregateTeamSeasonSummaries(stats);

  return { stats, filterOptions, seasonSummaries };
}

export function aggregateTeamSeasonSummaries(rows: TeamMatchStatsRow[]): TeamSeasonMatchSummary[] {
  const buckets = new Map<string, TeamMatchStatsRow[]>();
  for (const row of rows) {
    if (!row.seasonId || !row.competitionId || !row.seasonLabel || !row.competitionName) continue;
    const key = `${row.seasonId}:${row.competitionId}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([, matchRows]) => {
      const first = matchRows[0]!;
      const summaries = matchRows.map((row) => ({
        tries: row.tries,
        conversions: row.conversions,
        penalties: row.penalties,
        dropGoals: row.dropGoals,
        carries: row.carries,
        metres: row.metres,
        tackles: row.tackles,
        turnoversWon: row.turnoversWon,
      }));
      return {
        seasonId: first.seasonId!,
        seasonLabel: first.seasonLabel!,
        competitionId: first.competitionId!,
        competitionName: first.competitionName!,
        matches: matchRows.length,
        totals: sumTeamMatchSummaries(summaries),
        averages: averageTeamMatchSummary(summaries),
      };
    })
    .sort((a, b) => b.seasonLabel.localeCompare(a.seasonLabel));
}

export { parseSdmsMatchTeamStats };
