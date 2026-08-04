import { describe, expect, it } from "vitest";
import {
  buildBroadcastPlayQueue,
  buildPreviewUtteranceQueue,
  captionAtOrAfterClock,
  captionSpeechKey,
  commentaryPlaybackStatusLabel,
  nextCaptionAfter,
  resolveCaptionSpeechMode,
} from "./match-commentary-speech";

const base = {
  minute: 12,
  second: 30,
  lead: "Try time for Boland!",
  analyst: "Clinical finish from the wing.",
};

describe("resolveCaptionSpeechMode", () => {
  it("prefers broadcast when TTS flags are set", () => {
    expect(resolveCaptionSpeechMode({ ...base, leadAudio: true })).toBe("broadcast");
    expect(resolveCaptionSpeechMode({ ...base, analystAudio: true })).toBe("broadcast");
  });

  it("falls back to preview when only text exists", () => {
    expect(resolveCaptionSpeechMode(base)).toBe("preview");
  });

  it("returns null for empty captions", () => {
    expect(resolveCaptionSpeechMode(null)).toBeNull();
    expect(resolveCaptionSpeechMode({ ...base, lead: "", analyst: "" })).toBeNull();
  });
});

describe("buildBroadcastPlayQueue", () => {
  it("builds same-origin play URLs only for ready speakers", () => {
    const queue = buildBroadcastPlayQueue("m6wqp046", {
      ...base,
      leadAudio: true,
      analystAudio: true,
    });
    expect(queue).toHaveLength(2);
    expect(queue[0]?.speaker).toBe("lead");
    expect(queue[0]?.url).toContain("/api/fixtures/m6wqp046/audio/play?");
    expect(queue[0]?.url).toContain("speaker=lead");
    expect(queue[1]?.url).toContain("speaker=analyst");
    expect(queue.every((item) => !item.url.includes("storage"))).toBe(true);
  });
});

describe("buildPreviewUtteranceQueue", () => {
  it("queues lead then analyst text", () => {
    expect(buildPreviewUtteranceQueue(base)).toEqual([
      { speaker: "lead", text: base.lead },
      { speaker: "analyst", text: base.analyst },
    ]);
  });
});

describe("commentaryPlaybackStatusLabel", () => {
  it("is honest about preview vs broadcast", () => {
    expect(
      commentaryPlaybackStatusLabel({
        phase: "playing",
        mode: "preview",
        speaker: "lead",
      }),
    ).toMatch(/preview voice/i);
    expect(
      commentaryPlaybackStatusLabel({
        phase: "playing",
        mode: "broadcast",
        speaker: "analyst",
      }),
    ).toMatch(/broadcast audio/i);
  });

  it("marks continuous feed playback as on air", () => {
    expect(
      commentaryPlaybackStatusLabel({
        phase: "playing",
        mode: "broadcast",
        speaker: "lead",
        streaming: true,
      }),
    ).toMatch(/on air/i);
  });
});

describe("nextCaptionAfter", () => {
  const captions = [
    { ...base, minute: 5, second: 0, lead: "A", analyst: "a" },
    { ...base, minute: 12, second: 30, lead: "B", analyst: "b" },
    { ...base, minute: 40, second: 0, lead: "C", analyst: "c" },
  ];

  it("returns the following timeline item", () => {
    expect(nextCaptionAfter(captions, captions[0])?.lead).toBe("B");
    expect(nextCaptionAfter(captions, captions[2])).toBeNull();
  });
});

describe("captionAtOrAfterClock", () => {
  const captions = [
    { ...base, minute: 5, second: 0, lead: "A", analyst: "a" },
    { ...base, minute: 12, second: 30, lead: "B", analyst: "b" },
    { ...base, minute: 40, second: 0, lead: "C", analyst: "c" },
  ];

  it("starts the stream at or after the scrub minute", () => {
    expect(captionAtOrAfterClock(captions, 0, 0)?.lead).toBe("A");
    expect(captionAtOrAfterClock(captions, 12, 0)?.lead).toBe("B");
    expect(captionAtOrAfterClock(captions, 12, 30)?.lead).toBe("B");
    expect(captionAtOrAfterClock(captions, 90, 0)?.lead).toBe("C");
  });
});

describe("captionSpeechKey", () => {
  it("changes when audio readiness changes", () => {
    expect(captionSpeechKey(base)).not.toBe(
      captionSpeechKey({ ...base, leadAudio: true }),
    );
  });
});
