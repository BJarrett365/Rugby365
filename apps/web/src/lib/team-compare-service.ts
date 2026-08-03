/**
 * Team vs team compare packet + CMS head-to-head for Compare Teams MVP.
 */
import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { getDb } from "./db";
import { getTeamCompareSidePacket } from "./team-squad-intelligence-service";
import { buildTeamCompareMetrics } from "./team-compare-metrics";
import {
  buildDepthSummary,
  buildModelledStartingXv,
  buildPositionBattles,
  summarizeXv,
} from "./team-compare-intelligence";
import { formatGbpCompact } from "./player-value-math";
import type {
  TeamComparePayload,
  TeamHeadToHeadSummary,
} from "./team-compare-types";
import type { TeamCompareSidePacket } from "./team-squad-intelligence-types";

export type { TeamComparePayload, TeamHeadToHeadSummary } from "./team-compare-types";

async function loadCmsHeadToHead(
  teamA: TeamCompareSidePacket,
  teamB: TeamCompareSidePacket,
): Promise<TeamHeadToHeadSummary> {
  const db = getDb();
  const rows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.status, "full_time"),
        or(
          and(eq(fixtures.homeTeamId, teamA.id), eq(fixtures.awayTeamId, teamB.id)),
          and(eq(fixtures.homeTeamId, teamB.id), eq(fixtures.awayTeamId, teamA.id)),
        ),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(200);

  let teamAWins = 0;
  let teamBWins = 0;
  let draws = 0;
  let biggestWinForA: TeamHeadToHeadSummary["biggestWinForA"] = null;
  let biggestWinForB: TeamHeadToHeadSummary["biggestWinForB"] = null;
  let bestMarginA = 0;
  let bestMarginB = 0;

  for (const row of rows) {
    const aIsHome = row.homeTeamId === teamA.id;
    const aScore = aIsHome ? row.homeScore : row.awayScore;
    const bScore = aIsHome ? row.awayScore : row.homeScore;
    const margin = (aScore ?? 0) - (bScore ?? 0);
    if (margin > 0) {
      teamAWins += 1;
      if (margin > bestMarginA) {
        bestMarginA = margin;
        biggestWinForA = {
          score: `${aScore}-${bScore}`,
          date: row.kickoffAt?.toISOString() ?? null,
        };
      }
    } else if (margin < 0) {
      teamBWins += 1;
      const bMargin = -margin;
      if (bMargin > bestMarginB) {
        bestMarginB = bMargin;
        biggestWinForB = {
          score: `${bScore}-${aScore}`,
          date: row.kickoffAt?.toISOString() ?? null,
        };
      }
    } else {
      draws += 1;
    }
  }

  const last = rows[0] ?? null;
  const lastHomeName =
    last?.homeTeamId === teamA.id
      ? teamA.name
      : last?.homeTeamId === teamB.id
        ? teamB.name
        : "Home";
  const lastAwayName =
    last?.awayTeamId === teamA.id
      ? teamA.name
      : last?.awayTeamId === teamB.id
        ? teamB.name
        : "Away";

  return {
    totalMeetings: rows.length,
    teamAWins,
    teamBWins,
    draws,
    lastMeeting: last
      ? {
          date: last.kickoffAt?.toISOString() ?? null,
          competitionName: last.competitionName,
          homeTeam: lastHomeName,
          awayTeam: lastAwayName,
          homeScore: last.homeScore ?? 0,
          awayScore: last.awayScore ?? 0,
          fixtureSlug: last.slug,
        }
      : null,
    biggestWinForA,
    biggestWinForB,
  };
}

export async function compareTeamsBySlug(
  slugA: string,
  slugB: string,
): Promise<TeamComparePayload | null> {
  if (!slugA.trim() || !slugB.trim() || slugA.trim() === slugB.trim()) return null;

  const [teamA, teamB] = await Promise.all([
    getTeamCompareSidePacket(slugA),
    getTeamCompareSidePacket(slugB),
  ]);
  if (!teamA || !teamB) return null;

  const headToHead = await loadCmsHeadToHead(teamA, teamB);

  const startingXvA = buildModelledStartingXv(teamA.squad);
  const startingXvB = buildModelledStartingXv(teamB.squad);
  const xvA = summarizeXv(startingXvA);
  const xvB = summarizeXv(startingXvB);
  const positionBattles = buildPositionBattles(teamA.squad, teamB.squad);
  const depthA = buildDepthSummary(teamA.squad);
  const depthB = buildDepthSummary(teamB.squad);
  const positionScore = {
    a: positionBattles.filter((b) => b.winner === "a").length,
    b: positionBattles.filter((b) => b.winner === "b").length,
    draws: positionBattles.filter((b) => b.winner === "draw").length,
  };

  const baseMetrics = buildTeamCompareMetrics(teamA, teamB);
  const depthMetrics = [
    {
      key: "depthScore",
      label: "Depth Score",
      group: "squad" as const,
      a: depthA.depthScore,
      b: depthB.depthScore,
      format: "number" as const,
    },
    {
      key: "experience",
      label: "Experience Score",
      group: "squad" as const,
      a: depthA.experienceScore,
      b: depthB.experienceScore,
      format: "number" as const,
    },
    {
      key: "youthPct",
      label: "Under-23 %",
      group: "squad" as const,
      a: depthA.youthPct,
      b: depthB.youthPct,
      format: "pct" as const,
    },
    {
      key: "xvValueCompare",
      label: "Modelled XV Value (£)",
      group: "value" as const,
      a: xvA.valueGbp,
      b: xvB.valueGbp,
      format: "gbp" as const,
    },
  ];

  return {
    teamA,
    teamB,
    metrics: [...baseMetrics, ...depthMetrics],
    headToHead,
    startingXvA,
    startingXvB,
    xvSummaryA: {
      valueGbp: xvA.valueGbp,
      valueLabel: formatGbpCompact(xvA.valueGbp),
      averageRating: xvA.averageRating,
      averageAge: xvA.averageAge,
      filled: xvA.filled,
    },
    xvSummaryB: {
      valueGbp: xvB.valueGbp,
      valueLabel: formatGbpCompact(xvB.valueGbp),
      averageRating: xvB.averageRating,
      averageAge: xvB.averageAge,
      filled: xvB.filled,
    },
    positionBattles,
    depthA,
    depthB,
    positionScore,
  };
}
