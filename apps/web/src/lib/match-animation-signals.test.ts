import { describe, expect, it } from "vitest";
import {
  estimateMatchClockFromKickoff,
  fieldZoneBand,
  fieldZoneFromBallX,
  formatMatchClock,
  parseSubstitutionNames,
  resolveAnimationMatchClock,
  resolveAnimationSignal,
  signalAnnouncement,
  signalHoldMs,
} from "./match-animation-signals";

describe("resolveAnimationSignal", () => {
  it("maps scrum, lineout, penalty, try, conversion with front goal view", () => {
    expect(resolveAnimationSignal({ eventType: "scrum", teamSide: "home" }).title).toBe("SCRUM");
    expect(resolveAnimationSignal({ eventType: "lineout", teamSide: "away" }).showLineoutArrow).toBe(
      true,
    );
    expect(resolveAnimationSignal({ eventType: "penalty", teamSide: "home" }).title).toBe("PENALTY");
    const trySig = resolveAnimationSignal({ eventType: "Try", teamSide: "home" });
    expect(trySig.title).toBe("TRY");
    expect(trySig.frontGoalView).toBe("try");
    const conv = resolveAnimationSignal({ eventType: "conversion", teamSide: "away" });
    expect(conv.title).toBe("CONVERSION");
    expect(conv.simulateConversion).toBe(true);
    expect(conv.frontGoalView).toBe("conversion");
    const miss = resolveAnimationSignal({ eventType: "missed_conversion", teamSide: "home" });
    expect(miss.frontGoalView).toBe("miss");
    expect(miss.title).toBe("CONVERSION MISSED");
  });

  it("maps dropout, free kick, injury, drop goal and penalty goal", () => {
    expect(resolveAnimationSignal({ eventType: "22_dropout", teamSide: "home" }).kind).toBe(
      "dropout",
    );
    expect(resolveAnimationSignal({ eventType: "free_kick", teamSide: "away" }).kind).toBe(
      "free_kick",
    );
    expect(resolveAnimationSignal({ eventType: "injury", teamSide: "home" }).title).toBe("INJURY");
    const dg = resolveAnimationSignal({ eventType: "drop_goal", teamSide: "away" });
    expect(dg.kind).toBe("drop_goal");
    expect(dg.frontGoalView).toBe("drop_goal");
    const pg = resolveAnimationSignal({ eventType: "penalty_goal", teamSide: "home" });
    expect(pg.kind).toBe("penalty_goal");
    expect(pg.frontGoalView).toBe("penalty_goal");
    const pen = resolveAnimationSignal({
      eventType: "penalty",
      teamSide: "home",
      label: "Penalty — Not releasing. Option: Kick to touch",
    });
    expect(pen.detail?.toLowerCase()).toMatch(/not releasing|kick to touch/);
  });

  it("maps TMO review, decision, and overturned", () => {
    expect(resolveAnimationSignal({ eventType: "tmo_review", teamSide: "neutral" }).title).toBe(
      "TMO REVIEW",
    );
    expect(resolveAnimationSignal({ eventType: "tmo_decision", teamSide: "home" }).kind).toBe(
      "tmo_decision",
    );
    expect(resolveAnimationSignal({ eventType: "tmo_overturned", teamSide: "away" }).title).toBe(
      "DECISION OVERTURNED",
    );
  });

  it("maps yellow card and substitution with on/off", () => {
    expect(resolveAnimationSignal({ eventType: "yellow_card", teamSide: "home" }).kind).toBe(
      "yellow_card",
    );
    const sub = resolveAnimationSignal({
      eventType: "substitution",
      teamSide: "away",
      label: "Off Smith / On Jones",
    });
    expect(sub.kind).toBe("substitution");
    expect(sub.playerOff).toMatch(/Smith/i);
    expect(sub.playerOn).toMatch(/Jones/i);
  });
});

describe("field zone + clock", () => {
  it("highlights attacking 22 for home possession", () => {
    expect(fieldZoneFromBallX(90, "home")).toBe("opp_22");
    expect(fieldZoneFromBallX(50, "home")).toBe("midfield");
    const band = fieldZoneBand("opp_22", "home");
    expect(band.x).toBeGreaterThan(70);
  });

  it("formats match clock", () => {
    expect(formatMatchClock(58, 7)).toBe("58:07");
    expect(formatMatchClock(5, 0)).toBe("05:00");
  });

  it("resolves live clock from events when CMS minute is stuck at 0", () => {
    const clock = resolveAnimationMatchClock({
      matchMinute: 0,
      matchSecond: 0,
      period: "not_started",
      events: [
        { minute: 2, second: 10 },
        { minute: 4, second: 9 },
      ],
      mode: "live",
    });
    expect(clock.label).toBe("04:09");
  });

  it("prefers CMS clock when ahead of events", () => {
    const clock = resolveAnimationMatchClock({
      matchMinute: 12,
      matchSecond: 30,
      events: [{ minute: 4, second: 0 }],
      mode: "live",
    });
    expect(clock.label).toBe("12:30");
  });

  it("estimates from kick-off when live with no CMS/events clock", () => {
    const kick = "2026-07-26T12:00:00.000Z";
    const now = "2026-07-26T12:08:20.000Z";
    expect(estimateMatchClockFromKickoff({ scheduledKickoffAt: kick, serverNowIso: now })?.minute).toBe(
      8,
    );
    const clock = resolveAnimationMatchClock({
      matchMinute: 0,
      matchSecond: 0,
      events: [],
      scheduledKickoffAt: kick,
      serverNowIso: now,
      mode: "live",
    });
    expect(clock.label).toBe("08:20");
  });

  it("uses scrubbed event for replay mode", () => {
    const clock = resolveAnimationMatchClock({
      matchMinute: 40,
      matchSecond: 0,
      events: [{ minute: 40, second: 0 }],
      currentEvent: { minute: 2, second: 5 },
      mode: "replay",
    });
    expect(clock.label).toBe("02:05");
  });
});

describe("substitution parse + a11y", () => {
  it("parses arrow substitutions", () => {
    expect(parseSubstitutionNames("Bloggs → Smith", null)).toEqual({
      off: "Bloggs",
      on: "Smith",
    });
  });

  it("announces signals with team and players", () => {
    expect(
      signalAnnouncement({
        title: "PENALTY AWARDED",
        teamName: "Japan XV",
      }),
    ).toBe("PENALTY AWARDED: Japan XV.");
    expect(
      signalAnnouncement({
        title: "SUBSTITUTION",
        teamName: "Bulls",
        playerOff: "A",
        playerOn: "B",
      }),
    ).toMatch(/Player off: A/);
  });

  it("shortens signal hold at high speed", () => {
    expect(signalHoldMs(10, false)).toBeLessThan(signalHoldMs(1, false));
  });
});
