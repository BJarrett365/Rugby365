/**
 * Match CMS data editors — lineups/stats/events write helpers.
 * Field locks for sync still apply elsewhere; these are operator overrides.
 */
import { and, asc, desc, eq } from "drizzle-orm";
import { emptyParsedPlayerMatchPerformance } from "@rugby365/import-sdk";
import { fixtures, matchEvents, playerMatchPerformanceStats, teamMatchStats } from "@rugby365/db";
import { getDb } from "./db";
import { getFixtureById } from "./fixture-admin-service";
import {
  getFixturePlayerMatchStats,
  upsertMatchPerformanceStat,
  type PlayerMatchStatsRow,
} from "./player-season-stats-service";
import { getFixtureTeamMatchStats, type TeamMatchStatsRow } from "./team-match-stats-service";
import { buildRunningScoresForEvents } from "./match-event-scores";
import {
  TEAM_STAT_METRIC_KEYS,
  type TeamStatPairRow,
} from "./match-cms-data-shared";

export {
  TEAM_STAT_METRIC_KEYS,
  TEAM_STAT_SCOPES,
  SCORING_EVENT_TYPES,
  CARD_EVENT_TYPES,
  type TeamStatMetricKey,
  type TeamStatScope,
  type TeamStatPairRow,
} from "./match-cms-data-shared";

const SUMMARY_KEYS = new Set([
  "tries",
  "conversions",
  "penalties",
  "dropGoals",
  "carries",
  "metres",
  "tackles",
  "turnoversWon",
]);

function metricLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function readSideValue(row: TeamMatchStatsRow | undefined, type: string): number {
  if (!row) return 0;
  if (SUMMARY_KEYS.has(type)) {
    const v = row[type as keyof TeamMatchStatsRow];
    return typeof v === "number" ? v : 0;
  }
  const cms = ((row.sections as Record<string, unknown> | undefined)?.cms_metrics ??
    {}) as Record<string, number>;
  if (typeof cms[type] === "number") return cms[type];
  for (const bag of Object.values(row.sections ?? {})) {
    if (bag && typeof bag === "object" && typeof (bag as Record<string, number>)[type] === "number") {
      return (bag as Record<string, number>)[type];
    }
  }
  return 0;
}

function readScope(home: TeamMatchStatsRow | undefined, type: string): string {
  const scopes = ((home?.sections as Record<string, unknown> | undefined)?.cms_scopes ??
    {}) as Record<string, string>;
  return scopes[type] ?? "Total";
}

