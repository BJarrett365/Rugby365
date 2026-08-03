import { describe, expect, it } from "vitest";
import {
  PUBLIC_MATCH_TAB_ORDER,
  resolveMatchAnimationAvailability,
  type AnimationSettingsSnapshot,
} from "./match-animation-availability";
import { parseMatchDetailTab, matchDetailTabHref } from "./match-detail-tabs";
import { mapKeyEventsToAnimation, pitchPositionForEvent } from "./match-animation-events";

const baseSettings: AnimationSettingsSnapshot = {
  trackerActivated: false,
  publicAnimationEnabled: false,
  publicReplayEnabled: false,
  countdownHeld: false,
  countdownCancelled: false,
  kickOffDelayed: false,
  revisedKickoffAt: null,
  kickOffConfirmedAt: null,
  matchStartedAt: null,
  fullTimeConfirmedAt: null,
};

describe("PUBLIC_MATCH_TAB_ORDER", () => {
  it("places Animation, Watchalong, and Highlights after Match Details", () => {
    expect(PUBLIC_MATCH_TAB_ORDER[0]).toBe("details");
    expect(PUBLIC_MATCH_TAB_ORDER[1]).toBe("animation");
    expect(PUBLIC_MATCH_TAB_ORDER).toEqual([
      "details",
      "animation",
      "watchalong",
      "highlights",
      "stats",
      "player-stats",
      "lineups",
      "tables",
      "head-to-head",
      "betting",
    ]);
  });
});

describe("parseMatchDetailTab / shareable URL", () => {
  it("parses animation and media tabs", () => {
    expect(parseMatchDetailTab("animation")).toBe("animation");
    expect(parseMatchDetailTab("watchalong")).toBe("watchalong");
    expect(parseMatchDetailTab("highlights")).toBe("highlights");
    expect(parseMatchDetailTab("stats")).toBe("stats");
    expect(parseMatchDetailTab(undefined)).toBe("details");
  });

  it("builds shareable animation href", () => {
    expect(matchDetailTabHref("/matches/123/comp/1/a-v-b/2026-07-26", "animation")).toBe(
      "/matches/123/comp/1/a-v-b/2026-07-26?tab=animation",
    );
    expect(matchDetailTabHref("/matches/123/comp/1/a-v-b/2026-07-26", "details")).toBe(
      "/matches/123/comp/1/a-v-b/2026-07-26",
    );
  });
});

