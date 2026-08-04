import { describe, expect, it } from "vitest";
import {
  buildAudioScriptFromCommentaryLine,
  buildAudioScriptsForCommentaryLines,
  classifyAudioCombination,
  normalizeCommentaryBody,
} from "./audio-commentary-script-service";

describe("audio-commentary-script-service", () => {
  it("classifies major try events with high priority", () => {
    const c = classifyAudioCombination(
      "play_by_play",
      "42' — TRY! Willemse finishes for the Stormers. Score 17-10.",
    );
    expect(c.type).toBe("major_event");
    expect(c.priority).toBeGreaterThanOrEqual(8);
    expect(c.layers.length).toBeGreaterThan(0);
  });

  it("classifies quiet insight minutes without inventing major events", () => {
    const c = classifyAudioCombination(
      "journalist_insight",
      "The arm-wrestle continues in midfield as both sides probe for space.",
    );
    expect(["insight", "quiet_minute", "momentum"]).toContain(c.type);
  });

  it("rewrites Lead + Analyst scripts that are not the written body", () => {
    const body =
      "55' — TRY! Davids crosses for Boland after a sustained spell in the twenty-two. Boland 14-10 Griquas.";
    const draft = buildAudioScriptFromCommentaryLine({
      minute: 55,
      second: 12,
      body,
      segment: "play_by_play",
    });

    expect(draft.lead.trim().length).toBeGreaterThan(10);
    expect(draft.analyst.trim().length).toBeGreaterThan(10);
    expect(draft.lead).not.toBe(body);
    expect(draft.analyst).not.toBe(body);
    expect(normalizeCommentaryBody(draft.lead).toLowerCase()).not.toBe(
      normalizeCommentaryBody(body).toLowerCase(),
    );
    expect(normalizeCommentaryBody(draft.analyst).toLowerCase()).not.toBe(
      normalizeCommentaryBody(body).toLowerCase(),
    );
    expect(draft.combinationType).toBe("major_event");
  });

  it("keeps both speakers non-empty across a mixed feed", () => {
    const drafts = buildAudioScriptsForCommentaryLines([
      {
        minute: 0,
        second: 0,
        body: "Welcome to Wellington for Boland versus Griquas in the Currie Cup.",
        facts: { segment: "welcome" },
      },
      {
        minute: 12,
        second: 30,
        body: "Yellow card for Steenkamp (Griquas). Ten minutes in the sin-bin.",
        facts: { segment: "play_by_play" },
      },
      {
        minute: 40,
        second: 0,
        body: "Half-time — Boland edge a tight first half 10-7.",
        facts: { segment: "half_time" },
      },
      {
        minute: 63,
        second: 5,
        body: "Momentum with Boland as they camp in Griquas territory.",
        facts: { segment: "momentum" },
      },
    ]);

    expect(drafts.length).toBe(4);
    for (const d of drafts) {
      expect(d.lead.trim().length).toBeGreaterThan(0);
      expect(d.analyst.trim().length).toBeGreaterThan(0);
      expect(d.lead).not.toEqual(d.sourceBody);
      expect(d.analyst).not.toEqual(d.sourceBody);
    }
    expect(drafts.some((d) => d.combinationType === "card")).toBe(true);
    expect(drafts.some((d) => d.combinationType === "prematch")).toBe(true);
  });

  it("does not copy injury or fabricated emotion language into scripts", () => {
    const draft = buildAudioScriptFromCommentaryLine({
      minute: 22,
      second: 0,
      body: "A stoppage after a heavy collision — officials check on the player.",
      segment: "play_by_play",
    });
    expect(draft.lead.toLowerCase()).not.toMatch(/heartbroken|furious|coach said/);
    expect(draft.analyst.toLowerCase()).not.toMatch(/heartbroken|furious|coach said/);
  });
});
