import { describe, expect, it } from "vitest";
import {
  normalizeRoundKey,
  selectImpactBench,
  selectStartingXv,
  validateStartingXv,
  type TotwCandidate,
} from "./team-of-week-math";

function candidate(
  partial: Partial<TotwCandidate> & Pick<TotwCandidate, "playerId" | "jerseyNumber" | "matchRating">,
): TotwCandidate {
  return {
    playerName: `Player ${partial.playerId}`,
    playerSlug: null,
    imageUrl: null,
    teamId: "t1",
    teamName: "Test FC",
    teamSlug: "test-fc",
    teamImageUrl: null,
    fixtureId: "f1",
    positionName: null,
    squadRole: "starter",
    stats: {
      tries: 0,
      tryAssists: 0,
      tacklesMade: 10,
      tacklesCompleted: 10,
      dominantTackles: 1,
      turnoversWon: 1,
      carries: 5,
      metresCarried: 30,
      lineBreaks: 0,
      defendersBeaten: 0,
      points: 0,
      minutesPlayed: 80,
      missedTackles: 0,
      offloads: 0,
      passes: 0,
      kicksFromHand: 0,
    },
    wonMatch: true,
    ...partial,
  };
}

describe("team-of-week-math", () => {
  it("normalizes round keys", () => {
    expect(normalizeRoundKey("Round 7")).toBe("round-7");
    expect(normalizeRoundKey("round 07")).toBe("round-7");
    expect(normalizeRoundKey("Semi-final")).toBe("semi-final");
  });

  it("builds a valid starting XV without duplicate players", () => {
    const candidates = Array.from({ length: 23 }, (_, i) =>
      candidate({
        playerId: `p${i + 1}`,
        jerseyNumber: (i % 15) + 1,
        matchRating: 8.5 - i * 0.05,
        teamId: i % 2 === 0 ? "t1" : "t2",
        teamName: i % 2 === 0 ? "Home" : "Away",
      }),
    );
    // Ensure each shirt 1-15 has a strong candidate
    for (let shirt = 1; shirt <= 15; shirt++) {
      candidates.push(
        candidate({
          playerId: `slot-${shirt}`,
          jerseyNumber: shirt,
          matchRating: 9.0,
        }),
      );
    }

    const { starting, usedIds } = selectStartingXv(candidates);
    const check = validateStartingXv(starting);
    expect(check.ok).toBe(true);
    expect(starting).toHaveLength(15);
    expect(new Set(starting.map((p) => p.candidate.playerId)).size).toBe(15);

    const bench = selectImpactBench(candidates, usedIds);
    expect(bench.length).toBeGreaterThan(0);
    for (const b of bench) {
      expect(usedIds.has(b.candidate.playerId)).toBe(false);
    }
    const allIds = [...starting, ...bench].map((p) => p.candidate.playerId);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("does not put a winger at loosehead when props exist", () => {
    const candidates = [
      candidate({
        playerId: "wing",
        jerseyNumber: 14,
        matchRating: 9.9,
        positionName: "Right Wing",
      }),
      candidate({
        playerId: "prop",
        jerseyNumber: 1,
        matchRating: 7.5,
        positionName: "Loosehead Prop",
      }),
      ...Array.from({ length: 14 }, (_, i) =>
        candidate({
          playerId: `fill-${i + 2}`,
          jerseyNumber: i + 2,
          matchRating: 7.2,
        }),
      ),
    ];
    const { starting } = selectStartingXv(candidates);
    const one = starting.find((p) => p.slot.shirt === 1);
    expect(one?.candidate.playerId).toBe("prop");
  });
});
