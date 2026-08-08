import { describe, expect, it } from "vitest";
import {
  dedupePublicKeyEvents,
  formatMatchEventMinute,
  isHomeSideKeyEvent,
  mapCmsEventsToPublicKeyEvents,
  mapSdmsEventsToPublicKeyEvents,
  pairSubstitutionKeyEvents,
  selectPublicKeyEvents,
} from "./match-key-events";

describe("formatMatchEventMinute", () => {
  it("rounds to whole minutes without seconds", () => {
    expect(formatMatchEventMinute(2)).toBe("2'");
    expect(formatMatchEventMinute(63)).toBe("63'");
    expect(formatMatchEventMinute(2.9)).toBe("2'");
  });
});

describe("isHomeSideKeyEvent", () => {
  it("matches either CMS uuid or SDMS provider id", () => {
    expect(isHomeSideKeyEvent("294zzzj8", ["7b1ee9db-a8ee-4db6-88a5-425212c63001", "294zzzj8"])).toBe(
      true,
    );
    expect(
      isHomeSideKeyEvent("7b1ee9db-a8ee-4db6-88a5-425212c63001", [
        "7b1ee9db-a8ee-4db6-88a5-425212c63001",
        "294zzzj8",
      ]),
    ).toBe(true);
    expect(isHomeSideKeyEvent("m98e2y9x", ["294zzzj8", "7b1ee9db-a8ee-4db6-88a5-425212c63001"])).toBe(
      false,
    );
  });
});

describe("selectPublicKeyEvents", () => {
  it("prefers the fuller SDMS timeline over sparse CMS scoring rows", () => {
    const cms = [
      { type: "Try", minute: 3, team_id: "home", player_name: "A" },
      { type: "Try", minute: 21, team_id: "away", player_name: "B" },
    ];
    const sdms = [
      ...cms,
      { type: "Sub On", minute: 20, team_id: "home", player_name: "C", player_on: "C" },
      { type: "Conversion", minute: 25, team_id: "home", player_name: "D" },
      { type: "Try", minute: 48, team_id: "home", player_name: "E" },
    ];
    const selected = selectPublicKeyEvents(sdms, cms);
    expect(selected).toBe(sdms);
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

describe("dedupePublicKeyEvents", () => {
  it("reads rugby_data player_name and collapses dual-import scoring rows", () => {
    const events = mapCmsEventsToPublicKeyEvents([
      {
        id: "rd",
        minute: 3,
        second: 0,
        eventType: "try",
        teamId: "11111111-1111-1111-1111-111111111111",
        playerId: null,
        payload: {
          score: "0-5",
          player_name: "Barham Tom",
          provider_type: "Try",
        },
      },
      {
        id: "sdms",
        minute: 3,
        second: 0,
        eventType: "try",
        teamId: "11111111-1111-1111-1111-111111111111",
        playerId: "p1",
        payload: {
          type: "Try",
          player: "Tom Barham",
          team_provider_id: "north-harbour",
          // SDMS rows often omit scoreline; rugby_data carries "0-5".
          home_score: null,
          away_score: null,
        },
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.player_name).toBe("Tom Barham");
    expect(events[0]!.team_id).toBe("north-harbour");
    expect(events[0]!.home_score).toBe(0);
    expect(events[0]!.away_score).toBe(5);
  });

  it("merges blank rugby_data shell with named SDMS twin", () => {
    const events = mapCmsEventsToPublicKeyEvents([
      {
        id: "rd",
        minute: 10,
        second: 0,
        eventType: "try",
        teamId: "22222222-2222-2222-2222-222222222222",
        playerId: null,
        payload: { score: "5-5", player_name: null, provider_type: "Try" },
      },
      {
        id: "sdms",
        minute: 10,
        second: 0,
        eventType: "try",
        teamId: "22222222-2222-2222-2222-222222222222",
        playerId: "p2",
        payload: {
          type: "Try",
          player: "Leo Marfell",
          team_provider_id: "tasman",
        },
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]!.player_name).toBe("Leo Marfell");
    expect(events[0]!.home_score).toBe(5);
    expect(events[0]!.away_score).toBe(5);
  });

  it("keeps distinct tries in the same minute when scores differ", () => {
    const events = dedupePublicKeyEvents([
      { type: "Try", minute: 42, team_id: "a", player_name: "One", home_score: 12, away_score: 15 },
      { type: "Try", minute: 42, team_id: "a", player_name: "Two", home_score: 17, away_score: 15 },
    ]);
    expect(events).toHaveLength(2);
  });
});
