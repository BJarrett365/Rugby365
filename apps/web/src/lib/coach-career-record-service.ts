/**
 * Coach Career Record — calculated from Rugby365 fixtures linked to a coach.
 * Default eligibility: primary / head-coach style roles only when tenure metadata exists;
 * otherwise all fixtures where the coach is home/away coach.
 */

import { and, asc, desc, eq, lte, or } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { getCoachDetail } from "./coach-admin-service";

const COMPLETED = new Set(["completed", "finished", "result", "full_time", "ft"]);

export type CoachCareerFilter =
  | "all"
  | "current_team"
  | "international"
  | "club"
  | "season"
  | "competition"
  | "team";

export type CoachEligibleMatch = {
  id: string;
  slug: string;
  kickoffAt: Date | null;
  competitionName: string | null;
  teamId: string | null;
  teamName: string | null;
  opponentName: string | null;
  forScore: number;
  againstScore: number;
  result: "W" | "D" | "L";
  margin: number;
  side: "home" | "away";
};

export type CoachCareerRecord = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winRate: number | null;
  winRateExact: number | null;
  pointsFor: number;
  pointsAgainst: number;
  pointsForPerGame: number | null;
  pointsAgainstPerGame: number | null;
  biggestWin: CoachEligibleMatch | null;
  biggestLoss: CoachEligibleMatch | null;
  longestWinStreak: number;
  currentWinStreak: number;
  form: Array<"W" | "D" | "L">;
  partial: boolean;
  notes: string | null;
  reconciled: boolean;
};

function isCompletedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().replace(/\s+/g, "_");
  return COMPLETED.has(s) || s.includes("complete") || s.includes("finished");
}

function outcome(forScore: number, againstScore: number): "W" | "D" | "L" {
  if (forScore > againstScore) return "W";
  if (forScore < againstScore) return "L";
  return "D";
}

export async function loadCoachEligibleMatches(
  coachId: string,
  options: {
    filter?: CoachCareerFilter;
    teamId?: string;
    competitionName?: string;
    primaryOnly?: boolean;
    limit?: number;
  } = {},
): Promise<CoachEligibleMatch[]> {
  const db = getDb();
  const detail = await getCoachDetail(coachId);
  const primaryOnly = options.primaryOnly !== false;

  const eligibleTeamIds = new Set<string>();
  if (detail) {
    for (const a of detail.assignments) {
      const roleOk =
        !primaryOnly ||
        a.role === "head_coach" ||
        a.isCurrent ||
        // legacy rows without primary flag: include head_coach-like labels
        a.roleLabel.toLowerCase().includes("head");
      // CoachingStaffRow may not have new fields until mapped — treat all current head roles eligible
      if (roleOk) eligibleTeamIds.add(a.teamId);
    }
  }

  const homeTeams = alias(teams, "career_home");
  const awayTeams = alias(teams, "career_away");

  const rows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      competitionName: fixtures.competitionName,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeCoachId: fixtures.homeCoachId,
      awayCoachId: fixtures.awayCoachId,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(or(eq(fixtures.homeCoachId, coachId), eq(fixtures.awayCoachId, coachId)))
    .orderBy(asc(fixtures.kickoffAt));

  const out: CoachEligibleMatch[] = [];
  for (const m of rows) {
    if (!isCompletedStatus(m.status)) continue;
    if (m.homeScore == null || m.awayScore == null) continue;

    const side: "home" | "away" = m.homeCoachId === coachId ? "home" : "away";
    const teamId = side === "home" ? m.homeTeamId : m.awayTeamId;
    const teamName = side === "home" ? m.homeTeamName : m.awayTeamName;
    const opponentName = side === "home" ? m.awayTeamName : m.homeTeamName;
    const forScore = side === "home" ? m.homeScore : m.awayScore;
    const againstScore = side === "home" ? m.awayScore : m.homeScore;

    if (options.teamId && teamId !== options.teamId) continue;
    if (options.filter === "current_team" && detail) {
      const current = detail.assignments.find((a) => a.isCurrent);
      if (!current || teamId !== current.teamId) continue;
    }
    if (options.competitionName && m.competitionName) {
      if (!m.competitionName.toLowerCase().includes(options.competitionName.toLowerCase())) {
        continue;
      }
    }

    out.push({
      id: m.id,
      slug: m.slug,
      kickoffAt: m.kickoffAt,
      competitionName: m.competitionName,
      teamId,
      teamName,
      opponentName,
      forScore,
      againstScore,
      result: outcome(forScore, againstScore),
      margin: forScore - againstScore,
      side,
    });
  }

  if (options.limit && options.limit > 0) return out.slice(-options.limit);
  return out;
}

