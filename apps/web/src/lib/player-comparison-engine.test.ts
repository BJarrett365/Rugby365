import { describe, expect, it } from "vitest";
import {
  buildPlayerComparisonMetrics,
  comparisonPeerSubtitle,
  pickDefaultComparisonPeer,
  scoreComparisonPeerRelevance,
} from "./player-comparison-engine";

describe("player-comparison-engine", () => {
  it("keeps missing metrics as null (never 0)", () => {
    const rows = buildPlayerComparisonMetrics(
      { kicking: 94, playmaking: null, overall: 88 },
      { kicking: 90, playmaking: 87, defence: undefined, overall: null },
    );
    const playmaking = rows.find((r) => r.key === "playmaking");
    expect(playmaking?.left).toBeNull();
    expect(playmaking?.right).toBe(87);
    const overall = rows.find((r) => r.key === "overall");
    expect(overall?.right).toBeNull();
    const defence = rows.find((r) => r.key === "defence");
    expect(defence?.left).toBeNull();
    expect(defence?.right).toBeNull();
  });

  it("includes Overall last", () => {
    const rows = buildPlayerComparisonMetrics({ overall: 80 }, { overall: 75 });
    expect(rows.at(-1)?.key).toBe("overall");
  });

  it("builds VS TOP subtitle from position peer label", () => {
    expect(comparisonPeerSubtitle("Fly-Half")).toBe("VS TOP FLY-HALVES");
    expect(comparisonPeerSubtitle("Prop")).toBe("VS TOP PROPS");
  });

  it("picks relevant same-position peer — not hardcoded", () => {
    const pick = pickDefaultComparisonPeer([
      {
        id: "a",
        samePosition: true,
        rating: 72,
        subjectRating: 88,
        sameCompetition: false,
        sameNation: false,
      },
      {
        id: "b",
        samePosition: true,
        rating: 86,
        subjectRating: 88,
        sameCompetition: true,
        sameNation: false,
      },
      {
        id: "c",
        samePosition: false,
        rating: 95,
        subjectRating: 88,
        sameCompetition: true,
        sameNation: true,
      },
    ]);
    expect(pick?.id).toBe("b");
    expect(scoreComparisonPeerRelevance({
      samePosition: false,
      rating: 99,
      subjectRating: 88,
      sameCompetition: true,
      sameNation: true,
    })).toBeLessThan(0);
  });
});
