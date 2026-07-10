import type { SdmsMatchPlayerStats, SdmsPlayerStatsBundle } from "./sdms-match-stats";

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
      const existing =
        players.get(row.player_id) ??
        ({
          externalPlayerId: row.player_id,
          playerName: row.player_name ?? "",
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
        } satisfies ParsedPlayerMatchPerformance);
      existing.playerName = existing.playerName || row.player_name || "";
      const value = num(row.value);
      if (metric === "carries") existing.carries = value;
      if (metric === "tackles") existing.tacklesCompleted = value;
      if (metric === "turnovers_won") existing.turnoversWon = value;
      if (metric === "running_metres") existing.metresCarried = value;
      if (metric === "defenders_beaten") existing.defendersBeaten = value;
      if (metric === "clean_breaks") existing.lineBreaks = value;
      players.set(row.player_id, existing);
    }
  }
}

function applyDetailList(
  players: Map<string, ParsedPlayerMatchPerformance>,
  bundle: SdmsPlayerStatsBundle | null,
  side: "home" | "away",
  category: "attack" | "defend",
) {
  if (!bundle?.detail_list) return;
  for (const row of bundle.detail_list) {
    if (!row.player_id) continue;
    const existing =
      players.get(row.player_id) ??
      ({
        externalPlayerId: row.player_id,
        playerName: row.player_name ?? "",
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
      } satisfies ParsedPlayerMatchPerformance);

    existing.playerName = existing.playerName || String(row.player_name ?? "");
    existing.minutesPlayed = num(row.minutes_played) || existing.minutesPlayed;

    if (category === "attack") {
      existing.metresCarried = num(row.metres) || existing.metresCarried;
      existing.tryAssists = num(row.try_assists);
      existing.lineBreaks = num(row.clean_breaks) || existing.lineBreaks;
      existing.defendersBeaten = num(row.defenders_beaten) || existing.defendersBeaten;
      existing.passes = num(row.passes);
      existing.offloads = num(row.offloads);
      existing.touches = existing.passes + existing.carries;
      existing.postContactMetres = num(row.post_contact_metres);
    } else {
      const tackles = num(row.tackles);
      const missed = num(row.missed_tackles);
      existing.tacklesCompleted = tackles || existing.tacklesCompleted;
      existing.missedTackles = missed;
      existing.tacklesMade = tackles + missed || existing.tacklesMade;
      existing.turnoversWon = num(row.turnovers_won) || existing.turnoversWon;
      existing.dominantTackles = num(row.dominant_tackles);
      existing.ruckArrivalEffectiveness = num(row.ruck_arrival_effectiveness);
    }

    players.set(row.player_id, existing);
  }
}

export function parseSidePlayerMatchPerformance(
  playerStats: SdmsMatchPlayerStats,
  side: "home" | "away",
): ParsedPlayerMatchPerformance[] {
  const players = new Map<string, ParsedPlayerMatchPerformance>();
  const attack = playerStats[side].attack;
  const defend = playerStats[side].defend;

  applyLeaderMetrics(players, attack, side);
  applyLeaderMetrics(players, defend, side);
  applyDetailList(players, attack, side, "attack");
  applyDetailList(players, defend, side, "defend");

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
  return {
    appearances: 0,
    minutesPlayed: 0,
    tries: 0,
    points: 0,
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
  }

  return totals;
}

export function perMinuteRate(total: number, minutes: number): number | null {
  if (minutes <= 0) return null;
  return Math.round((total / minutes) * 100) / 100;
}

export function attackScore(stats: AggregatedPerformanceStats): number {
  return stats.points + stats.tries * 5 + stats.metresCarried + stats.carries + stats.lineBreaks;
}

export function defenceScore(stats: AggregatedPerformanceStats): number {
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
