import { describe, expect, it } from "vitest";
import { aggregateTeamSeasonSummaries, type TeamMatchStatsRow } from "./team-match-stats-service";

function teamMatchRow(overrides: Partial<TeamMatchStatsRow> = {}): TeamMatchStatsRow {
  return {
    id: "1",
    fixtureId: "f1",
    fixtureSlug: "northampton-saints-v-exeter-chiefs",
    kickoffAt: "2026-06-20T14:30:00.000Z",
    teamId: "t1",
    teamName: "Northampton Saints",
    opponentName: "Exeter Chiefs",
    side: "home",
    seasonId: "s1",
    seasonLabel: "2025/26",
    competitionId: "c1",
    competitionName: "Premiership",
    externalMatchId: "v907ry1j",
    tries: 4,
    conversions: 3,
    penalties: 0,
    dropGoals: 0,
    carries: 86,
    metres: 561,
    tackles: 155,
    turnoversWon: 4,
    sections: {},
    syncedAt: "2026-06-20T15:00:00.000Z",
    ...overrides,
  };
}

describe("team-match-stats aggregation", () => {
  it("aggregates season totals and averages from match rows", () => {
    const summaries = aggregateTeamSeasonSummaries([
      teamMatchRow(),
      teamMatchRow({
        id: "2",
        fixtureId: "f2",
        tries: 2,
        conversions: 1,
        carries: 70,
        metres: 400,
        tackles: 120,
        turnoversWon: 2,
      }),
    ]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.matches).toBe(2);
    expect(summaries[0]?.totals.tries).toBe(6);
    expect(summaries[0]?.averages.tries).toBe(3);
    expect(summaries[0]?.averages.carries).toBe(78);
  });
});
