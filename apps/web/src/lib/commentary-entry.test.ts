import { describe, expect, it } from "vitest";
import { buildCommentaryBody } from "./commentary-entry";

describe("buildCommentaryBody", () => {
  it("builds international try line with player role", () => {
    const { body } = buildCommentaryBody({
      minute: 23,
      phase: "match_event",
      action: "try",
      teamSide: "away",
      homeName: "Barbarians",
      awayName: "Wales",
      playerName: "Dan Edwards",
      playerRole: " (fly-half, Ospreys)",
    });
    expect(body).toBe("23' TRY! Dan Edwards (fly-half, Ospreys) scores for Wales!");
  });

  it("builds kick off line", () => {
    const { body } = buildCommentaryBody({
      minute: 0,
      phase: "kick_off",
      homeName: "Barbarians",
      awayName: "Wales",
      venueName: "Allianz Stadium, London",
    });
    expect(body).toBe(
      "KICK OFF! Barbarians vs Wales at Allianz Stadium, London gets underway.",
    );
  });

  it("builds half time scoreline", () => {
    const { body } = buildCommentaryBody({
      minute: 40,
      phase: "half_time",
      homeName: "Barbarians",
      awayName: "Wales",
      homeScore: 31,
      awayScore: 33,
    });
    expect(body).toBe("HALF TIME — Barbarians 31–33 Wales.");
  });
});
