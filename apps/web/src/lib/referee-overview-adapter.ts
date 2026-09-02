import type { PlayerFormResult } from "./player-form-engine";
import type { RecentFormMetricDisplay, RecentFormMetricTotals } from "./player-form-metric-config";
import type { PlayerRecentMatchRow } from "./player-recent-matches-service";
import type { PlayerNextMatchCard } from "./player-next-match-service";
import type { PublicPlayerKeyAchievementTile } from "./public-player-overview-v2-service";
import type { RatingHistoryPoint } from "./player-rating-history-utils";
import type { RefereeDashboardModel } from "./referee-dashboard-types";

const EMPTY_TOTALS: RecentFormMetricTotals = {
  points: null,
  goalKickMade: null,
  goalKickAttempts: null,
  tryAssists: null,
  kicks: null,
  lineBreaks: null,
  tries: null,
  tackles: null,
  metres: null,
  carries: null,
  turnovers: null,
  defendersBeaten: null,
  avgMatchRating: null,
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function ratingToTen(rating: number | null): number | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  if (rating <= 10) return Math.round(rating * 10) / 10;
  return Math.round((rating / 10) * 10) / 10;
}

function parseMonthLabel(label: string): string {
  const match = label.trim().match(/^([A-Za-z]{3})\s+(\d{2})$/);
  if (!match) return new Date().toISOString();
  const month = MONTHS[match[1]!.toLowerCase()] ?? 0;
  const year = 2000 + Number(match[2]);
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

export function refereeMatchRows(model: RefereeDashboardModel): PlayerRecentMatchRow[] {
  return model.recentMatches.map((row) => ({
    id: row.id,
    href: row.href,
    kickoffAt: row.kickoffAtIso,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homeCrestUrl: row.homeCrestUrl,
    awayCrestUrl: row.awayCrestUrl,
    matchLabel: row.fixtureLabel,
    competitionName: row.competition,
    rating: ratingToTen(row.rating),
    yellowCards: row.yellowCards ?? 0,
    redCards: row.redCards ?? 0,
    result: null,
    squadRole: null,
    minutesPlayed: null,
  }));
}

export function refereeForm(model: RefereeDashboardModel): PlayerFormResult {
  const avg =
    model.recentMatches
      .map((row) => ratingToTen(row.rating))
      .filter((v): v is number => v != null)
      .reduce((sum, v, _, arr) => sum + v / arr.length, 0) || ratingToTen(model.overallRating) || 8.6;
  const displays: RecentFormMetricDisplay[] = model.seasonSummary.slice(0, 5).map((row, index) => {
    const keys = ["avgMatchRating", "points", "tackles", "kicks", "tries"] as const;
    return {
      key: keys[index] ?? "avgMatchRating",
      label: row.label,
      display: row.key === "avg" ? String(ratingToTen(Number.parseFloat(row.value)) ?? row.value) : row.value,
      value: Number.parseFloat(row.value) || null,
    };
  });
  return {
    formScore: Math.round(avg * 10) / 10,
    formLabel: avg >= 8 ? "Excellent" : avg >= 7 ? "Good" : "Building",
    confidence: 72,
    matchesUsed: model.formLast10.length,
    appearancesEligible: model.formLast10.length,
    avgMatchRating: Math.round(avg * 10) / 10,
    avgPoints: null,
    goalKickAttempts: null,
    goalKicksMade: null,
    goalKickPoints: null,
    tryAssists: null,
    kicks: null,
    lineBreaks: null,
    resultStrip: model.formLast10.map((r) => (r === "positive" ? "W" : "L")),
    components: [],
    metricTotals: EMPTY_TOTALS,
    metricDisplays: displays,
    modelVersion: "referee-form-mock",
  };
}

export function refereeNextMatch(model: RefereeDashboardModel): PlayerNextMatchCard {
  const next = model.nextAppointment;
  if (!next) {
    return {
      id: "",
      slug: model.slug,
      href: null,
      kickoffAt: null,
      competitionName: null,
      homeTeamName: null,
      awayTeamName: null,
      homeTeamCrestUrl: null,
      awayTeamCrestUrl: null,
      venueName: null,
      status: null,
      isLive: false,
      source: "none",
      reason: "No upcoming appointment",
    };
  }
  return {
    id: "next-appointment",
    slug: model.slug,
    href: null,
    kickoffAt: next.kickoffAtIso ?? null,
    competitionName: next.competition,
    homeTeamName: next.homeTeam,
    awayTeamName: next.awayTeam,
    homeTeamCrestUrl: next.homeCrestUrl,
    awayTeamCrestUrl: next.awayCrestUrl,
    venueName: next.venue,
    status: "scheduled",
    isLive: false,
    source: "none",
    reason: "Mock next appointment",
  };
}

export function refereeAchievements(model: RefereeDashboardModel): PublicPlayerKeyAchievementTile[] {
  const icons = ["trophy_major", "award_world", "trophy_domestic", "award_player"] as const;
  return model.highlights.map((row, i) => ({
    id: `ref-honour-${i}`,
    title: row.label,
    yearsLabel: row.detail,
    resultLabel: null,
    iconKey: icons[i] ?? "award_world",
    verificationStatus: "verified",
  }));
}

export function refereeRatingSeries(model: RefereeDashboardModel): RatingHistoryPoint[] {
  return model.ratingHistory.map((row, i, arr) => {
    const prev = arr[i - 1]?.rating ?? null;
    return {
      dateIso: parseMonthLabel(row.month),
      value: row.rating,
      previousValue: prev,
      change: prev != null ? Math.round((row.rating - prev) * 10) / 10 : null,
      confidence: 70,
      coverage: 80,
      opponentName: null,
      competitionName: null,
      fixtureSlug: null,
      matchHref: null,
      matchRating0to10: null,
      majorMatchLabel: null,
      snapshotType: "model",
    };
  });
}

export function refereeStars(rating: number): number {
  return Math.max(0, Math.min(5, Math.round((rating / 20) * 10) / 10));
}