export function buildTeamStatPairRows(
  home: TeamMatchStatsRow | undefined,
  away: TeamMatchStatsRow | undefined,
): TeamStatPairRow[] {
  const keys = new Set<string>([...TEAM_STAT_METRIC_KEYS]);
  for (const row of [home, away]) {
    const cms = ((row?.sections as Record<string, unknown> | undefined)?.cms_metrics ??
      {}) as Record<string, number>;
    for (const key of Object.keys(cms)) keys.add(key);
  }
  return [...keys]
    .map((type) => ({
      type,
      label: metricLabel(type),
      scope: readScope(home, type),
      home: readSideValue(home, type),
      away: readSideValue(away, type),
    }))
    .filter((row) => row.home !== 0 || row.away !== 0 || SUMMARY_KEYS.has(row.type))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function ensureTeamStatShell(input: {
  fixtureId: string;
  teamId: string;
  side: "home" | "away";
  seasonId: string | null;
  competitionId: string | null;
  externalMatchId: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(teamMatchStats)
    .where(
      and(
        eq(teamMatchStats.fixtureId, input.fixtureId),
        eq(teamMatchStats.teamId, input.teamId),
        eq(teamMatchStats.sourceProvider, "manual"),
      ),
    )
    .limit(1);
  if (existing) return existing;

  // Prefer updating the primary imported row when present
  const [imported] = await db
    .select()
    .from(teamMatchStats)
    .where(
      and(eq(teamMatchStats.fixtureId, input.fixtureId), eq(teamMatchStats.teamId, input.teamId)),
    )
    .limit(1);
  if (imported) return imported;

  const [created] = await db
    .insert(teamMatchStats)
    .values({
      fixtureId: input.fixtureId,
      teamId: input.teamId,
      side: input.side,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      externalMatchId: input.externalMatchId,
      sourceProvider: "manual",
      importKey: `manual:${input.fixtureId}:${input.side}`,
      sections: {},
      syncedAt: new Date(),
    })
    .returning();
  return created!;
}

export async function upsertTeamStatPair(
  fixtureId: string,
  input: { type: string; scope?: string; home: number; away: number },
) {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");
  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture needs home and away teams");
  }

  const type = input.type.trim();
  if (!type) throw new Error("Stat type is required");
  const homeVal = Math.max(0, Math.floor(Number(input.home) || 0));
  const awayVal = Math.max(0, Math.floor(Number(input.away) || 0));
  const scope = (input.scope?.trim() || "Total") as string;
  const externalMatchId = fixture.externalMatchId ?? fixture.id;

  const homeRow = await ensureTeamStatShell({
    fixtureId,
    teamId: fixture.homeTeamId,
    side: "home",
    seasonId: fixture.seasonId ?? null,
    competitionId: fixture.competitionId ?? null,
    externalMatchId,
  });
  const awayRow = await ensureTeamStatShell({
    fixtureId,
    teamId: fixture.awayTeamId,
    side: "away",
    seasonId: fixture.seasonId ?? null,
    competitionId: fixture.competitionId ?? null,
    externalMatchId,
  });

  const db = getDb();

  async function apply(row: typeof homeRow, value: number) {
    const sections = {
      ...((row.sections as Record<string, unknown> | null) ?? {}),
    } as Record<string, Record<string, number | string>>;
    const cmsMetrics = { ...(sections.cms_metrics as Record<string, number> | undefined) };
    const cmsScopes = { ...(sections.cms_scopes as Record<string, string> | undefined) };
    cmsMetrics[type] = value;
    cmsScopes[type] = scope;
    sections.cms_metrics = cmsMetrics as Record<string, number>;
    sections.cms_scopes = cmsScopes as Record<string, string>;

    const patch: Record<string, unknown> = {
      sections,
      syncedAt: new Date(),
    };
    if (SUMMARY_KEYS.has(type)) {
      patch[type] = value;
    }

    const [updated] = await db
      .update(teamMatchStats)
      .set(patch)
      .where(eq(teamMatchStats.id, row.id))
      .returning();
    return updated;
  }

  await apply(homeRow, homeVal);
  await apply(awayRow, awayVal);

  const teamStats = await getFixtureTeamMatchStats(fixtureId);
  const home = teamStats.find((r) => r.side === "home");
  const away = teamStats.find((r) => r.side === "away");
  return { rows: buildTeamStatPairRows(home, away), teamStats };
}

export type PlayerStatDraft = {
  playerId: string;
  teamId: string;
  minutesPlayed?: number;
  points?: number;
  tries?: number;
  carries?: number;
  metresCarried?: number;
  lineBreaks?: number;
  defendersBeaten?: number;
  tacklesMade?: number;
  tacklesCompleted?: number;
  turnoversWon?: number;
  tryAssists?: number;
};

export async function saveFixturePlayerStatsBatch(fixtureId: string, drafts: PlayerStatDraft[]) {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");
  const externalMatchId = fixture.externalMatchId ?? fixture.id;
  const existing = await getFixturePlayerMatchStats(fixtureId);
  const byPlayer = new Map(existing.map((row) => [row.playerId, row]));
  const db = getDb();

  for (const draft of drafts) {
    const prev = byPlayer.get(draft.playerId);
    const nextStats = {
      minutesPlayed: draft.minutesPlayed ?? prev?.minutesPlayed ?? 0,
      tries: draft.tries ?? prev?.tries ?? 0,
      points: draft.points ?? prev?.points ?? 0,
      carries: draft.carries ?? prev?.carries ?? 0,
      metresCarried: draft.metresCarried ?? prev?.metresCarried ?? 0,
      tacklesMade: draft.tacklesMade ?? prev?.tacklesMade ?? 0,
      tacklesCompleted: draft.tacklesCompleted ?? prev?.tacklesCompleted ?? 0,
      dominantTackles: prev?.dominantTackles ?? 0,
      turnoversWon: draft.turnoversWon ?? prev?.turnoversWon ?? 0,
      tryAssists: draft.tryAssists ?? prev?.tryAssists ?? 0,
      lineBreaks: draft.lineBreaks ?? prev?.lineBreaks ?? 0,
      defendersBeaten: draft.defendersBeaten ?? prev?.defendersBeaten ?? 0,
      touches: prev?.touches ?? 0,
      postContactMetres: prev?.postContactMetres ?? 0,
      ruckArrivalEffectiveness: prev?.ruckArrivalEffectiveness ?? 0,
    };

    if (prev) {
      await db
        .update(playerMatchPerformanceStats)
        .set({
          ...nextStats,
          teamId: draft.teamId,
          syncedAt: new Date(),
        })
        .where(eq(playerMatchPerformanceStats.id, prev.id));
      continue;
    }

    await upsertMatchPerformanceStat({
      fixtureId,
      playerId: draft.playerId,
      teamId: draft.teamId,
      seasonId: fixture.seasonId,
      competitionId: fixture.competitionId,
      externalMatchId,
      externalPlayerId: draft.playerId,
      stats: {
        ...emptyParsedPlayerMatchPerformance(
          draft.playerId,
          "",
          draft.teamId === fixture.homeTeamId ? "home" : "away",
        ),
        ...nextStats,
      },
    });
  }

  return getFixturePlayerMatchStats(fixtureId);
}

export type MatchEventAdminInput = {
  eventType: string;
  minute: number;
  second?: number;
  teamId?: string | null;
  playerId?: string | null;
  payload?: Record<string, unknown>;
};

export async function listFixtureEventsAdmin(fixtureId: string) {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  const rows = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(asc(matchEvents.sequenceNo), asc(matchEvents.minute));
  const running = buildRunningScoresForEvents(
    rows.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      teamId: e.teamId,
      payload: (e.payload ?? {}) as Record<string, unknown>,
    })),
    fixture?.homeTeamId,
    fixture?.awayTeamId,
  );
  return rows.map((row) => ({
    ...row,
    runningScore: running.get(row.id) ?? null,
  }));
}

