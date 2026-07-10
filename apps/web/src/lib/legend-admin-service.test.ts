import { describe, expect, it } from "vitest";
import {
  highestLegendLevel,
  isActiveLegend,
} from "./legend-admin-service";
import {
  LEGEND_LEVELS,
  legendLevelLabel,
  normalizeLegendLevel,
} from "./legend-types";
import type { LegendRow } from "./legend-admin-service";

describe("legend types", () => {
  it("normalizes legend level labels", () => {
    expect(normalizeLegendLevel("Club Legend")).toBe("club_legend");
    expect(normalizeLegendLevel("Hall of Fame")).toBe("hall_of_fame");
    expect(normalizeLegendLevel("Rugby Icon")).toBe("rugby_icon");
  });

  it("labels all supported legend levels", () => {
    for (const level of LEGEND_LEVELS) {
      expect(legendLevelLabel(level)).toBeTruthy();
    }
  });
});

describe("legend helpers", () => {
  const sample = (level: LegendRow["legendLevel"], status: LegendRow["legendStatus"] = "active"): LegendRow => ({
    id: "1",
    playerId: "p1",
    playerName: "Player",
    playerSlug: "player",
    playerPosition: "wing",
    legendStatus: status,
    legendLevel: level,
    legendLevelLabel: legendLevelLabel(level),
    teamId: null,
    teamName: null,
    competitionId: null,
    competitionName: null,
    countryName: null,
    internationalTeamId: null,
    internationalTeamName: null,
    era: null,
    reason: null,
    careerSummary: null,
    keyAchievements: [],
    notableStats: {},
    editorNotes: null,
    sourceUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it("detects active legend status", () => {
    expect(isActiveLegend([sample("club_legend")])).toBe(true);
    expect(isActiveLegend([sample("club_legend", "inactive")])).toBe(false);
  });

  it("picks the highest active legend level", () => {
    expect(
      highestLegendLevel([sample("club_legend"), sample("international_legend")]),
    ).toBe("international_legend");
    expect(highestLegendLevel([sample("rugby_icon"), sample("hall_of_fame")])).toBe("hall_of_fame");
    expect(highestLegendLevel([sample("club_legend", "inactive")])).toBeNull();
  });
});
