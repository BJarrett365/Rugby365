import { describe, expect, it } from "vitest";
import {
  buildDepthSummary,
  buildModelledStartingXv,
  buildPositionBattles,
} from "./team-compare-intelligence";
import type { TeamSquadPlayerRow } from "./team-squad-intelligence-types";

function p(
  partial: Partial<TeamSquadPlayerRow> & Pick<TeamSquadPlayerRow, "id" | "name" | "positionName">,
): TeamSquadPlayerRow {
  return {
    slug: partial.slug ?? partial.id,
    rating: partial.rating ?? 80,
    marketValueGbp: partial.marketValueGbp ?? 100_000,
    marketValueLabel: partial.marketValueLabel ?? "£100k",
    age: partial.age ?? 27,
    squadRole: partial.squadRole ?? "squad",
    ...partial,
  };
}

describe("team-compare-intelligence", () => {
  const squadA = [
    p({ id: "a1", name: "A LH", positionName: "loosehead prop", rating: 88 }),
    p({ id: "a2", name: "A HK", positionName: "hooker", rating: 84 }),
    p({ id: "a10", name: "A FH", positionName: "fly-half", rating: 91 }),
    p({ id: "a15", name: "A FB", positionName: "fullback", rating: 86 }),
  ];
  const squadB = [
    p({ id: "b1", name: "B LH", positionName: "loosehead prop", rating: 82 }),
    p({ id: "b2", name: "B HK", positionName: "hooker", rating: 90 }),
    p({ id: "b10", name: "B FH", positionName: "fly-half", rating: 87 }),
    p({ id: "b15", name: "B FB", positionName: "full-back", rating: 85 }),
  ];

  it("builds a 15-slot modelled XV", () => {
    const xv = buildModelledStartingXv(squadA);
    expect(xv).toHaveLength(15);
    expect(xv.find((s) => s.jersey === 10)?.player?.name).toBe("A FH");
  });

  it("picks position battle winners by rating", () => {
    const battles = buildPositionBattles(squadA, squadB);
    const hk = battles.find((b) => b.key === "hk");
    const ten = battles.find((b) => b.key === "ten");
    expect(hk?.winner).toBe("b");
    expect(ten?.winner).toBe("a");
    expect(ten?.compareHref).toContain("/compare/");
  });

  it("summarises depth and youth", () => {
    const summary = buildDepthSummary([
      p({ id: "1", name: "Young", positionName: "wing", age: 21, squadRole: "starting", rating: 78 }),
      p({ id: "2", name: "Vet", positionName: "lock", age: 32, squadRole: "bench", rating: 84 }),
    ]);
    expect(summary.under23Count).toBe(1);
    expect(summary.over30Count).toBe(1);
    expect(summary.depthScore).not.toBeNull();
  });
});
