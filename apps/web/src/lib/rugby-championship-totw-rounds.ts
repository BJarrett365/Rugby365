/**
 * Canonical Team of the Week rounds for The Rugby Championship.
 *
 * TRC is a round-robin (not a knockout). Knockout labels are kept so the
 * public picker matches the Rugby World Cup TotW UI; those rounds are marked
 * unavailable instead of inventing selections.
 */
import {
  RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR,
  RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS,
  rugbyChampionshipExpectedFixtureCount,
} from "./rugby-championship-lineage";
import type { TotwPickerRound, TotwPickerSeason } from "./team-of-week-picker";
import { sortTotwRounds } from "./team-of-week-picker";

export const RUGBY_CHAMPIONSHIP_TOTW_FIRST_YEAR = 2012;
export const RUGBY_CHAMPIONSHIP_TOTW_LAST_YEAR = 2026;

export const RUGBY_CHAMPIONSHIP_KNOCKOUT_ROUND_KEYS = [
  "quarter-finals",
  "quarter-final",
  "semi-finals",
  "semi-final",
  "bronze-final",
  "final",
] as const;

export const RUGBY_CHAMPIONSHIP_TOTW_ROUNDS: TotwPickerRound[] = [
  { roundKey: "round-1", roundName: "Round 1", roundNumber: 1 },
  { roundKey: "round-2", roundName: "Round 2", roundNumber: 2 },
  { roundKey: "round-3", roundName: "Round 3", roundNumber: 3 },
  { roundKey: "round-4", roundName: "Round 4", roundNumber: 4 },
  { roundKey: "round-5", roundName: "Round 5", roundNumber: 5 },
  { roundKey: "round-6", roundName: "Round 6", roundNumber: 6 },
  { roundKey: "quarter-finals", roundName: "Quarter Final", roundNumber: null },
  { roundKey: "semi-finals", roundName: "Semi Final", roundNumber: null },
  { roundKey: "bronze-final", roundName: "Bronze Final", roundNumber: null },
  { roundKey: "final", roundName: "Final", roundNumber: null },
  { roundKey: "team-of-the-tournament", roundName: "Team of the Tournament", roundNumber: null },
];

const KNOCKOUT_KEYS = new Set<string>(RUGBY_CHAMPIONSHIP_KNOCKOUT_ROUND_KEYS);

/** World Cup years + 2020 used fewer weekends than a full six-round Championship. */
export function rugbyChampionshipTotwPoolRoundCount(year: number): number {
  const fixtures = rugbyChampionshipExpectedFixtureCount(year) ?? 0;
  if (fixtures <= 0) return 0;
  if (fixtures <= 6) {
    // 2015/2019/2023: 3 weekends of 2 matches. 2020: 6 single-match rounds.
    return year === 2020 ? 6 : 3;
  }
  return 6;
}

export function isRugbyChampionshipKnockoutRoundKey(roundKey: string): boolean {
  return KNOCKOUT_KEYS.has(roundKey);
}

export function rugbyChampionshipTotwUnavailableReason(
  year: number,
  roundKey: string,
): string | null {
  if (RUGBY_CHAMPIONSHIP_NOT_HELD_YEARS.has(year)) {
    return "The Rugby Championship was not held this season.";
  }
  if (isRugbyChampionshipKnockoutRoundKey(roundKey)) {
    return "The Rugby Championship is a round-robin series and does not play quarter-finals, semi-finals, a bronze final or a final.";
  }
  const poolRounds = rugbyChampionshipTotwPoolRoundCount(year);
  const roundNumber = roundKey.match(/^round-(\d+)$/);
  if (roundNumber) {
    const n = Number.parseInt(roundNumber[1]!, 10);
    if (n > poolRounds) {
      if (year === 2020) {
        return "The 2020 tournament was a six-match three-team series. This round was not scheduled.";
      }
      return "This season used a shortened Championship (World Cup year). This round was not played.";
    }
  }
  if (roundKey === "team-of-the-tournament" && poolRounds === 0) {
    return "The Rugby Championship was not held this season.";
  }
  return null;
}

export function buildRugbyChampionshipTotwPickerSeasons(
  editions: Array<{
    roundKey: string;
    roundName: string;
    roundNumber: number | null;
    seasonLabel: string | null;
    seasonYear: number | null;
  }>,
): TotwPickerSeason[] {
  const byYear = new Map<number, TotwPickerSeason>();
  for (let year = RUGBY_CHAMPIONSHIP_TOTW_LAST_YEAR; year >= RUGBY_CHAMPIONSHIP_TOTW_FIRST_YEAR; year -= 1) {
    byYear.set(year, {
      year,
      label: String(year),
      rounds: RUGBY_CHAMPIONSHIP_TOTW_ROUNDS.map((round) => ({ ...round })),
    });
  }

  for (const ed of editions) {
    const year = ed.seasonYear;
    if (year == null || !byYear.has(year)) continue;
    const season = byYear.get(year)!;
    const existing = season.rounds.find((r) => r.roundKey === ed.roundKey);
    if (existing) {
      existing.roundName = ed.roundName || existing.roundName;
      existing.roundNumber = ed.roundNumber ?? existing.roundNumber;
    } else {
      season.rounds.push({
        roundKey: ed.roundKey,
        roundName: ed.roundName,
        roundNumber: ed.roundNumber,
      });
    }
  }

  return [...byYear.values()]
    .map((season) => ({ ...season, rounds: sortTotwRounds(season.rounds) }))
    .sort((a, b) => b.year - a.year);
}

export function rugbyChampionshipTotwFixtureCount(year: number): number {
  return RUGBY_CHAMPIONSHIP_FIXTURE_COUNT_BY_YEAR[year] ?? 0;
}
