import { describe, expect, it } from "vitest";
import { fillCommentaryMinuteGaps } from "./match-narrative-gap-fill";
import type { NarrativeCommentaryLine, NarrativeMatchContext } from "./match-narrative-commentary";

const ctx: NarrativeMatchContext = {
  homeName: "Boland Cavaliers",
  awayName: "Pumas",
  competitionName: "Currie Cup",
  homeSquad: [{ jerseyNumber: 10, name: "Chris Smit", squadRole: "starting" }],
  awaySquad: [{ jerseyNumber: 10, name: "Nevaldo Fleurs", squadRole: "starting" }],
  events: [
    {
      minute: 7,
      eventType: "penalty_goal",
      teamName: "Pumas",
      homeScore: 0,
      awayScore: 3,
    },
  ],
  winPrediction: {
    favoriteName: "Boland Cavaliers",
    homePercent: 55,
    awayPercent: 42,
    drawPercent: 3,
  },
  playerStatHighlights: [
    { playerName: "Nevaldo Fleurs", teamName: "Pumas", label: "points", value: 12 },
  ],
  finalHomeScore: 12,
  finalAwayScore: 17,
  status: "full_time",
};

describe("match narrative gap fill", () => {
  it("pads every empty minute through the match window", () => {
    const existing: NarrativeCommentaryLine[] = [
      {
        minute: 1,
        second: 0,
        outputType: "phase_play_update",
        segment: "kick_off",
        body: "1' — underway",
      },
      {
        minute: 7,
        second: 0,
        outputType: "score_update",
        segment: "match_event",
        body: "7' — penalty",
      },
    ];
    const filled = fillCommentaryMinuteGaps(existing, ctx, 20);
    const minutes = new Set(filled.filter((l) => l.minute >= 1).map((l) => l.minute));
    for (let m = 1; m <= 20; m += 1) {
      expect(minutes.has(m)).toBe(true);
    }
    expect(filled.some((l) => l.segment === "player_spotlight" || l.segment === "betting_intelligence")).toBe(
      true,
    );
  });
});
