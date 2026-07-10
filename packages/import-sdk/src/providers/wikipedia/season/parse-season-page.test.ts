import { describe, expect, it } from "vitest";
import { parsePremiershipSeasonWikitext, parseSportsTableModule, parseRugbyboxFixtures } from "./parse-season-page";

const TABLE = `
== Table ==
{{#invoke:sports table|main|style=Rugby
| team1 = BAT | name_BAT = {{nowrap|[[Bath Rugby|Bath]]}} '''(C)'''
| team2 = LEI | name_LEI = {{nowrap|[[Leicester Tigers]]}}
| win_BAT = 14| draw_BAT = 0| loss_BAT = 4| pf_BAT = 651| pa_BAT = 417| tf_BAT = 96| tb_BAT = 15| lb_BAT = 1
| win_LEI = 11| draw_LEI = 1| loss_LEI = 6| pf_LEI = 533| pa_LEI = 439| tf_LEI = 72| tb_LEI = 12| lb_LEI = 3
|update = complete
}}
`;

const BOX = `
=== Round 1 ===
{{Rugbybox
|date = 20 September 2024
|time = 19:45
|home = (1 BP) [[Bath Rugby|Bath]]
|score = 38–16
|away = [[Northampton Saints]]
|stadium = [[Recreation Ground, Bath|The Recreation Ground]]
|attendance = 12,959
|referee = [[Luke Pearce]]
}}
=== Final ===
{{Rugbybox
|date = 14 June 2025
|time = 15:00
|home = [[Bath Rugby|Bath]]
|score = 23–21
|away = [[Leicester Tigers]]
|stadium = [[Twickenham Stadium]]
|attendance = 80,000
|referee = [[Christophe Ridley]]
}}
`;

describe("parseSportsTableModule", () => {
  it("parses Premiership sports table rows", () => {
    const rows = parseSportsTableModule(TABLE);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      teamName: "Bath",
      won: 14,
      lost: 4,
      played: 18,
      tryBonusPoints: 15,
      losingBonusPoints: 1,
      points: 72,
      isChampionMarker: true,
    });
  });
});

describe("parseRugbyboxFixtures", () => {
  it("parses rugbybox with score venue attendance", () => {
    const fixtures = parseRugbyboxFixtures(BOX, { defaultRound: "Round 1", matchweek: 1 });
    expect(fixtures[0]).toMatchObject({
      homeTeam: "Bath",
      awayTeam: "Northampton Saints",
      homeScore: 38,
      awayScore: 16,
      attendance: 12959,
      venueName: "The Recreation Ground",
      refereeName: "Luke Pearce",
      status: "full_time",
    });
  });
});

describe("parsePremiershipSeasonWikitext", () => {
  it("extracts table fixtures and playoff stages", () => {
    const parsed = parsePremiershipSeasonWikitext({
      pageTitle: "2024–25 Premiership Rugby",
      wikipediaUrl: "https://en.wikipedia.org/wiki/2024–25_Premiership_Rugby",
      revisionId: 1,
      wikitext: `{{Infobox rugby union season
| name = 2024–25 Premiership Rugby
| Champions = [[Bath Rugby|Bath]]
| runnersup = [[Leicester Tigers]]
}}
${TABLE}
== Regular season ==
${BOX}
`,
    });
    expect(parsed.championName).toBe("Bath");
    expect(parsed.seasonStartYear).toBe(2024);
    expect(parsed.standings).toHaveLength(2);
    expect(parsed.fixtures.some((f) => f.round === "Round 1")).toBe(true);
    expect(parsed.playoffFixtures.some((f) => f.stage === "final")).toBe(true);
  });
});
