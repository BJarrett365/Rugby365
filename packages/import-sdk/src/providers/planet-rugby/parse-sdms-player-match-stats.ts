import type {
  SdmsMatchPlayerStats,
  SdmsPlayerStatCategory,
  SdmsPlayerStatsBundle,
} from "./sdms-match-stats";

export type ParsedPlayerMatchPerformance = {
  externalPlayerId: string;
  playerName: string;
  side: "home" | "away";
  minutesPlayed: number;
  carries: number;
  metresCarried: number;
  tacklesMade: number;
  tacklesCompleted: number;
  missedTackles: number;
  dominantTackles: number;
  turnoversWon: number;
  tryAssists: number;
  lineBreaks: number;
  defendersBeaten: number;
  touches: number;
  postContactMetres: number;
  ruckArrivalEffectiveness: number;
  passes: number;
  offloads: number;
  /** Detailed kicking */
  kicks: number;
  kicksFromHand: number;
  kickFromHandMetres: number;
  kickPossessionRetained: number;
  /** Detailed errors */
  badPasses: number;
  droppedCatch: number;
  handlingError: number;
  turnoversConceded: number;
  /** Detailed carries */
  runs: number;
  gainLine: number;
  carriesMetres: number;
  carriesCrossedGainLine: number;
  carriesNotMadeGainLine: number;
};

const LEADER_METRICS = [
  "carries",
  "tackles",
  "turnovers_won",
  "running_metres",
  "defenders_beaten",
  "clean_breaks",
] as const;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyParsedPlayerMatchPerformance(
  externalPlayerId = "",
  playerName = "",
  side: "home" | "away" = "home",
): ParsedPlayerMatchPerformance {
  return {
    externalPlayerId,
    playerName,
    side,
    minutesPlayed: 0,
    carries: 0,
    metresCarried: 0,
    tacklesMade: 0,
    tacklesCompleted: 0,
    missedTackles: 0,
    dominantTackles: 0,
    turnoversWon: 0,
    tryAssists: 0,
    lineBreaks: 0,
    defendersBeaten: 0,
    touches: 0,
    postContactMetres: 0,
    ruckArrivalEffectiveness: 0,
    passes: 0,
    offloads: 0,
    kicks: 0,
    kicksFromHand: 0,
    kickFromHandMetres: 0,
    kickPossessionRetained: 0,
    badPasses: 0,
    droppedCatch: 0,
    handlingError: 0,
    turnoversConceded: 0,
    runs: 0,
    gainLine: 0,
    carriesMetres: 0,
    carriesCrossedGainLine: 0,
    carriesNotMadeGainLine: 0,
  };
}

function ensurePlayer(
  players: Map<string, ParsedPlayerMatchPerformance>,
  playerId: string,
  playerName: string,
  side: "home" | "away",
): ParsedPlayerMatchPerformance {
  const existing = players.get(playerId);
  if (existing) {
    existing.playerName = existing.playerName || playerName;
    return existing;
  }
  const created = emptyParsedPlayerMatchPerformance(playerId, playerName, side);
  players.set(playerId, created);
  return created;
}

function applyLeaderMetrics(
  players: Map<string, ParsedPlayerMatchPerformance>,
  bundle: SdmsPlayerStatsBundle | null,
  side: "home" | "away",
) {
  if (!bundle) return;
  const raw = bundle as SdmsPlayerStatsBundle & Record<string, unknown>;

  for (const metric of LEADER_METRICS) {
    const rows = raw[metric];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row.side !== side || !row.player_id) continue;
      const existing = ensurePlayer(players, row.player_id, row.player_name ?? "", side);
      const value = num(row.value);
      if (metric === "carries") existing.carries = value;
      if (metric === "tackles") existing.tacklesCompleted = value;
      if (metric === "turnovers_won") existing.turnoversWon = value;
      if (metric === "running_metres") existing.metresCarried = value;
      if (metric === "defenders_beaten") existing.defendersBeaten = value;
      if (metric === "clean_breaks") existing.lineBreaks = value;
    }
  }
}

