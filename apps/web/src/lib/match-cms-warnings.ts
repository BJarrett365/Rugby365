/** Missing-data warnings for Matches CMS list (Phase B). */

export type MatchWarningCode =
  | "competition"
  | "season"
  | "home_team"
  | "away_team"
  | "venue"
  | "referee"
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
  | "missing_referee";

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

  return buckets;
}

export function rowMatchesOpsBucket(row: TodayOpsRow, bucket: TodayOpsBucket, nowMs = Date.now()): boolean {
  if (bucket === "all") return true;
  if (bucket === "missing_data") return row.warningCount > 0;
  return classifyTodayBucket(row, nowMs).includes(bucket);
}
