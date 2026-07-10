import { describe, expect, it } from "vitest";
import { getRugbyTableDefinition } from "./table-definition-service";
import { splitRowsByHemisphere } from "./table-hemisphere-shared";
import type { RugbyTableStandingRow } from "./table-types";
import {
  nationsChampionshipHemisphereForTeam,
  NATIONS_CHAMPIONSHIP_NORTHERN_TEAMS,
  NATIONS_CHAMPIONSHIP_SOUTHERN_TEAMS,
} from "../nations-championship-hemisphere";

function row(teamName: string, leaguePoints: number, rank = 0): RugbyTableStandingRow {
  return {
    rank,
    teamId: teamName.toLowerCase().replace(/\s+/g, "-"),
    teamName,
    played: 1,
    won: leaguePoints >= 4 ? 1 : 0,
    drawn: 0,
    lost: leaguePoints >= 4 ? 0 : 1,
    pointsFor: 20,
    pointsAgainst: 10,
    pointsDiff: 10,
    bonusPoints: 0,
    leaguePoints,
  };
}

describe("nationsChampionshipHemisphereForTeam", () => {
  it("maps official northern teams", () => {
    for (const team of NATIONS_CHAMPIONSHIP_NORTHERN_TEAMS) {
      expect(nationsChampionshipHemisphereForTeam(team)).toBe("northern");
    }
  });

  it("maps official southern teams including Japan", () => {
    for (const team of NATIONS_CHAMPIONSHIP_SOUTHERN_TEAMS) {
      expect(nationsChampionshipHemisphereForTeam(team)).toBe("southern");
    }
    expect(nationsChampionshipHemisphereForTeam("Japan")).toBe("southern");
  });
});

describe("splitRowsByHemisphere", () => {
  it("splits and re-ranks within each hemisphere", () => {
    const definition = getRugbyTableDefinition("hemisphere_table")!;
    const groups = splitRowsByHemisphere(
      [
        row("England", 0, 6),
        row("Wales", 5, 1),
        row("South Africa", 5, 1),
        row("Fiji", 0, 6),
      ],
      definition,
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.label).toBe("Northern Hemisphere");
    expect(groups[0]?.rows.map((r) => r.teamName)).toEqual(["Wales", "England"]);
    expect(groups[0]?.rows[0]?.rank).toBe(1);
    expect(groups[1]?.rows.map((r) => r.teamName)).toEqual(["South Africa", "Fiji"]);
  });
});
