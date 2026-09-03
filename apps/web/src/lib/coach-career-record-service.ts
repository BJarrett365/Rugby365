/**
 * Coach Career Record — calculated from Rugby365 fixtures during eligible tenures.
 * Source of truth: team + role eligibility + start/end dates (not manual coach-match rows).
 */

import { and, asc, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { fixtures, teamMatchStats, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "./db";
import { getCoachDetail, type CoachingStaffRow } from "./coach-admin-service";
import { isRoleEligibleForCareerRecord } from "./coach-role-eligibility";
import { getCoachPerspectiveResult } from "./coach-perspective-result";
import { allRelatedTeamIds, relatedTeamIdsBySource } from "./coach-team-aliases";
import { getTeamRankingAtDate } from "./world-rugby-rankings-at-date";
import {
  COACH_IMPACT_VERSION,
  formatImpactChange,
  formatImpactValue,
  impactConfidenceBand,
  impactMetricDef,
  type ImpactMetricKey,
} from "./coach-impact-engine";

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
  opponentTeamId: string | null;
  opponentName: string | null;
  forScore: number;
  againstScore: number;
  result: "W" | "D" | "L";
  margin: number;
  side: "home" | "away";
  venueType: "H" | "A" | "N";
  tenureId?: string | null;
  /** Audit flags from getCoachPerspectiveResult. */
  dataIssues?: string[];
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

function resolveCoachTeamIdForRow(
  m: {
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeCoachId: string | null;
    awayCoachId: string | null;
  },
  coachId: string,
  tenure: CoachingStaffRow | null,
): string | null {
  if (tenure?.teamId) return tenure.teamId;
  if (m.homeCoachId === coachId && m.homeTeamId) return m.homeTeamId;
  if (m.awayCoachId === coachId && m.awayTeamId) return m.awayTeamId;
  return null;
}

function eligibleTenures(assignments: CoachingStaffRow[]): CoachingStaffRow[] {
  return assignments.filter((a) =>
    isRoleEligibleForCareerRecord({
      role: a.role,
      eligibleForCareerRecord: a.eligibleForCareerRecord,
      isPrimaryCoach: a.isPrimaryCoach,
    }),
  );
}

type LoadEligibleMatchOptions = {
  filter?: CoachCareerFilter;
  teamId?: string;
  competitionName?: string;
  primaryOnly?: boolean;
  limit?: number;
  /** Prefer FK links only (legacy). Default false = tenure-window query. */
  fixtureCoachFkOnly?: boolean;
  /** Inclusive cutoff — only matches with kickoffAt <= asOfDate. */
  asOfDate?: Date | null;
};

const ELIGIBLE_MATCH_CACHE_MS = 15_000;
const eligibleMatchCache = new Map<
  string,
  { expires: number; promise: Promise<CoachEligibleMatch[]> }
>();

function eligibleMatchCacheKey(coachId: string, options: LoadEligibleMatchOptions): string {
  return JSON.stringify({
    coachId,
    filter: options.filter ?? null,
    teamId: options.teamId ?? null,
    competitionName: options.competitionName ?? null,
    primaryOnly: options.primaryOnly ?? null,
    fixtureCoachFkOnly: Boolean(options.fixtureCoachFkOnly),
    asOfDate: options.asOfDate ? options.asOfDate.toISOString() : null,
  });
}

export async function loadCoachEligibleMatches(
  coachId: string,
  options: LoadEligibleMatchOptions = {},
): Promise<CoachEligibleMatch[]> {
  const { limit, ...rest } = options;
  const key = eligibleMatchCacheKey(coachId, rest);
  const now = Date.now();
  let entry = eligibleMatchCache.get(key);
  if (!entry || entry.expires <= now) {
    const promise = loadCoachEligibleMatchesUncached(coachId, rest);
    entry = { expires: now + ELIGIBLE_MATCH_CACHE_MS, promise };
    eligibleMatchCache.set(key, entry);
    void promise.catch(() => eligibleMatchCache.delete(key));
  }
  let out = await entry.promise;
  if (limit && limit > 0) out = out.slice(-limit);
  return out;
}

function resolveTenureStart(
  tenure: { startDate: string | null; isCurrent: boolean; teamId: string },
  detail: { coach: { appointedOn?: string | Date | null }; assignments: CoachingStaffRow[] },
): Date | null {
  if (tenure.startDate) return new Date(`${tenure.startDate}T00:00:00.000Z`);
  if (!tenure.isCurrent) return null;
  const sibling = detail.assignments
    .filter((row) => row.teamId === tenure.teamId && row.startDate)
    .map((row) => row.startDate as string)
    .sort()[0];
  if (sibling) return new Date(`${sibling}T00:00:00.000Z`);
  const appointed = detail.coach.appointedOn ? String(detail.coach.appointedOn).slice(0, 10) : null;
  if (appointed) return new Date(`${appointed}T00:00:00.000Z`);
  return null;
}

async function loadCoachEligibleMatchesUncached(
  coachId: string,
  options: LoadEligibleMatchOptions = {},
): Promise<CoachEligibleMatch[]> {
  const db = getDb();
  const detail = await getCoachDetail(coachId);
  if (!detail) return [];

  const tenures = eligibleTenures(detail.assignments);
  if (options.primaryOnly === false) {
    // include all assignments when explicitly requested
  }

  const homeTeams = alias(teams, "career_home");
  const awayTeams = alias(teams, "career_away");

  if (options.fixtureCoachFkOnly) {
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
        isNeutralVenue: fixtures.isNeutralVenue,
      })
      .from(fixtures)
      .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
      .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
      .where(or(eq(fixtures.homeCoachId, coachId), eq(fixtures.awayCoachId, coachId)))
      .orderBy(asc(fixtures.kickoffAt));

    let fkOut = mapCompletedRows(rows, coachId, options, detail, null, null);
    if (options.asOfDate) {
      const cut = options.asOfDate.getTime();
      fkOut = fkOut.filter((m) => (m.kickoffAt?.getTime() ?? 0) <= cut);
    }
    if (options.limit && options.limit > 0) fkOut = fkOut.slice(-options.limit);
    return fkOut;
  }

  const applicable = tenures.filter((tenure) => {
    if (options.filter === "current_team") {
      const current = detail.assignments.find((a) => a.isCurrent);
      if (!current || tenure.teamId !== current.teamId) return false;
    }
    if (options.teamId && tenure.teamId !== options.teamId) return false;
    if (resolveTenureStart(tenure, detail) == null) return false;
    return true;
  });

  const tenureTeamIds = [
    ...new Set(applicable.map((tenure) => tenure.teamId).filter((id): id is string => Boolean(id))),
  ];
  const relatedByTenure = await relatedTeamIdsBySource(tenureTeamIds);
  const teamIds = [...new Set(relatedByTenure.size ? [...relatedByTenure.values()].flat() : tenureTeamIds)];
  const byId = new Map<string, CoachEligibleMatch>();
  if (teamIds.length > 0) {
    const fromTimes = applicable
      .map((tenure) => resolveTenureStart(tenure, detail)?.getTime())
      .filter((value): value is number => value != null);
    if (fromTimes.length === 0) {
      // Undated current rows must not pull a team's entire fixture history.
    } else {
      const minFrom = new Date(Math.min(...fromTimes));
      const dateConds = [gte(fixtures.kickoffAt, minFrom)];
      if (options.asOfDate) dateConds.push(lte(fixtures.kickoffAt, options.asOfDate));

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
        .where(
          and(
            or(inArray(fixtures.homeTeamId, teamIds), inArray(fixtures.awayTeamId, teamIds)),
            ...dateConds,
          ),
        )
        .orderBy(asc(fixtures.kickoffAt));

      for (const tenure of applicable) {
        const from = resolveTenureStart(tenure, detail);
        if (!from) continue;
        const to = tenure.endDate ? new Date(`${tenure.endDate}T23:59:59.999Z`) : null;
        const siblingIds = new Set(
          (tenure.teamId ? relatedByTenure.get(tenure.teamId) : null) ??
            (tenure.teamId ? [tenure.teamId] : []),
        );
        const tenureRows = rows.filter((m) => {
          const onTenureTeam =
            (m.homeTeamId && siblingIds.has(m.homeTeamId)) ||
            (m.awayTeamId && siblingIds.has(m.awayTeamId));
          if (!onTenureTeam) return false;
          const kickoff = m.kickoffAt?.getTime() ?? 0;
          if (kickoff < from.getTime()) return false;
          if (to && kickoff > to.getTime()) return false;
          return true;
        });
        for (const m of mapCompletedRows(tenureRows, coachId, options, detail, tenure, siblingIds)) {
          if (!byId.has(m.id)) byId.set(m.id, m);
        }
      }
    }
  }

  let out = [...byId.values()].sort(
    (a, b) => (a.kickoffAt?.getTime() ?? 0) - (b.kickoffAt?.getTime() ?? 0),
  );
  if (out.length === 0 && !options.fixtureCoachFkOnly) {
    return loadCoachEligibleMatchesUncached(coachId, { ...options, fixtureCoachFkOnly: true });
  }
  if (options.asOfDate) {
    const cut = options.asOfDate.getTime();
    out = out.filter((m) => (m.kickoffAt?.getTime() ?? 0) <= cut);
  }
  if (options.limit && options.limit > 0) out = out.slice(-options.limit);
  return out;
}

