import { describe, expect, it } from "vitest";
import {
  buildPublicMatchAudioFromScripts,
  captionForAnimationClock,
  publicAudioProductNote,
  publicAudioStatusLabel,
} from "./match-animation-public-audio";

describe("captionForAnimationClock", () => {
  const captions = [
    { minute: 5, second: 0, lead: "A", analyst: "a" },
    { minute: 12, second: 30, lead: "B", analyst: "b" },
    { minute: 40, second: 0, lead: "C", analyst: "c" },
  ];

  it("picks the latest caption at or before the clock", () => {
    expect(captionForAnimationClock(captions, 12, 29)?.lead).toBe("A");
    expect(captionForAnimationClock(captions, 12, 30)?.lead).toBe("B");
    expect(captionForAnimationClock(captions, 55, 0)?.lead).toBe("C");
  });

  it("falls back to the first caption before any clock hit", () => {
    expect(captionForAnimationClock(captions, 0, 10)?.lead).toBe("A");
  });
});

describe("publicAudioStatusLabel", () => {
  it("is honest about off / stings / captions", () => {
    expect(publicAudioStatusLabel("stings_only", false)).toBe("Off");
    expect(publicAudioStatusLabel("stings_only", true)).toBe("Stings only");
    expect(publicAudioStatusLabel("scripts_ready", true)).toBe("Captions ready");
    expect(publicAudioStatusLabel("streaming", true)).toBe("Live commentary");
  });
});

describe("publicAudioProductNote", () => {
  it("describes continuous play-through, not single-update clips", () => {
    expect(publicAudioProductNote("scripts_ready")).toMatch(/preview voice/i);
    expect(publicAudioProductNote("scripts_ready")).toMatch(/selected minute/i);
    expect(publicAudioProductNote("scripts_ready")).not.toMatch(/single update/i);
    expect(publicAudioProductNote("stings_only")).toMatch(/not available/i);
    expect(publicAudioProductNote("streaming")).toMatch(/auto-advance/i);
    expect(publicAudioProductNote("streaming")).not.toMatch(/single update/i);
  });
});

describe("buildPublicMatchAudioFromScripts redaction", () => {
  it("emits only public caption fields — no storage, voices, or ids", () => {
    const payload = buildPublicMatchAudioFromScripts([
      {
        minute: 12,
        second: 15,
        leadScript: "Try time!",
        analystScript: "Great finish.",
        id: "secret-script-id",
        storagePath: "audio-commentary/fixture/file.mp3",
        voiceProfileId: "voice-uuid",
        voiceId: "eleven-labs-voice",
        status: "draft",
        sourceBody: "internal narrative body",
        facts: { playerId: "hidden" },
        layers: ["live"],
      },
    ]);

    expect(payload.status).toBe("scripts_ready");
    expect(payload.scriptCount).toBe(1);
    expect(payload.captions).toEqual([
      {
        minute: 12,
        second: 15,
        lead: "Try time!",
        analyst: "Great finish.",
        written: "internal narrative body",
      },
    ]);

    const json = JSON.stringify(payload);
    expect(json).not.toContain("secret-script-id");
    expect(json).not.toContain("storagePath");
    expect(json).not.toContain("audio-commentary/");
    expect(json).not.toContain("voiceProfileId");
    expect(json).not.toContain("eleven-labs");
    expect(json).not.toContain("sourceBody");
    expect(json).toContain("internal narrative body");
  });

  it("returns empty stings_only payload when there are no scripts", () => {
    const payload = buildPublicMatchAudioFromScripts([]);
    expect(payload.status).toBe("stings_only");
    expect(payload.captions).toEqual([]);
    expect(payload.scriptCount).toBe(0);
  });

  it("marks streaming when ready segments exist without leaking paths", () => {
    const payload = buildPublicMatchAudioFromScripts(
      [
        {
          minute: 40,
          second: 0,
          leadScript: "Half-time.",
          analystScript: "Reset needed.",
          leadAudio: true,
          analystAudio: true,
          storagePath: "audio-commentary/secret.mp3",
        },
      ],
      { readySegmentCount: 2 },
    );
    expect(payload.status).toBe("streaming");
    expect(payload.readySegmentCount).toBe(2);
    expect(payload.captions[0]?.leadAudio).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("audio-commentary/");
  });
});
