import { describe, expect, it } from "vitest";
import {
  parsePremiershipSeasonWikitext,
  parsePoolWikitableStandings,
  parseSportsTableModule,
  parseRugbyboxFixtures,
} from "./parse-season-page";

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

describe("parsePoolWikitableStandings", () => {
  it("parses legacy Challenge Cup pool tables", () => {
    const rows = parsePoolWikitableStandings(`
===Pool 1===
{| class="wikitable"
|-
!Team!!P!!W!!D!!L!!Pts
|- bgcolor="#ccffcc"
|align="left"| {{flagicon|FRA}} '''[[SU Agen Lot-et-Garonne|Agen]]'''
|5||5||0||0||'''10'''
|-
|align="left"| {{flagicon|ENG}} [[Sale Sharks]]
|5||3||0||2||'''6'''
|}
===Pool 2===
{| class="wikitable"
|-
!Team!!P!!W!!D!!L!!Pts
|-
|align="left"| {{flagicon|FRA}} '''[[Castres Olympique]]'''
|5||5||0||0||'''10'''
|}
`);
    expect(rows.map((r) => r.teamName)).toEqual(["Agen", "Sale Sharks", "Castres Olympique"]);
  });

  it("parses lettered RWC pool headings", () => {
    const rows = parsePoolWikitableStandings(`
===Pool A===
{| class="wikitable"
|-
!Team!!P!!W!!D!!L!!Pts
|-
|align="left"| [[Japan national rugby union team|Japan]]
|4||4||0||0||'''19'''
|}
`);
    expect(rows[0]?.teamName).toBe("Japan");
  });
});

describe("parseRugbyboxFixtures invoke module", () => {
  it("parses #invoke:rugby box fixtures", () => {
    const fixtures = parseRugbyboxFixtures(
      `{{#invoke:rugby box|main
|date = 8 September 2023
|time = 21:15
|home = {{ru-rt|FRA}}
|score = 27–13
|away = {{ru|NZL}}
|stadium = [[Stade de France]]
|attendance = 78,680
|referee = [[Jaco Peyper]]
}}`,
      { defaultRound: "Pool A" },
    );
    expect(fixtures[0]).toMatchObject({
      homeTeam: "France",
      awayTeam: "New Zealand",
      homeScore: 27,
      awayScore: 13,
      attendance: 78680,
    });
  });
});

describe("parsePremiershipSeasonWikitext", () => {
  it("extracts European Challenge Cup infobox champion", () => {
    const parsed = parsePremiershipSeasonWikitext({
      pageTitle: "1996–97 European Challenge Cup",
      wikipediaUrl: "https://en.wikipedia.org/wiki/1996%E2%80%9397_European_Challenge_Cup",
      revisionId: 1,
      wikitext: `{{Infobox European Cup Rugby season
| name = 1996–97 European Challenge Cup
| champions = {{flagicon|FRA}} [[CS Bourgoin-Jallieu|Bourgoin]]
| runner-up = {{flagicon|FRA}} [[Castres Olympique]]
}}
`,
      standings: [{ rank: 1, teamName: "Agen", played: 5, won: 5, draw: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, pointsDiff: 0, triesFor: null, tryBonusPoints: 0, losingBonusPoints: 0, bonusPoints: 0, pointsDeduction: 0, points: 10, isChampionMarker: false, qualificationNotes: null }],
    });
    expect(parsed.seasonStartYear).toBe(1996);
    expect(parsed.championName).toBe("Bourgoin");
  });

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