function mapCompletedRows(
  rows: Array<{
    id: string;
    slug: string;
    kickoffAt: Date | null;
    status: string | null;
    competitionName: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
    homeScore: number | null;
    awayScore: number | null;
    homeCoachId: string | null;
    awayCoachId: string | null;
    isNeutralVenue?: boolean | null;
  }>,
  coachId: string,
  options: {
    filter?: CoachCareerFilter;
    teamId?: string;
    competitionName?: string;
  },
  detail: NonNullable<Awaited<ReturnType<typeof getCoachDetail>>>,
  tenure: CoachingStaffRow | null,
  relatedTeamIds: Set<string> | null,
): CoachEligibleMatch[] {
  const out: CoachEligibleMatch[] = [];
  for (const m of rows) {
    if (!isCompletedStatus(m.status)) continue;
    if (m.homeScore == null || m.awayScore == null) continue;

    const siblingIds =
      relatedTeamIds && relatedTeamIds.size > 0
        ? relatedTeamIds
        : tenure?.teamId
          ? new Set([tenure.teamId])
          : null;
    const coachTeamId = siblingIds
      ? m.homeTeamId && siblingIds.has(m.homeTeamId)
        ? m.homeTeamId
        : m.awayTeamId && siblingIds.has(m.awayTeamId)
          ? m.awayTeamId
          : tenure?.teamId ?? null
      : (m.homeCoachId === coachId
          ? m.homeTeamId
          : m.awayCoachId === coachId
            ? m.awayTeamId
            : tenure?.teamId ?? null);

    const perspective = getCoachPerspectiveResult(
      {
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        isNeutralVenue: m.isNeutralVenue ?? false,
        competitionName: m.competitionName,
        kickoffAt: m.kickoffAt,
      },
      coachTeamId,
    );

    if (
      perspective.pointsFor == null ||
      perspective.pointsAgainst == null ||
      perspective.result == null
    ) {
      continue;
    }

    const teamId = perspective.coachTeamId;
    const side: "home" | "away" = perspective.venueType === "A" ? "away" : "home";
    const forScore = perspective.pointsFor;
    const againstScore = perspective.pointsAgainst;

    if (options.teamId && teamId !== options.teamId && !(relatedTeamIds?.has(options.teamId))) continue;
    if (options.filter === "current_team") {
      const current = detail.assignments.find((a) => a.isCurrent);
      if (!current) continue;
      if (relatedTeamIds && relatedTeamIds.size > 0) {
        if (!teamId || !relatedTeamIds.has(teamId)) continue;
      } else if (teamId !== current.teamId) continue;
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
      teamName: perspective.coachTeamName,
      opponentTeamId: perspective.opponentTeamId,
      opponentName: perspective.opponentName,
      forScore,
      againstScore,
      result: perspective.result,
      margin: forScore - againstScore,
      side,
      venueType: perspective.venueType ?? (side === "home" ? "H" : "A"),
      tenureId: tenure?.id ?? null,
      dataIssues: perspective.dataIssues.length ? perspective.dataIssues : undefined,
    });
  }
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

  for (const m of matches) {
    pointsFor += m.forScore;
    pointsAgainst += m.againstScore;
    if (m.result === "W") {
      wins += 1;
      streak += 1;
      longestWinStreak = Math.max(longestWinStreak, streak);
      if (!biggestWin || m.margin > biggestWin.margin) biggestWin = m;
    } else if (m.result === "D") {
      draws += 1;
      streak = 0;
    } else {
      losses += 1;
      streak = 0;
      if (!biggestLoss || m.margin < biggestLoss.margin) biggestLoss = m;
    }
  }

  let currentWinStreak = 0;
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
    partial: Boolean(meta.partial) || (played > 0 && played < 40),
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
    partial: detail?.coach.careerRecordPartial ?? matches.length > 0,
    notes: detail?.coach.careerRecordNotes ?? null,
  });
}