function applyDetailList(
  players: Map<string, ParsedPlayerMatchPerformance>,
  bundle: SdmsPlayerStatsBundle | null,
  side: "home" | "away",
  category: SdmsPlayerStatCategory,
) {
  if (!bundle?.detail_list) return;
  for (const row of bundle.detail_list) {
    if (!row.player_id) continue;
    const existing = ensurePlayer(players, row.player_id, String(row.player_name ?? ""), side);
    existing.minutesPlayed = num(row.minutes_played) || existing.minutesPlayed;

    if (category === "attack") {
      existing.metresCarried = num(row.metres) || existing.metresCarried;
      existing.tryAssists = num(row.try_assists);
      existing.lineBreaks = num(row.clean_breaks) || existing.lineBreaks;
      existing.defendersBeaten = num(row.defenders_beaten) || existing.defendersBeaten;
      existing.passes = num(row.passes);
      existing.offloads = num(row.offloads);
      existing.postContactMetres = num(row.post_contact_metres) || existing.postContactMetres;
    } else if (category === "defend") {
      const tackles = num(row.tackles);
      const missed = num(row.missed_tackles);
      existing.tacklesCompleted = tackles || existing.tacklesCompleted;
      existing.missedTackles = missed;
      existing.tacklesMade = tackles + missed || existing.tacklesMade;
      existing.turnoversWon = num(row.turnovers_won) || existing.turnoversWon;
      existing.dominantTackles = num(row.dominant_tackles) || existing.dominantTackles;
      existing.ruckArrivalEffectiveness =
        num(row.ruck_arrival_effectiveness) || existing.ruckArrivalEffectiveness;
    } else if (category === "kicking") {
      existing.kicks = num(row.kicks);
      existing.kicksFromHand = num(row.kicks_from_hand);
      existing.kickFromHandMetres = num(row.kick_from_hand_metres);
      existing.kickPossessionRetained = num(row.kick_possession_retained);
    } else if (category === "errors") {
      existing.badPasses = num(row.bad_passes);
      existing.droppedCatch = num(row.dropped_catch);
      existing.handlingError = num(row.handling_error);
      existing.turnoversConceded = num(row.turnovers_conceded);
    } else if (category === "carries") {
      existing.runs = num(row.runs);
      existing.gainLine = num(row.gain_line);
      existing.carriesMetres = num(row.carries_metres);
      existing.carriesCrossedGainLine = num(row.carries_crossed_gain_line);
      existing.carriesNotMadeGainLine = num(row.carries_not_made_gain_line);
      // detail_list.carries is often 0; prefer leader carries, else runs
      const detailCarries = num(row.carries);
      if (detailCarries > 0) existing.carries = detailCarries;
      else if (!existing.carries && existing.runs > 0) existing.carries = existing.runs;
      if (!existing.metresCarried && existing.carriesMetres > 0) {
        existing.metresCarried = existing.carriesMetres;
      }
    }
  }
}

export function parseSidePlayerMatchPerformance(
  playerStats: SdmsMatchPlayerStats,
  side: "home" | "away",
): ParsedPlayerMatchPerformance[] {
  const players = new Map<string, ParsedPlayerMatchPerformance>();
  const sideStats = playerStats[side];

  // Leaders appear on every category payload; attack/defend are enough.
  applyLeaderMetrics(players, sideStats.attack, side);
  applyLeaderMetrics(players, sideStats.defend, side);
  applyLeaderMetrics(players, sideStats.carries, side);

  applyDetailList(players, sideStats.attack, side, "attack");
  applyDetailList(players, sideStats.defend, side, "defend");
  applyDetailList(players, sideStats.kicking, side, "kicking");
  applyDetailList(players, sideStats.errors, side, "errors");
  applyDetailList(players, sideStats.carries, side, "carries");

  return [...players.values()]
    .map((row) => {
      if (!row.tacklesMade && row.tacklesCompleted + row.missedTackles > 0) {
        row.tacklesMade = row.tacklesCompleted + row.missedTackles;
      }
      if (!row.touches && (row.passes > 0 || row.carries > 0)) {
        row.touches = row.passes + row.carries;
      }
      return row;
    })
    .filter((row) => row.playerName.trim());
}

