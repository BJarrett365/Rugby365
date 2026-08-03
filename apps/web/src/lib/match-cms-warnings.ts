/** Missing-data warnings for Matches CMS list (Phase B). */

import {
  evaluatePregameReadiness,
  isPregameStatus,
} from "./match-pregame-readiness";

export type MatchWarningCode =
  | "competition"
  | "season"
  | "home_team"
  | "away_team"
  | "venue"
  | "referee"
  | "home_coach"
  | "away_coach"
  | "weather"
  | "lineups"
  | "team_stats"
  | "player_stats"
  | "primary_mapping"
  | "duplicate";

export type MatchWarningFlags = {
  competitionId: string | null;
  seasonId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  venueId: string | null;
  refereeId: string | null;
  homeCoachId?: string | null;
  awayCoachId?: string | null;
  /** Venue has lat/lng so Open-Meteo weather can resolve. */
  venueHasCoords?: boolean;
  hasLineups: boolean;
  hasTeamStats: boolean;
  hasPlayerStats: boolean;
  primaryApiMatchId: string | null;
  /** Finished/live matches should usually have lineups/stats */
  status: string;
};

export type MatchWarning = {
  code: MatchWarningCode;
  label: string;
  actionLabel: string;
  href: (matchId: string) => string;
};

const FINISHED_LIKE = new Set(["full_time", "live", "half_time"]);

export function collectMatchWarnings(flags: MatchWarningFlags): MatchWarning[] {
  const out: MatchWarning[] = [];
  const page = (path: string) => (id: string) => `/admin/matches/${id}/${path}`;

  if (!flags.competitionId) {
    out.push({
      code: "competition",
      label: "Competition mapping",
      actionLabel: "Map competition",
      href: page("edit"),
    });
  }
  if (!flags.seasonId) {
    out.push({
      code: "season",
      label: "Season mapping",
      actionLabel: "Map season",
      href: page("edit"),
    });
  }
  if (!flags.homeTeamId) {
    out.push({
      code: "home_team",
      label: "Home team",
      actionLabel: "Map team",
      href: page("edit"),
    });
  }
  if (!flags.awayTeamId) {
    out.push({
      code: "away_team",
      label: "Away team",
      actionLabel: "Map team",
      href: page("edit"),
    });
  }
  if (!flags.venueId) {
    out.push({
      code: "venue",
      label: "Venue",
      actionLabel: "Add venue",
      href: page("edit"),
    });
  }
  if (!flags.refereeId) {
    out.push({
      code: "referee",
      label: "Main referee",
      actionLabel: "Add referee",
      href: page("edit"),
    });
  }

  // Pre-game staff + weather — surface before kickoff so ops can fix gaps early.
  if (isPregameStatus(flags.status)) {
    const pregame = evaluatePregameReadiness({
      venueId: flags.venueId,
      venueHasCoords: Boolean(flags.venueHasCoords),
      refereeId: flags.refereeId,
      homeCoachId: flags.homeCoachId ?? null,
      awayCoachId: flags.awayCoachId ?? null,
    });
    for (const check of pregame.checks) {
      if (check.ok) continue;
      if (check.code === "stadium" || check.code === "referee") continue; // already flagged above
      if (check.code === "weather") {
        out.push({
          code: "weather",
          label: "Weather (venue coords)",
          actionLabel: "Geocode venue",
          href: page("edit"),
        });
      } else if (check.code === "home_coach") {
        out.push({
          code: "home_coach",
          label: "Home coach",
          actionLabel: "Assign coach",
          href: page("edit"),
        });
      } else if (check.code === "away_coach") {
        out.push({
          code: "away_coach",
          label: "Away coach",
          actionLabel: "Assign coach",
          href: page("edit"),
        });
      }
    }
  }

  if (!flags.primaryApiMatchId) {
    out.push({
      code: "primary_mapping",
      label: "Primary API mapping",
      actionLabel: "Review mapping",
      href: page("sources"),
    });
  }

  if (FINISHED_LIKE.has(flags.status)) {
    if (!flags.hasLineups) {
      out.push({
        code: "lineups",
        label: "Lineups",
        actionLabel: "Import lineups",
        href: page("lineups"),
      });
    }
    if (!flags.hasTeamStats) {
      out.push({
        code: "team_stats",
        label: "Team stats",
        actionLabel: "Sync stats",
        href: page("stats"),
      });
    }
    if (!flags.hasPlayerStats) {
      out.push({
        code: "player_stats",
        label: "Player stats",
        actionLabel: "Sync stats",
        href: page("player-stats"),
      });
    }
  }

  return out;
}

export function matchWarningCount(flags: MatchWarningFlags): number {
  return collectMatchWarnings(flags).length;
}

export type TodayOpsBucket =
  | "all"
  | "live"
  | "starting_soon"
  | "upcoming"
  | "finished"
  | "missing_data"
  | "unmapped"
  | "missing_lineups"
  | "missing_venue"
  | "missing_referee"
  | "missing_coach"
  | "missing_weather"
  | "pregame_not_ready";

export type TodayOpsRow = MatchWarningFlags & {
  id: string;
  kickoffAt: string | null;
  status: string;
  warningCount: number;
};

export function classifyTodayBucket(
  row: TodayOpsRow,
  nowMs = Date.now(),
): Exclude<TodayOpsBucket, "all" | "missing_data">[] {
  const buckets: Exclude<TodayOpsBucket, "all" | "missing_data">[] = [];
  const status = row.status;
  const kickoffMs = row.kickoffAt ? new Date(row.kickoffAt).getTime() : NaN;

  if (status === "live" || status === "half_time") buckets.push("live");
  if (status === "full_time") buckets.push("finished");
  if (status === "scheduled" && Number.isFinite(kickoffMs)) {
    const mins = (kickoffMs - nowMs) / 60_000;
    if (mins >= 0 && mins <= 60) buckets.push("starting_soon");
    if (mins > 60) buckets.push("upcoming");
  }

  if (!row.primaryApiMatchId && !row.competitionId) buckets.push("unmapped");
  else if (!row.primaryApiMatchId) buckets.push("unmapped");

  if (!row.hasLineups && FINISHED_LIKE.has(status)) buckets.push("missing_lineups");
  if (!row.venueId) buckets.push("missing_venue");
  if (!row.refereeId) buckets.push("missing_referee");

  if (isPregameStatus(status)) {
    const pregame = evaluatePregameReadiness({
      venueId: row.venueId,
      venueHasCoords: Boolean(row.venueHasCoords),
      refereeId: row.refereeId,
      homeCoachId: row.homeCoachId ?? null,
      awayCoachId: row.awayCoachId ?? null,
    });
    if (!pregame.ready) buckets.push("pregame_not_ready");
    if (pregame.missing.includes("home_coach") || pregame.missing.includes("away_coach")) {
      buckets.push("missing_coach");
    }
    if (pregame.missing.includes("weather")) buckets.push("missing_weather");
  }

  return buckets;
}

export function rowMatchesOpsBucket(row: TodayOpsRow, bucket: TodayOpsBucket, nowMs = Date.now()): boolean {
  if (bucket === "all") return true;
  if (bucket === "missing_data") return row.warningCount > 0;
  return classifyTodayBucket(row, nowMs).includes(bucket);
}
