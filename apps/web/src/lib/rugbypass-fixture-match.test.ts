import { describe, expect, it } from "vitest";
import {
  fixtureTeamsLikelyMatch,
  pickStoredFixtureForRugbyPassMatch,
  pickStoredFixtureForYoutubeHighlight,
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

describe("pickStoredFixtureForYoutubeHighlight", () => {
  it("fuzzy-matches sponsored titles to CMS names and requires same round", () => {
    const id = pickStoredFixtureForYoutubeHighlight(
      [
        {
          id: "fx-r2",
          kickoffAt: new Date("2026-07-26T14:00:00.000Z"),
          competitionName: "Currie Cup",
          round: "Round 2",
          homeName: "Boland Cavaliers",
          awayName: "DHL Stormers XXIII",
        },
        {
          id: "fx-r3",
          kickoffAt: new Date("2026-08-01T14:00:00.000Z"),
          competitionName: "Currie Cup",
          round: "Round 3",
          homeName: "Boland Cavaliers",
          awayName: "DHL Stormers XXIII",
        },
      ],
      {
        kickoffAt: new Date("2026-07-26T18:00:00.000Z"),
        homeName: "Boland Cavaliers",
        awayName: "Stormers",
        competitionName: "Currie Cup Round 2",
        roundNumber: 2,
      },
    );
    expect(id).toBe("fx-r2");
  });

  it("matches Lions / Bulls sponsored titles", () => {
    const id = pickStoredFixtureForYoutubeHighlight(
      [
        {
          id: "fx-lions",
          kickoffAt: new Date("2026-08-01T14:00:00.000Z"),
          competitionName: "Currie Cup",
          round: "Round 3",
          homeName: "Lions",
          awayName: "Bulls",
        },
      ],
      {
        kickoffAt: new Date("2026-08-01T20:00:00.000Z"),
        homeName: "Lions",
        awayName: "Bulls",
        competitionName: "Currie Cup Round 3",
        roundNumber: 3,
      },
    );
    expect(id).toBe("fx-lions");
  });
});