export function computeCareerRecord(
  matches: CoachEligibleMatch[],
  meta: { partial?: boolean; notes?: string | null } = {},
): CoachCareerRecord {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let biggestWin: CoachEligibleMatch | null = null;
  let biggestLoss: CoachEligibleMatch | null = null;
  let longestWinStreak = 0;
  let streak = 0;
  let currentWinStreak = 0;
  let trailing = true;

  for (const m of matches) {
    pointsFor += m.forScore;
    pointsAgainst += m.againstScore;
    if (m.result === "W") {
      wins += 1;
      streak += 1;
      longestWinStreak = Math.max(longestWinStreak, streak);
      if (trailing) currentWinStreak += 1;
      if (!biggestWin || m.margin > biggestWin.margin) biggestWin = m;
    } else if (m.result === "D") {
      draws += 1;
      streak = 0;
      trailing = false;
      currentWinStreak = 0;
    } else {
      losses += 1;
      streak = 0;
      trailing = false;
      currentWinStreak = 0;
      if (!biggestLoss || m.margin < biggestLoss.margin) biggestLoss = m;
    }
  }

  // recompute current streak from end
  currentWinStreak = 0;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].result === "W") currentWinStreak += 1;
    else break;
  }

  const played = matches.length;
  const winRateExact = played > 0 ? (wins / played) * 100 : null;
  const form = matches.slice(-8).map((m) => m.result);

  return {
    played,
    wins,
    draws,
    losses,
    winRate: winRateExact != null ? Math.round(winRateExact) : null,
    winRateExact,
    pointsFor,
    pointsAgainst,
    pointsForPerGame: played > 0 ? Math.round((pointsFor / played) * 10) / 10 : null,
    pointsAgainstPerGame: played > 0 ? Math.round((pointsAgainst / played) * 10) / 10 : null,
    biggestWin,
    biggestLoss,
    longestWinStreak,
    currentWinStreak,
    form,
    partial: Boolean(meta.partial),
    notes: meta.notes ?? null,
    reconciled: played === wins + draws + losses,
  };
}

export async function getCoachCareerRecord(
  coachId: string,
  filter: CoachCareerFilter = "all",
): Promise<CoachCareerRecord> {
  const detail = await getCoachDetail(coachId);
  const matches = await loadCoachEligibleMatches(coachId, { filter, primaryOnly: true });
  return computeCareerRecord(matches, {
    partial: detail?.coach.careerRecordPartial ?? false,
    notes: detail?.coach.careerRecordNotes ?? null,
  });
}

export type CoachImpactRow = {
  metric: string;
  before: number | string | null;
  under: number | string | null;
  change: number | string | null;
  improved: boolean | null;
};

