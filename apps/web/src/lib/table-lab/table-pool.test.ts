import { describe, expect, it } from "vitest";
import {
  isWorldCupKnockoutStage,
  poolStageFormSlots,
  resolveRugbyWorldCupYear,
  rugbyWorldCupPoolForTeam,
  rugbyWorldCupPoolsForYear,
} from "../rugby-world-cup-pools";
import { splitRowsIntoWorldCupPools, standingRowsToTableRows } from "./table-pool-shared";

describe("rugby world cup pools", () => {
  it("uses 3 form slots for 2027 (4-team pools) and 4 for 2023 (5-team pools)", () => {
    expect(poolStageFormSlots(rugbyWorldCupPoolsForYear(2027)[0]!.teams.length)).toBe(3);
    expect(poolStageFormSlots(rugbyWorldCupPoolsForYear(2023)[0]!.teams.length)).toBe(4);
  });

  it("resolves season labels to tournament years", () => {
    expect(resolveRugbyWorldCupYear({ seasonLabel: "2023–24", seasonYear: 2023 })).toBe(2023);
    expect(resolveRugbyWorldCupYear({ seasonLabel: "2027–28" })).toBe(2027);
  });

  it("maps teams into pools", () => {
    expect(rugbyWorldCupPoolForTeam(2023, "France")?.id).toBe("A");
    expect(rugbyWorldCupPoolForTeam(2023, "England")?.id).toBe("D");
    expect(rugbyWorldCupPoolForTeam(2027, "Australia")?.id).toBe("A");
    expect(rugbyWorldCupPoolForTeam(2027, "England")?.id).toBe("F");
  });

  it("detects knockout stages", () => {
    expect(isWorldCupKnockoutStage("quarter_final", "Quarter Finals")).toBe(true);
    expect(isWorldCupKnockoutStage("final", "Final")).toBe(true);
    expect(isWorldCupKnockoutStage("regular", "")).toBe(false);
    expect(isWorldCupKnockoutStage("regular", "Pool A")).toBe(false);
  });

  it("splits flat rows into pool tables and truncates form", () => {
    const rows = standingRowsToTableRows([
      {
        rank: 1,
        teamName: "France",
        played: 4,
        won: 4,
        draw: 0,
        lost: 0,
        pointsDiff: 100,
        bonusPoints: 2,
        points: 18,
        form: "WWWWL",
        teamImageUrl: "https://flagcdn.com/w40/fr.png",
      },
      {
        rank: 2,
        teamName: "New Zealand",
        played: 4,
        won: 3,
        draw: 0,
        lost: 1,
        pointsDiff: 80,
        bonusPoints: 3,
        points: 15,
        form: "WWWL",
      },
    ]);
    const groups = splitRowsIntoWorldCupPools(rows, rugbyWorldCupPoolsForYear(2023));
    expect(groups).toHaveLength(4);
    const poolA = groups.find((g) => g.id === "A");
    expect(poolA?.formSlots).toBe(4);
    expect(poolA?.rows[0]?.teamName).toBe("France");
    expect(poolA?.rows[0]?.teamImageUrl).toBe("https://flagcdn.com/w40/fr.png");
    // Newest-first form WWWWL → LWWWW; keeping oldest 4 pool games drops the QF L → WWWW.
    expect(poolA?.rows[0]?.formSequence).toEqual(["W", "W", "W", "W"]);
    expect(poolA?.rows.some((r) => r.teamName === "Namibia")).toBe(true);
  });
});
