import { describe, expect, it } from "vitest";
import { groupCareerStints, wikipediaCareerTotals } from "./player-career-stint-utils";

const rows = [
  { id: "1", careerType: "club", yearsLabel: "2016–2022", teamName: "Sale Sharks", apps: 107, points: 878 },
  { id: "2", careerType: "international", yearsLabel: "2015–", teamName: "United States", apps: 43, points: 425 },
  { id: "3", careerType: "cup", yearsLabel: "2017–2019", teamName: "Champions Cup", apps: 8, points: 24 },
];

describe("groupCareerStints", () => {
  it("groups club, cup and international rows with totals", () => {
    const groups = groupCareerStints(rows);
    expect(groups.map((group) => group.key)).toEqual(["club", "cup", "international"]);
    expect(groups[0].totals).toEqual({ apps: 107, points: 878 });
    expect(groups[1].totals).toEqual({ apps: 8, points: 24 });
    expect(groups[2].totals).toEqual({ apps: 43, points: 425 });
  });
});

describe("wikipediaCareerTotals", () => {
  it("returns per-category and combined totals", () => {
    const totals = wikipediaCareerTotals(rows);
    expect(totals.club.points).toBe(878);
    expect(totals.cup.points).toBe(24);
    expect(totals.international.points).toBe(425);
    expect(totals.all.points).toBe(1327);
  });
});
