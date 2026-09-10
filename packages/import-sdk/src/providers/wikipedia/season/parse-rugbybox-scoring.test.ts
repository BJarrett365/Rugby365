import { describe, expect, it } from "vitest";
import {
  parseRugbyboxScoringBlock,
  parseRugbyboxScoringList,
  parseRugbyChampionshipTeam,
} from "./parse-rugbybox-scoring";
import {
  mergeWikipediaSeasonStatRows,
  parseWikipediaScorerWikitable,
  seasonStatsFromRugbyboxScoring,
} from "./parse-stats-wikitable";

describe("parseRugbyChampionshipTeam", () => {
  it("maps ru templates and aliases", () => {
    expect(parseRugbyChampionshipTeam("{{ru|NZL}}")).toBe("New Zealand");
    expect(parseRugbyChampionshipTeam("{{ru|RSA}}")).toBe("South Africa");
    expect(parseRugbyChampionshipTeam("{{ru-rt|AUS}}")).toBe("Australia");
    expect(parseRugbyChampionshipTeam("[[Australia]]")).toBe("Australia");
  });
});

describe("parseRugbyboxScoringBlock with ru-rt home template", () => {
  it("parses {{ru-rt|AUS}} the same as {{ru|AUS}}", () => {
    const parsed = parseRugbyboxScoringBlock(
      {
        home: "{{ru-rt|AUS}}",
        away: "{{ru|NZL}}",
        score: "19–27",
        try1: "[[Nathan Sharpe|Sharpe]] 38' c",
        try2: "[[Israel Dagg|Dagg]] 12' c",
      },
      "2012-08-18",
    );
    expect(parsed?.homeTeam).toBe("Australia");
    expect(parsed?.awayTeam).toBe("New Zealand");
    expect(parsed?.home).toHaveLength(1);
    expect(parsed?.away).toHaveLength(1);
  });
});

describe("parseRugbyboxScoringList", () => {
  it("parses tries with minutes and conversions made/attempted", () => {
    const tries = parseRugbyboxScoringList(
      "[[Israel Dagg|Dagg]] 12' c<br />[[Cory Jane|Jane]] 32' m",
      "try",
    );
    expect(tries).toEqual([
      { playerName: "Israel Dagg", playerLabel: "Dagg", count: 1, kind: "try" },
      { playerName: "Cory Jane", playerLabel: "Jane", count: 1, kind: "try" },
    ]);
    const pens = parseRugbyboxScoringList(
      "[[Dan Carter|Carter]] (5/6) 10', 19', 47', 62', 80+2'",
      "penalty",
    );
    expect(pens[0]).toMatchObject({ playerName: "Dan Carter", count: 5, kind: "penalty" });
  });
});

describe("parseRugbyboxScoringBlock", () => {
  it("keeps championship fixtures and drops warm-ups", () => {
    const parsed = parseRugbyboxScoringBlock(
      {
        home: "{{ru|AUS}}",
        away: "{{ru|NZL}}",
        score: "19–27",
        try1: "[[Nathan Sharpe|Sharpe]] 38' c",
        con1: "[[Berrick Barnes|Barnes]] (1/1) 39'",
        pen1: "[[Berrick Barnes|Barnes]] (4/4) 2', 44', 49', 75'",
        try2: "[[Israel Dagg|Dagg]] 12' c",
        con2: "[[Dan Carter|Carter]] (1/2) 13'",
        pen2: "[[Dan Carter|Carter]] (5/6) 10', 19', 47', 62', 80+2'",
      },
      "2012-08-18",
    );
    expect(parsed?.homeTeam).toBe("Australia");
    expect(parsed?.awayTeam).toBe("New Zealand");
    expect(parsed?.home.find((e) => e.kind === "penalty")?.count).toBe(4);
    expect(
      parseRugbyboxScoringBlock(
        { home: "{{ru|ARG}}", away: "[[Stade Français]]", try1: "x" },
        "2012-08-04",
      ),
    ).toBeNull();
  });
});

describe("parseWikipediaScorerWikitable", () => {
  it("reads try and points tables with rowspan values", () => {
    const wikitext = `
===Try scorers===
{| class="wikitable"
|-
!Pos
!Name
!Team
!Tries
|-
|1
|align="left"|[[Bryan Habana]]
|align="left"|{{ru|RSA}}
|7
|-
|rowspan="2"|2
|align="left"|[[Cory Jane]]
|align="left"|{{ru|NZL}}
|rowspan="2"|5
|-
|align="left"|[[Israel Dagg]]
|align="left"|{{ru|NZL}}
|}
===Points scorers===
{| class="wikitable"
|-
!Name
!Team
!Pts
|-
|[[Dan Carter]]
|{{ru|NZL}}
|58
|}
`;
    const tries = parseWikipediaScorerWikitable(wikitext, "tries");
    expect(tries).toEqual([
      { playerName: "Bryan Habana", teamName: "South Africa", tries: 7, points: 0 },
      { playerName: "Cory Jane", teamName: "New Zealand", tries: 5, points: 0 },
      { playerName: "Israel Dagg", teamName: "New Zealand", tries: 5, points: 0 },
    ]);
    const points = parseWikipediaScorerWikitable(wikitext, "points");
    expect(points[0]).toMatchObject({ playerName: "Dan Carter", points: 58 });
    const merged = mergeWikipediaSeasonStatRows(tries, points);
    expect(merged.find((r) => r.playerName === "Dan Carter")?.points).toBe(58);
  });
});

describe("seasonStatsFromRugbyboxScoring", () => {
  it("aggregates tries and points across matches", () => {
    const rows = seasonStatsFromRugbyboxScoring([
      {
        date: "2012-08-18",
        homeTeam: "Australia",
        awayTeam: "New Zealand",
        homeScore: 19,
        awayScore: 27,
        home: [
          { playerName: "Berrick Barnes", playerLabel: "Barnes", count: 4, kind: "penalty" },
          { playerName: "Nathan Sharpe", playerLabel: "Sharpe", count: 1, kind: "try" },
        ],
        away: [
          { playerName: "Dan Carter", playerLabel: "Carter", count: 5, kind: "penalty" },
          { playerName: "Dan Carter", playerLabel: "Carter", count: 1, kind: "conversion" },
          { playerName: "Israel Dagg", playerLabel: "Dagg", count: 1, kind: "try" },
        ],
      },
    ]);
    expect(rows.find((r) => r.playerName === "Dan Carter")).toMatchObject({
      teamName: "New Zealand",
      tries: 0,
      points: 17,
    });
    expect(rows.find((r) => r.playerName === "Israel Dagg")).toMatchObject({
      tries: 1,
      points: 5,
    });
  });
});
