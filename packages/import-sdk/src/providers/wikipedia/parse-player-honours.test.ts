import { describe, expect, it } from "vitest";
import {
  extractHonoursSectionWikitext,
  parsePlayerHonoursFromWikitext,
} from "./parse-player-honours";

const SACHA_HONOURS = `
==Honours==
'''South Africa''' 
* [[2025 Rugby Championship]] winner
* [[MyPlayers]] Players' Choice Awards
** Men’s Fifteens Players’ Player of the Year 2025<ref>{{Cite web |date=12 December 2025 |title=MyPlayers' 2025 awards winners announced|url=https://www.sarugby.co.za/ |website=sarugby.co.za}}</ref>
*SA Rugby Awards
**SA Rugby Young Player of the Year: 2024<ref>{{Cite web |title=Kolbe and Roos|url=https://example.com |website=SA Rugby}}</ref>
**SA Vodacom URC Player of the Season: 2025

==Test match record==
`;

describe("parse-player-honours", () => {
  it("extracts the Honours section", () => {
    const section = extractHonoursSectionWikitext(SACHA_HONOURS);
    expect(section).toContain("Rugby Championship");
    expect(section).not.toContain("Test match record");
  });

  it("parses Sacha-style nested awards and team honours", () => {
    const rows = parsePlayerHonoursFromWikitext(SACHA_HONOURS);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "team_honour",
          title: "Rugby Championship",
          year: 2025,
          placing: "WINNER",
          teamName: "South Africa",
        }),
        expect.objectContaining({
          kind: "personal_award",
          title: "Men’s Fifteens Players’ Player of the Year",
          year: 2025,
          groupLabel: "MyPlayers Players' Choice Awards",
        }),
        expect.objectContaining({
          kind: "personal_award",
          title: "SA Rugby Young Player of the Year",
          year: 2024,
          groupLabel: "SA Rugby Awards",
        }),
        expect.objectContaining({
          kind: "personal_award",
          title: "SA Vodacom URC Player of the Season",
          year: 2025,
          groupLabel: "SA Rugby Awards",
        }),
      ]),
    );
    expect(rows).toHaveLength(4);
  });
});