export function parseMatchPlayerPerformance(
  playerStats: SdmsMatchPlayerStats,
): ParsedPlayerMatchPerformance[] {
  return [
    ...parseSidePlayerMatchPerformance(playerStats, "home"),
    ...parseSidePlayerMatchPerformance(playerStats, "away"),
  ];
}

export function buildMatchPerformanceImportKey(matchId: string, externalPlayerId: string): string {
  return `${matchId}:${externalPlayerId}`;
}

export type AggregatedPerformanceStats = Omit<
  ParsedPlayerMatchPerformance,
  "externalPlayerId" | "playerName" | "side"
> & {
  appearances: number;
  tries: number;
  points: number;
};

export function emptyAggregatedPerformanceStats(): AggregatedPerformanceStats {
  const {
    externalPlayerId: _id,
    playerName: _name,
    side: _side,
    ...stats
  } = emptyParsedPlayerMatchPerformance();
  return {
    appearances: 0,
    tries: 0,
    points: 0,
    ...stats,
  };
}

export function aggregatePerformanceStats(
  rows: Array<
    ParsedPlayerMatchPerformance & {
      tries?: number;
      points?: number;
    }
  >,
): AggregatedPerformanceStats {
  const totals = emptyAggregatedPerformanceStats();
  totals.appearances = rows.length;

  for (const row of rows) {
    totals.minutesPlayed += row.minutesPlayed;
    totals.tries += row.tries ?? 0;
    totals.points += row.points ?? 0;
    totals.carries += row.carries;
    totals.metresCarried += row.metresCarried;
    totals.tacklesMade += row.tacklesMade;
    totals.tacklesCompleted += row.tacklesCompleted;
    totals.missedTackles += row.missedTackles;
    totals.dominantTackles += row.dominantTackles;
    totals.turnoversWon += row.turnoversWon;
    totals.tryAssists += row.tryAssists;
    totals.lineBreaks += row.lineBreaks;
    totals.defendersBeaten += row.defendersBeaten;
    totals.touches += row.touches;
    totals.postContactMetres += row.postContactMetres;
    totals.ruckArrivalEffectiveness += row.ruckArrivalEffectiveness;
    totals.passes += row.passes;
    totals.offloads += row.offloads;
    totals.kicks += row.kicks;
    totals.kicksFromHand += row.kicksFromHand;
    totals.kickFromHandMetres += row.kickFromHandMetres;
    totals.kickPossessionRetained += row.kickPossessionRetained;
    totals.badPasses += row.badPasses;
    totals.droppedCatch += row.droppedCatch;
    totals.handlingError += row.handlingError;
    totals.turnoversConceded += row.turnoversConceded;
    totals.runs += row.runs;
    totals.gainLine += row.gainLine;
    totals.carriesMetres += row.carriesMetres;
    totals.carriesCrossedGainLine += row.carriesCrossedGainLine;
    totals.carriesNotMadeGainLine += row.carriesNotMadeGainLine;
  }

  return totals;
}

export function perMinuteRate(total: number, minutes: number): number | null {
  if (minutes <= 0) return null;
  return Math.round((total / minutes) * 100) / 100;
}

export function attackScore(
  stats: Pick<
    AggregatedPerformanceStats,
    "points" | "tries" | "metresCarried" | "carries" | "lineBreaks"
  >,
): number {
  return stats.points + stats.tries * 5 + stats.metresCarried + stats.carries + stats.lineBreaks;
}

export function defenceScore(
  stats: Pick<
    AggregatedPerformanceStats,
    "tacklesCompleted" | "dominantTackles" | "turnoversWon"
  >,
): number {
  return stats.tacklesCompleted + stats.dominantTackles * 2 + stats.turnoversWon * 3;
}

export function rankAggregatedRows<T extends { attackScore?: number; defenceScore?: number }>(
  rows: T[],
  metric: "attackScore" | "defenceScore",
): Array<T & { rank: number | null }> {
  const sorted = [...rows]
    .filter((row) => (row[metric] ?? 0) > 0)
    .sort((a, b) => (b[metric] ?? 0) - (a[metric] ?? 0));
  const rankByIndex = new Map(sorted.map((row, index) => [row, index + 1]));
  return rows.map((row) => ({ ...row, rank: rankByIndex.get(row) ?? null }));
}
