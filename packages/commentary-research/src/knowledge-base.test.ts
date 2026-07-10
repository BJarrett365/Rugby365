import { describe, expect, it } from "vitest";
import { loadCommentaryKnowledgeBase, RUGBY_EVENT_TYPES } from "./index";

describe("commentary knowledge base", () => {
  const kb = loadCommentaryKnowledgeBase();

  it("loads valid knowledge base with policy", () => {
    expect(kb.policy.noCopyrightedText).toBe(true);
    expect(kb.referenceProducts).toHaveLength(5);
    expect(kb.rugby365Templates.length).toBeGreaterThan(20);
  });

  it("has research findings for major providers and events", () => {
    expect(kb.findings.length).toBeGreaterThan(50);
    const penaltyEspn = kb.findings.find(
      (f) => f.provider === "espn_scrum" && f.eventType === "penalty",
    );
    expect(penaltyEspn?.templateGuidance).toContain("Team named");
    expect(penaltyEspn?.rugby365TemplateKeys).toContain("penalty_awarded");
  });

  it("does not contain sample commentary sentences from providers", () => {
    const serialized = JSON.stringify(kb);
    expect(serialized).not.toMatch(/G\s*O\s*O\s*A\s*L/i);
    for (const f of kb.findings) {
      expect(f.researchNotes.length).toBeLessThan(300);
      expect(f.researchNotes).not.toMatch(/^".*"$/);
    }
    for (const t of kb.rugby365Templates) {
      expect(t.body).toMatch(/\{[a-z_]+\}/);
    }
  });

  it("covers all rugby event types in rugby365 templates", () => {
    const templatedEvents = new Set(kb.rugby365Templates.flatMap((t) => t.eventTypes));
    for (const et of RUGBY_EVENT_TYPES) {
      if (et === "ruck") continue; // covered via phase_milestone
      expect(templatedEvents.has(et)).toBe(true);
    }
  });
});
