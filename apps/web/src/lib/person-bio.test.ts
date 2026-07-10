import { describe, expect, it } from "vitest";
import { diffPersonBioSections } from "./person-bio-automation-service";
import { buildPersonBioPrompt, parsePersonBioSections } from "./person-bio-prompt-service";
import { buildPersonMissingFields } from "./person-intelligence-service";
import type { PersonBioSections, PersonIntelligencePacket } from "./person-intelligence-types";
import { computeCoachRating } from "./coach-intelligence-service";

const packet: PersonIntelligencePacket = {
  personId: "person-1",
  roleType: "coach",
  roleEntityId: "coach-1",
  name: "Steve Borthwick",
  birthDate: "1979-12-01",
  age: 46,
  nationality: "England",
  birthPlace: null,
  currentRole: "Head Coach",
  currentOrganisation: "England",
  imageUrl: null,
  bioSummary: null,
  sourceUrls: [{ label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Steve_Borthwick" }],
  score: computeCoachRating({
    winRate: 0.65,
    recentFormPoints: 10,
    competitionLevelScore: 12,
    internationalExperience: true,
    yearsExperience: 6,
    teamImprovement: 0.1,
    trophiesCount: 1,
    finalsCount: 1,
  }),
  roleContext: { assignments: [] },
  missingFields: buildPersonMissingFields("coach", {
    bioSummary: null,
    birthDate: "1979-12-01",
    nationality: "England",
    imageUrl: null,
    currentRole: "head_coach",
    currentOrganisation: "England",
  }),
  conflicts: [],
  confidenceScore: 0.72,
  generatedAt: "2026-07-06T00:00:00.000Z",
};

describe("person bio data packet", () => {
  it("includes missing fields and source urls for editor review", () => {
    expect(packet.missingFields.some((field) => field.field === "bioSummary")).toBe(true);
    expect(packet.sourceUrls).toHaveLength(1);
    expect(packet.score.explanation).toContain("Coach Rating");
  });

  it("builds coach bio prompts from verified packet only", () => {
    const prompt = buildPersonBioPrompt("coach_full_profile", packet);
    expect(prompt.system).toContain("Never invent trophies");
    expect(prompt.user).toContain("Steve Borthwick");
    expect(prompt.promptVersion).toBeTruthy();
  });

  it("builds respectful referee prompts", () => {
    const refereePrompt = buildPersonBioPrompt("referee_experience_profile", {
      ...packet,
      roleType: "referee",
      name: "Wayne Barnes",
    });
    expect(refereePrompt.system.toLowerCase()).toContain("respectful");
  });
});

describe("parsePersonBioSections", () => {
  it("normalises model output into section strings", () => {
    const sections = parsePersonBioSections({
      shortIntro: " Intro ",
      fullBio: "Full profile",
      careerSummary: 123,
    });
    expect(sections.shortIntro).toBe("Intro");
    expect(sections.fullBio).toBe("Full profile");
    expect(sections.careerSummary).toBe("");
  });
});

describe("diffPersonBioSections", () => {
  it("detects changed sections for approval UI", () => {
    const current: PersonBioSections = {
      shortIntro: "Old intro",
      fullBio: "",
      careerSummary: "",
      ratingExplanation: "",
      appointmentSummary: "",
      experienceProfile: "",
    };
    const suggested: PersonBioSections = {
      ...current,
      shortIntro: "New intro",
      fullBio: "Expanded profile",
    };
    const diff = diffPersonBioSections(current, suggested);
    expect(diff.map((row) => row.section)).toEqual(["shortIntro", "fullBio"]);
  });
});

describe("bio approval flow helpers", () => {
  it("treats identical sections as no changes", () => {
    const sections: PersonBioSections = {
      shortIntro: "Approved intro",
      fullBio: "Approved full bio",
      careerSummary: "",
      ratingExplanation: "",
      appointmentSummary: "",
      experienceProfile: "",
    };
    expect(diffPersonBioSections(sections, sections)).toHaveLength(0);
  });
});
