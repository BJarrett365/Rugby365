import { describe, expect, it } from "vitest";
import {
  clampPresenterCount,
  clampSpeechSpeed,
  competitionScopeFromSlugOrName,
  formatCreatorProfileLabel,
  normalizeDeliveryStyle,
  normalizeTtsProvider,
  normalizeVoiceStyle,
  preferredAccentFiltersForScope,
  rolesForPresenterCount,
  tonePresetSettings,
} from "./audio-voice-settings";

describe("audio-voice-settings helpers", () => {
  it("maps competition slug/name to regional scopes", () => {
    expect(competitionScopeFromSlugOrName("currie-cup-premier", null)).toBe("currie_cup");
    expect(competitionScopeFromSlugOrName(null, "Currie Cup First Division")).toBe(
      "currie_cup",
    );
    expect(competitionScopeFromSlugOrName("premiership", "Gallagher Premiership")).toBe(
      "premiership",
    );
    expect(competitionScopeFromSlugOrName("mlr", "Major League Rugby")).toBe("mlr");
    expect(competitionScopeFromSlugOrName("npc", "Bunnings NPC")).toBe("npc");
    expect(competitionScopeFromSlugOrName("top-14", "Top 14")).toBe("top14");
    expect(competitionScopeFromSlugOrName("urc", "United Rugby Championship")).toBe("urc");
    expect(
      competitionScopeFromSlugOrName("nations-championship", "Nations Championship"),
    ).toBe("nations_championship");
    expect(
      competitionScopeFromSlugOrName(null, "World Rugby Nations Championship"),
    ).toBe("nations_championship");
    expect(competitionScopeFromSlugOrName("six-nations", "Six Nations")).toBe("six_nations");
    expect(competitionScopeFromSlugOrName("super-rugby-pacific", "Super Rugby")).toBe(
      "super_rugby",
    );
    expect(competitionScopeFromSlugOrName("champions-cup", "Investec Champions Cup")).toBe(
      "champions_cup",
    );
  });

  it("formats Creator Profile labels Plexa-style", () => {
    expect(
      formatCreatorProfileLabel({
        displayName: "Currie Cup Lead (SA)",
        organisationLabel: "South African English",
        topicLabel: "Currie Cup",
      }),
    ).toBe("Currie Cup Lead (SA) · South African English · Currie Cup");

    expect(
      formatCreatorProfileLabel({
        displayName: "Premiership Lead",
        accent: "southern_english",
        competitionScope: "premiership",
      }),
    ).toBe("Premiership Lead · Southern English · Premiership");
  });

  it("normalizes voice and delivery styles", () => {
    expect(normalizeVoiceStyle("Television")).toBe("television");
    expect(normalizeVoiceStyle("Former player")).toBe("former_player");
    expect(normalizeDeliveryStyle("Energetic")).toBe("energetic");
    expect(normalizeDeliveryStyle("Smooth")).toBe("calm");
  });

  it("clamps speech speed to 0.75–1.5", () => {
    expect(clampSpeechSpeed(0.5)).toBe(0.75);
    expect(clampSpeechSpeed(2)).toBe(1.5);
    expect(clampSpeechSpeed(1.05)).toBe(1.05);
    expect(clampSpeechSpeed(undefined)).toBe(1);
  });

  it("maps tone presets to TTS hints with regional accent", () => {
    expect(tonePresetSettings("energetic").style).toBeGreaterThan(
      tonePresetSettings("calm").style,
    );
    expect(tonePresetSettings("analytical").instructionPrefix).toMatch(/analyst/i);
    expect(tonePresetSettings(null).tone).toBe("broadcast");
    expect(
      tonePresetSettings("energetic", {
        accent: "south_african_english",
        voiceStyle: "television",
        deliveryStyle: "energetic",
      }).instructionPrefix,
    ).toMatch(/South African English/i);
    expect(
      tonePresetSettings("broadcast", {
        accent: "american_english",
      }).instructionPrefix,
    ).toMatch(/American English/i);
  });

  it("supports 1–4 presenter roles and auto provider", () => {
    expect(clampPresenterCount(1)).toBe(1);
    expect(clampPresenterCount(2)).toBe(2);
    expect(clampPresenterCount(3)).toBe(3);
    expect(clampPresenterCount(4)).toBe(4);
    expect(clampPresenterCount(null)).toBe(2);
    expect(rolesForPresenterCount(1)).toEqual(["lead"]);
    expect(rolesForPresenterCount(2)).toEqual(["lead", "analyst"]);
    expect(rolesForPresenterCount(3)).toEqual(["lead", "analyst", "sideline"]);
    expect(rolesForPresenterCount(4)).toEqual([
      "lead",
      "analyst",
      "sideline",
      "guest",
    ]);
    expect(normalizeTtsProvider("auto")).toBe("auto");
    expect(normalizeTtsProvider("elevenlabs")).toBe("elevenlabs");
    expect(preferredAccentFiltersForScope("currie_cup")).toContain("South African");
    expect(preferredAccentFiltersForScope("premiership")).toContain("British");
    expect(preferredAccentFiltersForScope("mlr")).toContain("American");
  });
});
