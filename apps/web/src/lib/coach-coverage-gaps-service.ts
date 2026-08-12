/**
 * Coach data-coverage gaps + editorial actions (ignore / mark unavailable).
 */
import { inArray, sql } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerMatchRatings,
  teamMatchStats,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { loadCoachEligibleMatches } from "./coach-career-record-service";
import { getTeamRankingAtDate } from "./world-rugby-rankings-at-date";

export type CoverageDataType =
  | "matches"
  | "lineups"
  | "team_stats"
  | "player_ratings"
  | "historical_rankings";

export type CoverageGapStatus = "missing" | "ignored" | "unavailable" | "present";

export type CoachCoverageGapRow = {
  fixtureId: string;
  match: string;
  date: string | null;
  opponent: string | null;
  competition: string | null;
  missingData: string;
  availableSource: string;
  status: CoverageGapStatus;
};

export type CoverageGapAction = "ignore" | "unavailable" | "clear";

type GapOverride = {
  status: "ignored" | "unavailable";
  note?: string | null;
  updatedAt?: string;
};

function overrideKey(dataType: CoverageDataType, fixtureId: string): string {
  return `${dataType}:${fixtureId}`;
}

async function loadOverrides(coachId: string): Promise<Record<string, GapOverride>> {
  const db = getDb();
  try {
    const rows = await db.execute(sql`
      select coverage_gap_overrides from coaches where id = ${coachId}::uuid limit 1
    `);
    const raw = (rows as unknown as { rows?: Array<{ coverage_gap_overrides?: unknown }> }).rows?.[0]
      ?.coverage_gap_overrides;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, GapOverride>;
    }
  } catch {
    // Column may not exist until migration 0072.
  }
  return {};
}