export type CoachImpactRow = {
  key: ImpactMetricKey | string;
  metric: string;
  before: number | string | null;
  under: number | string | null;
  /** Signed numeric change for engines (win rate = percentage points; rank = places gained). */
  change: number | string | null;
  /** Public display label e.g. "+23 pts", "▲ 6 places". */
  changeLabel: string | null;
  improved: boolean | null;
  confidencePct: number | null;
};

export type CoachImpactResult = {
  modelVersion: string;
  baselineLabel: string;
  underLabel: string;
  beforeCount: number;
  underCount: number;
  rows: CoachImpactRow[];
  confidence: "high" | "medium" | "low" | "none";
  confidencePct: number;
  enoughData: boolean;
  tenureStart: string | null;
  teamId: string | null;
  teamName: string | null;
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function winRateOf(matches: CoachEligibleMatch[]): number | null {
  if (!matches.length) return null;
  return (matches.filter((m) => m.result === "W").length / matches.length) * 100;
}

async function avgTriesPerGame(
  teamId: string,
  fixtureIds: string[],
): Promise<{ avg: number | null; coveragePct: number }> {
  if (!fixtureIds.length) return { avg: null, coveragePct: 0 };
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: teamMatchStats.fixtureId,
      tries: teamMatchStats.tries,
    })
    .from(teamMatchStats)
    .where(and(eq(teamMatchStats.teamId, teamId), inArray(teamMatchStats.fixtureId, fixtureIds)));
  const byFx = new Map<string, number>();
  for (const r of rows) {
    if (!byFx.has(r.fixtureId)) byFx.set(r.fixtureId, r.tries ?? 0);
  }
  const coveragePct = Math.round((byFx.size / fixtureIds.length) * 100);
  if (byFx.size < Math.min(5, fixtureIds.length)) {
    return { avg: null, coveragePct };
  }
  return {
    avg: avg([...byFx.values()]),
    coveragePct,
  };
}