describe("resolveMatchAnimationAvailability", () => {
  it("shows countdown for scheduled fixtures without activation", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "Fixture",
      scheduledKickoffAt: "2026-07-26T16:05:00.000Z",
      serverNowIso: "2026-07-26T15:00:00.000Z",
      settings: baseSettings,
      publishedEventCount: 0,
    });
    expect(resolved.phase).toBe("countdown");
    expect(resolved.tabBadge).toBe("SOON");
    expect(resolved.showIntroCountdown).toBe(true);
  });

  it("waits for confirmation at zero without auto-live", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "scheduled",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T15:00:01.000Z",
      settings: baseSettings,
      publishedEventCount: 0,
    });
    expect(resolved.phase).toBe("waiting_confirmation");
    expect(resolved.message).toMatch(/kick-off confirmation/i);
  });

  it("handles delayed kick-off without revised time", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "scheduled",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T14:00:00.000Z",
      settings: { ...baseSettings, kickOffDelayed: true, revisedKickoffAt: null },
      publishedEventCount: 0,
    });
    expect(resolved.phase).toBe("kick_off_delayed");
    expect(resolved.message).toMatch(/awaiting an updated start time/i);
  });

  it("continues countdown with revised kick-off", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "scheduled",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T15:10:00.000Z",
      settings: {
        ...baseSettings,
        kickOffDelayed: true,
        revisedKickoffAt: "2026-07-26T15:30:00.000Z",
      },
      publishedEventCount: 0,
    });
    expect(resolved.phase).toBe("kick_off_delayed");
    expect(resolved.showIntroCountdown).toBe(true);
    expect(resolved.effectiveKickoffAt).toBe("2026-07-26T15:30:00.000Z");
  });

  it("marks live when animation activated", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "Live",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T15:20:00.000Z",
      settings: { ...baseSettings, publicAnimationEnabled: true, matchStartedAt: "2026-07-26T15:00:00.000Z" },
      publishedEventCount: 2,
    });
    expect(resolved.phase).toBe("live");
    expect(resolved.tabBadge).toBe("LIVE");
    expect(resolved.showLiveControls).toBe(true);
  });

  it("blocks live when not activated", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "Live",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T15:20:00.000Z",
      settings: baseSettings,
      publishedEventCount: 0,
    });
    expect(resolved.phase).toBe("not_activated");
    expect(resolved.message).toMatch(/not been activated/i);
  });

  it("shows full-time result when fixture is confirmed finished", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "result",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T17:00:00.000Z",
      settings: baseSettings,
      publishedEventCount: 5,
    });
    expect(resolved.phase).toBe("full_time");
    expect(resolved.tabBadge).toBe("REPLAY");
    expect(resolved.showFullTimeResult).toBe(true);
    expect(resolved.fullTimeConfirmed).toBe(true);
    expect(resolved.showReplayControls).toBe(true);
  });

  it("shows full-time screen without auto-replay when no events", () => {
    const resolved = resolveMatchAnimationAvailability({
      fixtureStatus: "finished",
      scheduledKickoffAt: "2026-07-26T15:00:00.000Z",
      serverNowIso: "2026-07-26T17:00:00.000Z",
      settings: { ...baseSettings, publicAnimationEnabled: true },
      publishedEventCount: 0,
    });
    expect(resolved.phase).toBe("full_time");
    expect(resolved.showFullTimeResult).toBe(true);
    expect(resolved.showReplayControls).toBe(false);
  });

  it("handles postponed, cancelled, abandoned, awarded", () => {
    expect(
      resolveMatchAnimationAvailability({
        fixtureStatus: "Postponed",
        scheduledKickoffAt: null,
        serverNowIso: "2026-07-26T12:00:00.000Z",
        settings: baseSettings,
        publishedEventCount: 0,
      }).phase,
    ).toBe("postponed");
    expect(
      resolveMatchAnimationAvailability({
        fixtureStatus: "Cancelled",
        scheduledKickoffAt: null,
        serverNowIso: "2026-07-26T12:00:00.000Z",
        settings: baseSettings,
        publishedEventCount: 0,
      }).phase,
    ).toBe("cancelled");
    expect(
      resolveMatchAnimationAvailability({
        fixtureStatus: "abandoned",
        scheduledKickoffAt: null,
        serverNowIso: "2026-07-26T12:00:00.000Z",
        settings: baseSettings,
        publishedEventCount: 2,
      }).showFullTimeResult,
    ).toBe(true);
    expect(
      resolveMatchAnimationAvailability({
        fixtureStatus: "awarded",
        scheduledKickoffAt: null,
        serverNowIso: "2026-07-26T12:00:00.000Z",
        settings: baseSettings,
        publishedEventCount: 0,
      }).phase,
    ).toBe("awarded");
  });
});

describe("animation events / pitch", () => {
  it("maps key events with accessible labels", () => {
    const mapped = mapKeyEventsToAnimation(
      [
        {
          id: "e1",
          minute: 12,
          type_string: "Try",
          player_name: "Smith",
          home_team: true,
        },
      ],
      "home-1",
    );
    expect(mapped[0]?.label).toMatch(/Try/i);
    expect(mapped[0]?.label).toMatch(/Smith/);
    expect(mapped[0]?.teamSide).toBe("home");
  });

  it("places tries near the attacking try-line", () => {
    const homeTry = pitchPositionForEvent({ eventType: "try", teamSide: "home", index: 0 });
    const awayTry = pitchPositionForEvent({ eventType: "try", teamSide: "away", index: 0 });
    expect(homeTry.x).toBeGreaterThan(80);
    expect(awayTry.x).toBeLessThan(20);
  });
});
