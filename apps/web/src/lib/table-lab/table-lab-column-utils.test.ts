import { describe, expect, it } from "vitest";
import { leagueTableOptionalColumns } from "./table-lab-column-utils";
import type { RugbyTableStandingRow } from "./table-types";

function row(overrides: Partial<RugbyTableStandingRow> = {}): RugbyTableStandingRow {
  return {
    rank: 1,
    teamId: "t1",
    teamName: "Bath",
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    pointsFor: 24,
    pointsAgainst: 17,
    pointsDiff: 7,
    bonusPoints: 1,
    leaguePoints: 5,
    ...overrides,
  };
}

describe("leagueTableOptionalColumns", () => {
  it("shows TF and TA when try data exists", () => {
    const optional = leagueTableOptionalColumns([row({ triesFor: 3, triesAgainst: 2 })]);
    expect(optional.showTfTa).toBe(true);
  });

  it("hides TF and TA when no try data is present", () => {
    const optional = leagueTableOptionalColumns([row({ triesFor: null, triesAgainst: null })]);
    expect(optional.showTfTa).toBe(false);
  });

  it("shows TBP when try bonus breakdown is present", () => {
    const optional = leagueTableOptionalColumns([row({ tryBonusPoints: 2, losingBonusPoints: null })]);
    expect(optional.showTbp).toBe(true);
    expect(optional.showLbp).toBe(false);
    expect(optional.showTbpLbp).toBe(true);
  });

  it("shows LBP when losing bonus breakdown is present", () => {
    const optional = leagueTableOptionalColumns([row({ tryBonusPoints: null, losingBonusPoints: 1 })]);
    expect(optional.showTbp).toBe(false);
    expect(optional.showLbp).toBe(true);
    expect(optional.showTbpLbp).toBe(true);
  });

  it("hides bonus columns when breakdown fields are absent", () => {
    const optional = leagueTableOptionalColumns([
      row({ tryBonusPoints: null, losingBonusPoints: null }),
    ]);
    expect(optional.showTbp).toBe(false);
    expect(optional.showLbp).toBe(false);
    expect(optional.showTbpLbp).toBe(false);
  });
});