function buildImpactRow(
  key: ImpactMetricKey,
  beforeRaw: number | null,
  underRaw: number | null,
  confidencePct: number | null,
): CoachImpactRow {
  const def = impactMetricDef(key);
  const formatted = formatImpactChange(def, beforeRaw, underRaw);
  return {
    key,
    metric: def.label,
    before: formatImpactValue(def.format, beforeRaw),
    under: formatImpactValue(def.format, underRaw),
    change: formatted.raw,
    changeLabel: formatted.label,
    improved: formatted.improved,
    confidencePct,
  };
}

export async function getCoachImpact(
  coachId: string,
  options: { beforeN?: number; underMode?: "tenure" | "first_n"; underN?: number } = {},
): Promise<CoachImpactResult> {
  const beforeN = options.beforeN ?? 20;
  const underN = options.underN ?? 20;
  const detail = await getCoachDetail(coachId);
  const current = detail?.assignments.find((a) => a.isCurrent);
  const tenureStart =
    current?.startDate ??
    (detail?.coach.appointedOn ? String(detail.coach.appointedOn).slice(0, 10) : null);
  const all = await loadCoachEligibleMatches(coachId, {
    primaryOnly: true,
    filter: "current_team",
  });
  const siblingIds = current?.teamId
    ? new Set(await allRelatedTeamIds([current.teamId]))
    : new Set<string>();

  const empty = (label: string): CoachImpactResult => ({
    modelVersion: COACH_IMPACT_VERSION,
    baselineLabel: label,
    underLabel: "Under Coach",
    beforeCount: 0,
    underCount: 0,
    rows: [],
    confidence: "none",
    confidencePct: 0,
    enoughData: false,
    tenureStart: tenureStart,
    teamId: current?.teamId ?? null,
    teamName: current?.teamName ?? null,
  });

  if (!tenureStart || !current?.teamId || all.length === 0) {
    return empty(`vs Before Appointment (Prev ${beforeN} Matches)`);
  }

  const start = new Date(`${tenureStart}T00:00:00.000Z`);
  const impactTeamIds = [...siblingIds];
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
        or(inArray(fixtures.homeTeamId, impactTeamIds), inArray(fixtures.awayTeamId, impactTeamIds)),
        lte(fixtures.kickoffAt, start),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(beforeN * 3);

  const beforeMatches: CoachEligibleMatch[] = [];
  for (const m of teamFixtures) {
    if (!isCompletedStatus(m.status)) continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    // Exclude appointment-day match from baseline (belongs under coach if linked)
    if (m.kickoffAt && m.kickoffAt.getTime() >= start.getTime()) continue;
    const coachTeamId =
      m.homeTeamId && siblingIds.has(m.homeTeamId)
        ? m.homeTeamId
        : m.awayTeamId && siblingIds.has(m.awayTeamId)
          ? m.awayTeamId
          : current.teamId;
    const perspective = getCoachPerspectiveResult(
      {
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeTeamName: m.homeTeamName,
        awayTeamName: m.awayTeamName,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        kickoffAt: m.kickoffAt,
      },
      coachTeamId,
    );
    if (
      perspective.pointsFor == null ||
      perspective.pointsAgainst == null ||
      perspective.result == null
    ) {
      continue;
    }
    const side: "home" | "away" = perspective.venueType === "A" ? "away" : "home";
    beforeMatches.push({
      id: m.id,
      slug: "",
      kickoffAt: m.kickoffAt,
      competitionName: null,
      teamId: current.teamId,
      teamName: current.teamName,
      opponentTeamId: perspective.opponentTeamId,
      opponentName: perspective.opponentName,
      forScore: perspective.pointsFor,
      againstScore: perspective.pointsAgainst,
      result: perspective.result,
      margin: perspective.pointsFor - perspective.pointsAgainst,
      side,
      venueType: perspective.venueType ?? (side === "home" ? "H" : "A"),
    });
    if (beforeMatches.length >= beforeN) break;
  }
  beforeMatches.reverse();

  let under = all.filter((m) => {
    if (!m.teamId || !siblingIds.has(m.teamId)) return false;
    const t = m.kickoffAt?.getTime() ?? 0;
    return t >= start.getTime();
  });
  if (options.underMode === "first_n") under = under.slice(0, underN);

  const beforeWr = winRateOf(beforeMatches);
  const underWr = winRateOf(under);
  const beforePf = avg(beforeMatches.map((m) => m.forScore));
  const underPf = avg(under.map((m) => m.forScore));
  const beforePa = avg(beforeMatches.map((m) => m.againstScore));
  const underPa = avg(under.map((m) => m.againstScore));

  const [beforeTries, underTries, beforeRank, underRank] = await Promise.all([
    avgTriesPerGame(
      current.teamId,
      beforeMatches.map((m) => m.id),
    ),
    avgTriesPerGame(
      current.teamId,
      under.map((m) => m.id),
    ),
    getTeamRankingAtDate({ teamId: current.teamId, asOf: start }).catch(() => null),
    getTeamRankingAtDate({
      teamId: current.teamId,
      asOf: under.at(-1)?.kickoffAt ?? new Date(),
    }).catch(() => null),
  ]);

  const triesCoveragePct = Math.round(
    ((beforeTries.coveragePct ?? 0) + (underTries.coveragePct ?? 0)) / 2,
  );
  const band = impactConfidenceBand({
    beforeCount: beforeMatches.length,
    underCount: under.length,
    rankingCoverage: Boolean(beforeRank && underRank),
    triesCoveragePct,
  });

  const rows: CoachImpactRow[] = [
    buildImpactRow("win_rate", beforeWr, underWr, band.confidencePct),
    buildImpactRow(
      "world_rank",
      beforeRank?.position ?? null,
      underRank?.position ?? null,
      beforeRank && underRank ? band.confidencePct : Math.min(band.confidencePct, 50),
    ),
    buildImpactRow("points_per_game", beforePf, underPf, band.confidencePct),
    buildImpactRow("points_against_per_game", beforePa, underPa, band.confidencePct),
    buildImpactRow(
      "tries_per_game",
      beforeTries.avg,
      underTries.avg,
      Math.min(band.confidencePct, 40 + Math.round(triesCoveragePct * 0.4)),
    ),
  ].filter((r) => r.before != null || r.under != null);

  const surname =
    (detail?.coach.fullName || detail?.coach.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .at(-1) ?? "Coach";
  const underLabel = `Under ${surname}`;

  return {
    modelVersion: COACH_IMPACT_VERSION,
    baselineLabel: `vs Before Appointment (Prev ${beforeN} Matches)`,
    underLabel,
    beforeCount: beforeMatches.length,
    underCount: under.length,
    rows,
    confidence: band.confidence,
    confidencePct: band.confidencePct,
    enoughData: band.enoughData,
    tenureStart: current.startDate,
    teamId: current.teamId,
    teamName: current.teamName,
  };
}
