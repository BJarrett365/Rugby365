import { describe, expect, it } from "vitest";
import {
  captionMatchSeconds,
  clockFromMatchSeconds,
  dueCaptionsForClock,
  formatMatchClock,
  selectNormalTimeBurst,
} from "./match-normal-time-audio";
import { captionSpeechKey } from "./match-commentary-speech";

const captions = [
  { minute: 0, second: 0, lead: "KO", analyst: "a0" },
  { minute: 6, second: 39, lead: "Try", analyst: "a1" },
  { minute: 14, second: 43, lead: "Card", analyst: "a2" },
  { minute: 40, second: 0, lead: "HT", analyst: "a3" },
  { minute: 80, second: 0, lead: "FT", analyst: "a4" },
];

describe("captionMatchSeconds / clockFromMatchSeconds", () => {
  it("round-trips MM:SS", () => {
    expect(captionMatchSeconds(captions[2]!)).toBe(14 * 60 + 43);
    expect(clockFromMatchSeconds(14 * 60 + 43)).toEqual({ minute: 14, second: 43 });
    expect(formatMatchClock(6, 9)).toBe("06:09");
  });
});

describe("selectNormalTimeBurst", () => {
  it("plays earliest due in order when on pace", () => {
    const handled = new Set<string>();
    const first = selectNormalTimeBurst({
      captions,
      clockSeconds: 10,
      handledKeys: handled,
      speechBusy: false,
    });
    expect(first.play?.lead).toBe("KO");
    handled.add(captionSpeechKey(first.play!));

    const second = selectNormalTimeBurst({
      captions,
      clockSeconds: 6 * 60 + 39,
      handledKeys: handled,
      speechBusy: false,
    });
    expect(second.play?.lead).toBe("Try");
  });

  it("waits while speech is busy", () => {
    const result = selectNormalTimeBurst({
      captions,
      clockSeconds: 800,
      handledKeys: new Set(),
      speechBusy: true,
    });
    expect(result.play).toBeNull();
  });

  it("skips stale backlog to latest when >20s behind", () => {
    const handled = new Set<string>([captionSpeechKey(captions[0]!)]);
    // Clock at 15:20 — card at 14:43 is due; try at 6:39 is >20s stale with backlog
    const result = selectNormalTimeBurst({
      captions,
      clockSeconds: 15 * 60 + 20,
      handledKeys: handled,
      speechBusy: false,
    });
    expect(result.play?.lead).toBe("Card");
    expect(result.skipKeys.length).toBeGreaterThan(0);
    expect(result.skipKeys).toContain(captionSpeechKey(captions[1]!));
  });
});

describe("dueCaptionsForClock", () => {
  it("excludes handled keys", () => {
    const handled = new Set([captionSpeechKey(captions[0]!)]);
    // Try is at 6:39 — clock must be past that.
    const due = dueCaptionsForClock(captions, 6 * 60 + 40, handled);
    expect(due.map((c) => c.lead)).toEqual(["Try"]);
  });
});
