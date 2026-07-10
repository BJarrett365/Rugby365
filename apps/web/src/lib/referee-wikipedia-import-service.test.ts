import { describe, expect, it } from "vitest";
import { formatRefereeCareerNotes } from "./referee-wikipedia-import-service";

describe("formatRefereeCareerNotes", () => {
  it("formats competition list for notes field", () => {
    const notes = formatRefereeCareerNotes([
      { competitionName: "English Premiership", yearsLabel: "-", sortOrder: 1 },
      { competitionName: "Six Nations", yearsLabel: "2010–2020", apps: 42, sortOrder: 2 },
    ]);

    expect(notes).toContain("English Premiership");
    expect(notes).toContain("Six Nations");
    expect(notes).toContain("42 apps");
  });
});