export type CoachImpactResult = {
  baselineLabel: string;
  beforeCount: number;
  underCount: number;
  rows: CoachImpactRow[];
  confidence: "high" | "medium" | "low" | "none";
  enoughData: boolean;
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function winRateOf(matches: CoachEligibleMatch[]): number | null {
  if (!matches.length) return null;
  return (matches.filter((m) => m.result === "W").length / matches.length) * 100;
}

export async function getCoachImpact(
  coachId: string,
  options: { beforeN?: number; underMode?: "tenure" | "first_n"; underN?: number } = {},
): Promise<CoachImpactResult> {
  const beforeN = options.beforeN ?? 20;
  const underN = options.underN ?? 20;
  const detail = await getCoachDetail(coachId);
  const current = detail?.assignments.find((a) => a.isCurrent);
  const all = await loadCoachEligibleMatches(coachId, { primaryOnly: true });

  if (!current?.startDate || all.length === 0) {
    return {
      baselineLabel: `vs Before Appointment (Prev ${beforeN} Matches)`,
      beforeCount: 0,
      underCount: 0,
      rows: [],
      confidence: "none",
      enoughData: false,
    };
  }

  const start = new Date(current.startDate);
  // Team matches before appointment: need team fixtures not necessarily with this coach
  const db = getDb();
  const homeTeams = alias(teams, "impact_home");
  const awayTeams = alias(teams, "impact_away");
  const teamFixtures = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(
      and(
        or(eq(fixtures.homeTeamId, current.teamId), eq(fixtures.awayTeamId, current.teamId)),
        lte(fixtures.kickoffAt, start),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(beforeN * 2);

  const beforeMatches: CoachEligibleMatch[] = [];
  for (const m of teamFixtures) {
    if (!isCompletedStatus(m.status)) continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    const side: "home" | "away" = m.homeTeamId === current.teamId ? "home" : "away";
    const forScore = side === "home" ? m.homeScore : m.awayScore;
    const againstScore = side === "home" ? m.awayScore : m.homeScore;
    beforeMatches.push({
      id: m.id,
      slug: "",
      kickoffAt: m.kickoffAt,
      competitionName: null,
      teamId: current.teamId,
      teamName: current.teamName,
      opponentName: side === "home" ? m.awayTeamName : m.homeTeamName,
      forScore,
      againstScore,
      result: outcome(forScore, againstScore),
      margin: forScore - againstScore,
      side,
    });
    if (beforeMatches.length >= beforeN) break;
  }
  beforeMatches.reverse();

  let under = all.filter((m) => m.teamId === current.teamId);
  if (options.underMode === "first_n") under = under.slice(0, underN);

  const enough =
    beforeMatches.length >= Math.min(10, beforeN) && under.length >= Math.min(10, underN);

  const beforeWr = winRateOf(beforeMatches);
  const underWr = winRateOf(under);
  const beforePf = avg(beforeMatches.map((m) => m.forScore));
  const underPf = avg(under.map((m) => m.forScore));
  const beforePa = avg(beforeMatches.map((m) => m.againstScore));
  const underPa = avg(under.map((m) => m.againstScore));

  const row = (
    metric: string,
    before: number | null,
    after: number | null,
    invert = false,
    digits = 1,
  ): CoachImpactRow => {
    if (before == null || after == null) {
      return { metric, before: null, under: null, change: null, improved: null };
    }
    const change = after - before;
    const improved = invert ? change < 0 : change > 0;
    return {
      metric,
      before: Number(before.toFixed(digits)),
      under: Number(after.toFixed(digits)),
      change: Number(change.toFixed(digits)),
      improved: change === 0 ? null : improved,
    };
  };

  return {
    baselineLabel: `vs Before Appointment (Prev ${beforeN} Matches)`,
    beforeCount: beforeMatches.length,
    underCount: under.length,
    rows: [
      {
        metric: "Win Rate",
        before: beforeWr != null ? Math.round(beforeWr) : null,
        under: underWr != null ? Math.round(underWr) : null,
        change:
          beforeWr != null && underWr != null ? Math.round(underWr - beforeWr) : null,
        improved:
          beforeWr != null && underWr != null
            ? underWr === beforeWr
              ? null
              : underWr > beforeWr
            : null,
      },
      row("Points / Game", beforePf, underPf, false, 1),
      row("Points Against / Game", beforePa, underPa, true, 1),
    ],
    confidence: enough ? (beforeMatches.length >= 20 && under.length >= 20 ? "high" : "medium") : "low",
    enoughData: enough,
  };
}
