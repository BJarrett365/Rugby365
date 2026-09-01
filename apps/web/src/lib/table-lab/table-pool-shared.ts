import {
  poolStageFormSlots,
  type RugbyWorldCupPoolDefinition,
} from "../rugby-world-cup-pools";
import type { FormResult, RugbyTablePoolGroup, RugbyTableStandingRow } from "./table-types";

function comparePoolRows(a: RugbyTableStandingRow, b: RugbyTableStandingRow): number {
  if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
  if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
  return a.teamName.localeCompare(b.teamName);
}

function withPoolForm(row: RugbyTableStandingRow, formSlots: number): RugbyTableStandingRow {
  // formSequence is newest-first. Pool games come before knockouts, so keep the oldest N.
  const sequence = (row.formSequence ?? []).slice(-formSlots);
  return { ...row, formSequence: sequence as FormResult[] };
}

function emptyPoolRow(teamName: string): RugbyTableStandingRow {
  return {
    rank: 1,
    teamId: `rwc-pool-placeholder:${teamName}`,
    teamName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointsDiff: 0,
    bonusPoints: 0,
    leaguePoints: 0,
    formSequence: [],
    movement: null,
    previousRank: null,
  };
}

/** Split flat standings into official RWC pool tables (re-ranked within each pool). */
export function splitRowsIntoWorldCupPools(
  rows: RugbyTableStandingRow[],
  pools: RugbyWorldCupPoolDefinition[],
): RugbyTablePoolGroup[] {
  if (!pools.length) return [];

  const formSlots = poolStageFormSlots(pools[0]!.teams.length);
  const byKey = new Map(rows.map((row) => [(row.teamName ?? "").trim().toLowerCase(), row]));

  return pools.map((pool) => {
    const matched: RugbyTableStandingRow[] = [];
    for (const teamName of pool.teams) {
      const existing = byKey.get(teamName.toLowerCase());
      if (existing) matched.push(withPoolForm(existing, formSlots));
      else matched.push(emptyPoolRow(teamName));
    }
    const sorted = [...matched].sort(comparePoolRows).map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
    return {
      id: pool.id,
      label: pool.label,
      rows: sorted,
      formSlots,
    };
  });
}

/** Map synced LeagueTable standings rows into live-table row shape for pool splitting. */
export function standingRowsToTableRows(
  rows: Array<{
    rank: number;
    teamName: string;
    teamSlug?: string;
    played: number;
    won: number;
    draw: number;
    lost: number;
    pointsDiff: number;
    bonusPoints: number;
    points: number;
    form: string | null;
    teamImageUrl?: string | null;
  }>,
): RugbyTableStandingRow[] {
  return rows.map((row) => {
    const formLetters = (row.form ?? "").toUpperCase().replace(/[^WDL]/g, "");
    const usable =
      formLetters.length >= 4 && /^D+$/.test(formLetters) ? "" : formLetters;
    const formSequence = [...usable]
      .reverse()
      .filter((letter): letter is FormResult => letter === "W" || letter === "D" || letter === "L");
    return {
      rank: row.rank,
      teamId: row.teamSlug || row.teamName,
      teamName: row.teamName,
      played: row.played,
      won: row.won,
      drawn: row.draw,
      lost: row.lost,
      pointsFor: 0,
      pointsAgainst: 0,
      pointsDiff: row.pointsDiff,
      bonusPoints: row.bonusPoints,
      leaguePoints: row.points,
      formSequence,
      teamImageUrl: row.teamImageUrl ?? null,
    };
  });
}
