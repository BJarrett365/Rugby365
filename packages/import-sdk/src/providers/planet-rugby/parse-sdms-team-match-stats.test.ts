import { describe, expect, it } from "vitest";
import {
  averageTeamMatchSummary,
  buildTeamMatchImportKey,
  extractSideSection,
  parseSdmsMatchTeamStats,
  parseSdmsTeamMatchStats,
  sumTeamMatchSummaries,
} from "./parse-sdms-team-match-stats";
import type { SdmsMatchStatsBundle } from "./sdms-match-stats";

const SAMPLE: SdmsMatchStatsBundle = {
  match_id: "v907ry1j",
  summary: {
    home_tries: 4,
    home_conversions: 3,
    home_penalties: 0,
    home_drop_goals: 0,
    home_carries: 86,
    home_metres: 561,
    home_tackles: 155,
    home_turnovers_won: 4,
    away_tries: 3,
    away_conversions: 1,
    away_penalties: 0,
    away_drop_goals: 0,
    away_carries: 62,
    away_metres: 362,
    away_tackles: 179,
    away_turnovers_won: 5,
  },
  possession: {
    home_overall_percentage: 0.51,
    away_overall_percentage: 0.49,
  },
  territory: {
    home_overall_percentage: 0.54,
    away_overall_percentage: 0.46,
  },
  attack: {
    home_passes: 180,
    away_passes: 154,
  },
  defence: {
    home_tackles_missed: 15,
    away_tackles_missed: 38,
  },
  kicking: {},
  rucks: {},
  set_piece: {},
};

describe("parse-sdms-team-match-stats", () => {
  it("parses home summary stats from SDMS bundle", () => {
    const home = parseSdmsTeamMatchStats(SAMPLE, "home");
    expect(home).toMatchObject({
      side: "home",
      tries: 4,
      conversions: 3,
      carries: 86,
      metres: 561,
      tackles: 155,
      turnoversWon: 4,
    });
    expect(home.sections.possession.overall_percentage).toBe(0.51);
    expect(home.sections.attack.passes).toBe(180);
  });

  it("parses both sides from a match bundle", () => {
    const rows = parseSdmsMatchTeamStats(SAMPLE);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.tries).toBe(3);
    expect(rows[1]?.metres).toBe(362);
  });

  it("extracts side-specific section keys", () => {
    expect(extractSideSection(SAMPLE.possession, "away")).toEqual({
      overall_percentage: 0.49,
    });
  });

  it("builds stable import keys", () => {
    expect(buildTeamMatchImportKey("v907ry1j", "home")).toBe("v907ry1j:team:home");
  });

  it("sums and averages match summaries", () => {
    const parsed = parseSdmsMatchTeamStats(SAMPLE);
    const totals = sumTeamMatchSummaries(parsed);
    expect(totals.tries).toBe(7);
    const avg = averageTeamMatchSummary(parsed);
    expect(avg.matches).toBe(2);
    expect(avg.tries).toBe(3.5);
  });
});
