import { describe, expect, it } from "vitest";
import {
  asPercent,
  buildFullMatchTeamStatLines,
  buildHalfTimeTeamStatLines,
  normalizeTeamSideStats,
  type NarrativeMatchTeamStats,
} from "./match-narrative-team-stats";

const sampleStats: NarrativeMatchTeamStats = {
  home: normalizeTeamSideStats({
    tries: 2,
    conversions: 1,
    penalties: 0,
    carries: 39,
    metres: 296,
    tackles: 78,
    turnoversWon: 3,
    sections: {
      possession: {
        overall_percentage: 0.49,
        first_half_percentage: 0.42,
        second_half_percentage: 0.63,
      },
      territory: {
        overall_percentage: 0.48,
        first_half_percentage: 0.42,
        second_half_percentage: 0.59,
      },
      defence: {
        tackles_missed: 12,
        tackles_success_percentage: 0.8,
      },
      kicking: {
        kicking_metres: 421,
        kicking_success_percentage: 18,
      },
      rucks: {
        rucks_won: 53,
        rucks_lost: 0,
        total_rucks: 53,
        rucks_success_percentage: 1,
      },
      set_piece: {
        scrums_success_percentage: 1,
        lineout_success_percentage: 0.5,
      },
    },
  }),
  away: normalizeTeamSideStats({
    tries: 2,
    conversions: 2,
    penalties: 1,
    carries: 42,
    metres: 270,
    tackles: 75,
    turnoversWon: 2,
    sections: {
      possession: {
        overall_percentage: 0.51,
        first_half_percentage: 0.58,
        second_half_percentage: 0.37,
      },
      territory: {
        overall_percentage: 0.52,
        first_half_percentage: 0.58,
        second_half_percentage: 0.41,
      },
      defence: {
        tackles_missed: 20,
        tackles_success_percentage: 0.72,
      },
      kicking: {
        kicking_metres: 542,
        kicking_success_percentage: 22,
      },
      rucks: {
        rucks_won: 59,
        rucks_lost: 2,
        total_rucks: 61,
        rucks_success_percentage: 0.97,
      },
      set_piece: {
        scrums_success_percentage: 0.86,
        lineout_success_percentage: 0.92,
      },
    },
  }),
};

describe("match narrative team stats", () => {
  it("normalizes fractions to whole percents", () => {
    expect(asPercent(0.51)).toBe(51);
    expect(asPercent(18)).toBe(18);
  });

  it("builds first-half possession and territory lines", () => {
    const lines = buildHalfTimeTeamStatLines("Boland Cavaliers", "Pumas", sampleStats, 40);
    expect(lines.map((l) => l.segment)).toEqual([
      "possession_first_half",
      "territory_first_half",
    ]);
    expect(lines[0]?.body).toContain("First-half possession: Boland Cavaliers 42%, Pumas 58%");
    expect(lines[1]?.body).toContain("Territory summary, first half");
  });

  it("builds full-match possession, summary, defence, kicking, rucks and set piece", () => {
    const lines = buildFullMatchTeamStatLines("Boland Cavaliers", "Pumas", sampleStats, 80);
    const segments = lines.map((l) => l.segment);
    expect(segments).toContain("possession_update");
    expect(segments).toContain("match_summary_stats");
    expect(segments).toContain("territory_second_half");
    expect(segments).toContain("defence_update");
    expect(segments).toContain("turnovers_update");
    expect(segments).toContain("kicking_update");
    expect(segments).toContain("rucks_update");
    expect(segments).toContain("set_piece_update");
    expect(lines.find((l) => l.segment === "match_summary_stats")?.body).toContain("tries 2–2");
    expect(lines.find((l) => l.segment === "defence_update")?.body).toContain("12 missed");
    expect(lines.find((l) => l.segment === "set_piece_update")?.body).toContain("lineout 50%");
  });
});
