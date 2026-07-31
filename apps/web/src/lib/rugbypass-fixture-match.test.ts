import { describe, expect, it } from "vitest";
import {
  fixtureTeamsLikelyMatch,
  pickStoredFixtureForRugbyPassMatch,
} from "./rugbypass-fixture-match";

describe("rugbypass fixture team matching", () => {
  it("matches Kavaliers to Boland Cavaliers", () => {
    expect(fixtureTeamsLikelyMatch("Kavaliers", "Boland Cavaliers")).toBe(true);
    expect(fixtureTeamsLikelyMatch("Boland Cavaliers", "Kavaliers")).toBe(true);
  });

  it("matches sponsored / roman Stormers labels", () => {
    expect(fixtureTeamsLikelyMatch("Stormers XXIII", "DHL Stormers XXIII")).toBe(true);
    expect(fixtureTeamsLikelyMatch("DHL Stormers", "Stormers XXIII")).toBe(true);
  });

  it("matches Lions aliases", () => {
    expect(fixtureTeamsLikelyMatch("Lions", "Golden Lions")).toBe(true);
  });

  it("does not match unrelated clubs", () => {
    expect(fixtureTeamsLikelyMatch("Griffons", "Pumas")).toBe(false);
  });
});

describe("pickStoredFixtureForRugbyPassMatch", () => {
  const kickoff = new Date("2026-07-26T14:00:00.000Z");

  it("links RugbyPass appearance to existing CMS fixture on same day", () => {
    const id = pickStoredFixtureForRugbyPassMatch(
      [
        {
          id: "fx-1",
          kickoffAt: kickoff,
          slug: "boland-cavaliers-v-dhl-stormers-xxiii-2026-07-26",
          competitionName: "Currie Cup",
          homeName: "Boland Cavaliers",
          awayName: "DHL Stormers XXIII",
        },
      ],
      {
        kickoffAt: kickoff,
        teamName: "Kavaliers",
        opponentName: "Stormers XXIII",
        competitionName: "Currie Cup",
        matchTitle: "Kavaliers vs Stormers XXIII",
      },
    );
    expect(id).toBe("fx-1");
  });

  it("returns null when no stored fixture matches (no duplicate create)", () => {
    const id = pickStoredFixtureForRugbyPassMatch(
      [
        {
          id: "fx-2",
          kickoffAt: kickoff,
          competitionName: "Currie Cup",
          homeName: "Griffons",
          awayName: "Pumas",
        },
      ],
      {
        kickoffAt: kickoff,
        teamName: "Kavaliers",
        opponentName: "Stormers XXIII",
        competitionName: "Currie Cup",
      },
    );
    expect(id).toBeNull();
  });

  it("allows ±1 day timezone drift when teams match", () => {
    const id = pickStoredFixtureForRugbyPassMatch(
      [
        {
          id: "fx-3",
          kickoffAt: new Date("2026-07-25T22:00:00.000Z"),
          competitionName: "Currie Cup",
          homeName: "Boland Cavaliers",
          awayName: "DHL Stormers XXIII",
        },
      ],
      {
        kickoffAt: new Date("2026-07-26T01:00:00.000Z"),
        teamName: "Kavaliers",
        opponentName: "Stormers XXIII",
        competitionName: "Currie Cup",
      },
    );
    expect(id).toBe("fx-3");
  });
});