export async function createFixtureEventAdmin(fixtureId: string, input: MatchEventAdminInput) {
  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) throw new Error("Fixture not found");

  const [last] = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(desc(matchEvents.sequenceNo))
    .limit(1);

  const [event] = await db
    .insert(matchEvents)
    .values({
      fixtureId,
      eventType: input.eventType,
      minute: Math.max(0, Math.floor(input.minute)),
      second: Math.max(0, Math.floor(input.second ?? 0)),
      teamId: input.teamId ?? null,
      playerId: input.playerId ?? null,
      payload: input.payload ?? {},
      sourceProvider: "manual",
      sequenceNo: (last?.sequenceNo ?? 0) + 1,
    })
    .returning();

  return event;
}

export async function updateFixtureEventAdmin(eventId: string, input: Partial<MatchEventAdminInput>) {
  const db = getDb();
  const [existing] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
  if (!existing) throw new Error("Event not found");

  const [event] = await db
    .update(matchEvents)
    .set({
      ...(input.eventType !== undefined ? { eventType: input.eventType } : {}),
      ...(input.minute !== undefined ? { minute: Math.max(0, Math.floor(input.minute)) } : {}),
      ...(input.second !== undefined ? { second: Math.max(0, Math.floor(input.second)) } : {}),
      ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
      ...(input.playerId !== undefined ? { playerId: input.playerId } : {}),
      ...(input.payload !== undefined
        ? {
            payload: {
              ...((existing.payload as Record<string, unknown> | null) ?? {}),
              ...input.payload,
            },
          }
        : {}),
    })
    .where(eq(matchEvents.id, eventId))
    .returning();

  return event;
}

export async function deleteFixtureEventAdmin(eventId: string) {
  const db = getDb();
  const [row] = await db.delete(matchEvents).where(eq(matchEvents.id, eventId)).returning({ id: matchEvents.id });
  if (!row) throw new Error("Event not found");
  return row;
}

export type { PlayerMatchStatsRow };
