import { describe, expect, it } from "vitest";
import {
  attackDirectionForSide,
  buildMatchControlRows,
  buildSetPieceDefenceRows,
  normalizeTeamStatSide,
  resolvePitchIntensity,
} from "./match-animation-insight";

describe("attackDirectionForSide", () => {
  it("home attacks right in first half and left after half-time", () => {
    expect(attackDirectionForSide("home", "first_half")).toBe("right");
    expect(attackDirectionForSide("away", "first_half")).toBe("left");
    expect(attackDirectionForSide("home", "second_half")).toBe("left");
    expect(attackDirectionForSide("away", "second_half")).toBe("right");
  });
});

describe("resolvePitchIntensity", () => {
  it("marks opposition 22 as dangerous", () => {
    expect(resolvePitchIntensity({ fieldZone: "opp_22" })).toBe("dangerous");
    expect(resolvePitchIntensity({ fieldZone: "midfield" })).toBe("attack");
    expect(resolvePitchIntensity({ fieldZone: "own_22" })).toBe("possession");
  });
});

describe("team stat rows", () => {
  it("hides empty control measures and formats possession", () => {
    const home = normalizeTeamStatSide({
      carries: 40,
      metres: 280,
      sections: { possession: 54, territory: 58, clean_breaks: 3 },
    });
    const away = normalizeTeamStatSide({
      carries: 32,
      metres: 210,
      sections: { possession: 46, territory: 42, clean_breaks: 1 },
    });
    const rows = buildMatchControlRows(home, away);
    expect(rows.map((r) => r.label)).toEqual([
      "Possession",
      "Territory",
      "Carries",
      "Metres carried",
      "Clean breaks",
    ]);
    expect(rows[0]?.home).toBe("54%");
  });

  it("builds set-piece rows from available fields only", () => {
    const home = normalizeTeamStatSide({
      tackles: 90,
      turnoversWon: 4,
      penalties: 7,
      sections: { scrums_won: 5, scrums_lost: 1, lineouts_won: 8 },
    });
    const away = normalizeTeamStatSide({
      tackles: 100,
      turnoversWon: 2,
      penalties: 5,
      sections: { scrums_won: 4, scrums_lost: 2, lineouts_won: 6 },
    });
    const rows = buildSetPieceDefenceRows(home, away, {
      homeYellow: 1,
      awayYellow: 0,
      homeRed: 0,
      awayRed: 0,
    });
    expect(rows.some((r) => r.label === "Scrums" && r.home === "5/1")).toBe(true);
    expect(rows.some((r) => r.label === "Yellow cards")).toBe(true);
  });
});