export async function setCoverageGapAction(input: {
  coachId: string;
  dataType: CoverageDataType;
  fixtureId: string;
  action: CoverageGapAction;
  note?: string | null;
}): Promise<{ ok: boolean; overrides: Record<string, GapOverride> }> {
  const db = getDb();
  const overrides = await loadOverrides(input.coachId);
  const key = overrideKey(input.dataType, input.fixtureId);
  if (input.action === "clear") {
    delete overrides[key];
  } else {
    overrides[key] = {
      status: input.action === "ignore" ? "ignored" : "unavailable",
      note: input.note ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    await db.execute(sql`
      update coaches
      set coverage_gap_overrides = ${JSON.stringify(overrides)}::jsonb,
          updated_at = now()
      where id = ${input.coachId}::uuid
    `);
  } catch (e) {
    throw new Error(
      `Failed to store coverage gap action — apply migration 0072_coach_coverage_gap_overrides.sql (${
        e instanceof Error ? e.message : String(e)
      })`,
    );
  }
  return { ok: true, overrides };
}

function sourceHint(dataType: CoverageDataType, externalMatchId: string | null): string {
  if (dataType === "historical_rankings") {
    return "World Rugby rankings API (mru date; men's floor ~2020-09)";
  }
  if (externalMatchId?.startsWith("rdb:game:")) {
    if (dataType === "team_stats") return "RWC event rollup / Rugby Data / SDMS";
    if (dataType === "player_ratings") return "fixture_players → performance → match rating model";
    if (dataType === "lineups") return "rugbydatabase RWC import";
  }
  if (dataType === "team_stats") return "SDMS / Rugby Data / Planet Rugby / event rollup";
  if (dataType === "player_ratings") return "player_match_performance_stats → rating model";
  if (dataType === "lineups") return "SDMS / Rugby Data / Planet Rugby lineup import";
  return "Rugby365 import sources";
}

export async function listCoachCoverageGaps(
  coachId: string,
  dataType: CoverageDataType,
): Promise<CoachCoverageGapRow[]> {
  const matches = await loadCoachEligibleMatches(coachId);
  if (!matches.length) return [];
  const ids = matches.map((m) => m.id);
  const db = getDb();
  const overrides = await loadOverrides(coachId);

  const fxMeta = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      competitionId: fixtures.competitionId,
      externalMatchId: fixtures.externalMatchId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .where(inArray(fixtures.id, ids));
  const metaById = new Map(fxMeta.map((f) => [f.id, f]));

  const teamIds = [
    ...new Set(
      fxMeta.flatMap((f) => [f.homeTeamId, f.awayTeamId]).filter(Boolean) as string[],
    ),
  ];
  const teamRows = teamIds.length
    ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
    : [];
  const teamName = new Map(teamRows.map((t) => [t.id, t.name]));

  const compIds = [...new Set(fxMeta.map((f) => f.competitionId).filter(Boolean) as string[])];
  const comps = compIds.length
    ? await db
        .select({ id: competitions.id, name: competitions.name })
        .from(competitions)
        .where(inArray(competitions.id, compIds))
    : [];
  const compName = new Map(comps.map((c) => [c.id, c.name]));

  let presentIds = new Set<string>();
  if (dataType === "lineups") {
    const rows = await db
      .selectDistinct({ fixtureId: fixturePlayers.fixtureId })
      .from(fixturePlayers)
      .where(inArray(fixturePlayers.fixtureId, ids));
    presentIds = new Set(rows.map((r) => r.fixtureId));
  } else if (dataType === "team_stats") {
    const rows = await db
      .selectDistinct({ fixtureId: teamMatchStats.fixtureId })
      .from(teamMatchStats)
      .where(inArray(teamMatchStats.fixtureId, ids));
    presentIds = new Set(rows.map((r) => r.fixtureId));
  } else if (dataType === "player_ratings") {
    const rows = await db
      .selectDistinct({ fixtureId: playerMatchRatings.fixtureId })
      .from(playerMatchRatings)
      .where(inArray(playerMatchRatings.fixtureId, ids));
    presentIds = new Set(rows.map((r) => r.fixtureId));
  } else if (dataType === "historical_rankings") {
    for (const m of matches) {
      if (!m.teamId || !m.kickoffAt) continue;
      const rank = await getTeamRankingAtDate({ teamId: m.teamId, asOf: m.kickoffAt });
      if (rank) presentIds.add(m.id);
    }
  } else {
    // matches — all eligible are "present"
    presentIds = new Set(ids);
  }

  const missingLabel: Record<CoverageDataType, string> = {
    matches: "Match link",
    lineups: "Lineups",
    team_stats: "Team match stats",
    player_ratings: "Player match ratings",
    historical_rankings: "Historical team ranking at match date",
  };

  const gaps: CoachCoverageGapRow[] = [];
  for (const m of matches) {
    const meta = metaById.get(m.id);
    const key = overrideKey(dataType, m.id);
    const ov = overrides[key];
    const present = presentIds.has(m.id);
    if (present && !ov) continue;

    let status: CoverageGapStatus = present ? "present" : "missing";
    if (ov?.status === "ignored") status = "ignored";
    if (ov?.status === "unavailable") status = "unavailable";
    if (present) continue;
    if (status === "ignored" || status === "unavailable") {
      // still list so editors can clear
    }

    const home = meta?.homeTeamId ? teamName.get(meta.homeTeamId) : null;
    const away = meta?.awayTeamId ? teamName.get(meta.awayTeamId) : null;
    const matchLabel =
      home && away ? `${home} v ${away}` : m.slug.replace(/-/g, " ");

    gaps.push({
      fixtureId: m.id,
      match: matchLabel,
      date: m.kickoffAt?.toISOString().slice(0, 10) ?? null,
      opponent: m.opponentName,
      competition:
        (meta?.competitionId ? compName.get(meta.competitionId) : null) ??
        m.competitionName ??
        null,
      missingData: missingLabel[dataType],
      availableSource: sourceHint(dataType, meta?.externalMatchId ?? null),
      status,
    });
  }

  return gaps.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

export async function countPresentHistoricalRankings(
  coachId: string,
): Promise<{ have: number; of: number }> {
  const matches = await loadCoachEligibleMatches(coachId);
  let have = 0;
  for (const m of matches) {
    if (!m.teamId || !m.kickoffAt) continue;
    const rank = await getTeamRankingAtDate({ teamId: m.teamId, asOf: m.kickoffAt });
    if (rank) have += 1;
  }
  return { have, of: matches.length };
}
