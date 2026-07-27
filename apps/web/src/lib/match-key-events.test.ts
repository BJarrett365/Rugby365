import { describe, expect, it } from "vitest";
import {
  formatMatchEventMinute,
  mapCmsEventsToPublicKeyEvents,
  mapSdmsEventsToPublicKeyEvents,
  pairSubstitutionKeyEvents,
} from "./match-key-events";

describe("formatMatchEventMinute", () => {
  it("rounds to whole minutes without seconds", () => {
    expect(formatMatchEventMinute(2)).toBe("2'");
    expect(formatMatchEventMinute(63)).toBe("63'");
    expect(formatMatchEventMinute(2.9)).toBe("2'");
  });
});

describe("pairSubstitutionKeyEvents", () => {
  it("pairs Sub On and Sub Off at the same minute/second/team", () => {
    const paired = pairSubstitutionKeyEvents([
      {
        type: "Sub Off",
        minute: 63,
        second: 12,
        team_id: "home",
        player_name: "Marlyn Williams",
        player_off: "Marlyn Williams",
      },
      {
        type: "Sub On",
        minute: 63,
        second: 12,
        team_id: "home",
        player_name: "Khwezi Mafu",
        player_on: "Khwezi Mafu",
      },
    ]);
    expect(paired).toHaveLength(1);
    expect(paired[0]!.player_on).toBe("Khwezi Mafu");
    expect(paired[0]!.player_off).toBe("Marlyn Williams");
    expect(paired[0]!.type).toBe("substitution");
  });

  it("maps CMS payload Sub On/Off rows", () => {
    const events = mapCmsEventsToPublicKeyEvents([
      {
        id: "1",
        minute: 36,
        second: 27,
        eventType: "substitution",
        teamId: "uuid-a",
        playerId: "p1",
        payload: {
          type: "Sub Off",
          player: "Oliver Kebble",
          team_provider_id: "stormers",
        },
      },
      {
        id: "2",
        minute: 36,
        second: 27,
        eventType: "substitution",
        teamId: "uuid-a",
        playerId: "p2",
        payload: {
          type: "Sub On",
          player: "Mhleli Khuzwayo",
          team_provider_id: "stormers",
        },
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.player_on).toBe("Mhleli Khuzwayo");
    expect(events[0]!.player_off).toBe("Oliver Kebble");
    expect(events[0]!.team_id).toBe("stormers");
  });

  it("pairs SDMS Player On / Player Off", () => {
    const events = mapSdmsEventsToPublicKeyEvents([
      { type: "Player Off", minute: 63, second: 0, team_id: "t1", player_name: "Marlyn Williams" },
      { type: "Player On", minute: 63, second: 0, team_id: "t1", player_name: "Khwezi Mafu" },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.player_on).toBe("Khwezi Mafu");
    expect(events[0]!.player_off).toBe("Marlyn Williams");
  });
});
