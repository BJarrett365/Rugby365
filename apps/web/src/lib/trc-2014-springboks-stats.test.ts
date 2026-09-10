import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type SeasonLine = {
  allRugbySeason: string;
  competitionSlug: string;
  teamSlug: string;
  appearances: number;
  tries: number;
  points: number;
  minutes: number;
  starts?: number;
  seasonYear?: number;
};

const here = dirname(fileURLToPath(import.meta.url));
const SEASON_LINES = JSON.parse(
  readFileSync(
    join(here, "../../../../scripts/springboks-hendricks-lambie-de-villiers-coetzee-season-lines.json"),
    "utf8",
  ),
) as Record<string, SeasonLine[]>;

function trc2014(key: string) {
  const line = SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2014,
  );
  if (!line) throw new Error(`Missing 2014 TRC line for ${key}`);
  return line;
}

describe("2014 Rugby Championship Springbok season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2014("cornal-hendricks")).toMatchObject({
      appearances: 6,
      starts: 6,
      tries: 3,
      points: 15,
      minutes: 457,
    });
    expect(trc2014("patrick-lambie")).toMatchObject({
      appearances: 4,
      starts: 0,
      tries: 1,
      points: 13,
      minutes: 60,
    });
    expect(trc2014("jean-de-villiers")).toMatchObject({
      appearances: 6,
      starts: 6,
      tries: 2,
      points: 10,
      minutes: 480,
    });
    expect(trc2014("marcell-coetzee")).toMatchObject({
      appearances: 6,
      starts: 5,
      tries: 2,
      points: 10,
      minutes: 429,
    });
  });

  it("does not treat unused 2014 squad selection as an appearance", () => {
    expect(trc2014("patrick-lambie").appearances).toBe(4);
    expect(trc2014("patrick-lambie").starts).toBe(0);
  });

  it("maps All.Rugby 13/14 Rugby Championship rows to calendar 2014", () => {
    for (const key of ["cornal-hendricks", "patrick-lambie", "jean-de-villiers", "marcell-coetzee"]) {
      const labeled = SEASON_LINES[key]?.filter(
        (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "13/14",
      );
      expect(labeled.length).toBe(1);
      expect(labeled[0]?.seasonYear).toBe(2014);
    }
  });

  it("does not collide two Rugby Championship lines onto the same calendar year", () => {
    for (const [key, lines] of Object.entries(SEASON_LINES)) {
      const years = lines
        .filter((row) => row.competitionSlug === "rugby-championship")
        .map((row) => row.seasonYear ?? row.allRugbySeason);
      expect(new Set(years).size, key).toBe(years.length);
    }
  });
});

type MatchFile = {
  matches: Array<{
    fixtureSlug: string;
    players: Record<
      string,
      {
        squadRole: string;
        minutes: number;
        tries: number;
        points: number;
        dropGoals?: number;
        conversions?: number;
        penalties?: number;
      }
    >;
  }>;
};

const MATCHES = JSON.parse(
  readFileSync(
    join(here, "../../../../scripts/springboks-hendricks-lambie-de-villiers-coetzee-2014-trc-matches.json"),
    "utf8",
  ),
) as MatchFile;

function matchTotals(key: string) {
  const apps = MATCHES.matches.filter((match) => match.players[key]);
  return {
    appearances: apps.length,
    starts: apps.filter((match) => match.players[key]?.squadRole === "starting").length,
    tries: apps.reduce((sum, match) => sum + (match.players[key]?.tries ?? 0), 0),
    points: apps.reduce((sum, match) => sum + (match.players[key]?.points ?? 0), 0),
    minutes: apps.reduce((sum, match) => sum + (match.players[key]?.minutes ?? 0), 0),
  };
}

describe("2014 Rugby Championship Springbok match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season lines", () => {
    expect(matchTotals("cornal-hendricks")).toEqual({
      appearances: 6,
      starts: 6,
      tries: 3,
      points: 15,
      minutes: 457,
    });
    expect(matchTotals("patrick-lambie")).toEqual({
      appearances: 4,
      starts: 0,
      tries: 1,
      points: 13,
      minutes: 60,
    });
    expect(matchTotals("jean-de-villiers")).toEqual({
      appearances: 6,
      starts: 6,
      tries: 2,
      points: 10,
      minutes: 480,
    });
    expect(matchTotals("marcell-coetzee")).toEqual({
      appearances: 6,
      starts: 5,
      tries: 2,
      points: 10,
      minutes: 429,
    });
  });

  it("omits Lambie from the two Argentina Tests he did not play", () => {
    const johannesburg = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-argentina-2014-08-16");
    const salta = MATCHES.matches.find((row) => row.fixtureSlug === "argentina-g567pe6e-v-south-africa-2014-08-23");
    expect(johannesburg?.players["patrick-lambie"]).toBeUndefined();
    expect(salta?.players["patrick-lambie"]).toBeUndefined();
    expect(johannesburg?.players["jean-de-villiers"]?.squadRole).toBe("starting");
    expect(johannesburg?.players["cornal-hendricks"]?.squadRole).toBe("starting");
    expect(johannesburg?.players["marcell-coetzee"]?.squadRole).toBe("starting");
  });

  it("records Coetzee’s Salta bench appearance and Lambie’s Newlands scoring", () => {
    const salta = MATCHES.matches.find((row) => row.fixtureSlug === "argentina-g567pe6e-v-south-africa-2014-08-23");
    expect(salta?.players["marcell-coetzee"]?.squadRole).toBe("bench");
    expect(salta?.players["marcell-coetzee"]?.tries).toBe(1);
    expect(salta?.players["cornal-hendricks"]?.tries).toBe(1);

    const newlands = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-australia-2014-09-27");
    expect(newlands?.players["jean-de-villiers"]?.tries).toBe(2);
    expect(newlands?.players["patrick-lambie"]?.squadRole).toBe("bench");
    expect(newlands?.players["patrick-lambie"]?.tries).toBe(1);
    expect(newlands?.players["patrick-lambie"]?.dropGoals).toBe(1);
    expect(newlands?.players["patrick-lambie"]?.conversions).toBe(1);
    expect(newlands?.players["patrick-lambie"]?.points).toBe(10);
    expect(newlands?.players["marcell-coetzee"]?.tries).toBe(1);
  });
});
