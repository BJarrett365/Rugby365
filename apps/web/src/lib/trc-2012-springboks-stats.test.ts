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
  readFileSync(join(here, "../../../../scripts/springboks-steyn-kirchner-louw-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2012(key: string) {
  const line = SEASON_LINES[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2012,
  );
  if (!line) throw new Error(`Missing 2012 TRC line for ${key}`);
  return line;
}

describe("2012 Rugby Championship Springbok season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2012("morne-steyn")).toMatchObject({
      appearances: 4,
      starts: 4,
      tries: 0,
      points: 34,
      minutes: 290,
    });
    expect(trc2012("francois-steyn")).toMatchObject({
      appearances: 4,
      starts: 4,
      tries: 1,
      points: 11,
      minutes: 320,
    });
    expect(trc2012("zane-kirchner")).toMatchObject({
      appearances: 6,
      starts: 6,
      tries: 2,
      points: 10,
      minutes: 425,
    });
    expect(trc2012("francois-louw")).toMatchObject({
      appearances: 4,
      starts: 3,
      tries: 1,
      points: 5,
      minutes: 263,
    });
  });

  it("does not invent 2012 Super Rugby or unused-squad appearances", () => {
    for (const key of ["morne-steyn", "francois-steyn", "zane-kirchner", "francois-louw"]) {
      const super2012 = SEASON_LINES[key]?.filter(
        (row) => row.competitionSlug === "super-rugby" && (row.seasonYear === 2012 || row.allRugbySeason === "2012"),
      );
      expect(super2012).toEqual([]);
    }
  });
});

type MatchFile = {
  matches: Array<{
    fixtureSlug: string;
    players: Record<
      string,
      { squadRole: string; minutes: number; tries: number; points: number }
    >;
  }>;
};

const MATCHES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-steyn-kirchner-louw-2012-trc-matches.json"), "utf8"),
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

describe("2012 Rugby Championship Springbok match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season lines", () => {
    expect(matchTotals("morne-steyn")).toEqual({
      appearances: 4,
      starts: 4,
      tries: 0,
      points: 34,
      minutes: 290,
    });
    expect(matchTotals("francois-steyn")).toEqual({
      appearances: 4,
      starts: 4,
      tries: 1,
      points: 11,
      minutes: 320,
    });
    expect(matchTotals("zane-kirchner")).toEqual({
      appearances: 6,
      starts: 6,
      tries: 2,
      points: 10,
      minutes: 425,
    });
    expect(matchTotals("francois-louw")).toEqual({
      appearances: 4,
      starts: 3,
      tries: 1,
      points: 5,
      minutes: 263,
    });
    const perth = MATCHES.matches.find((row) => row.fixtureSlug.includes("2012-09-08"));
    expect(perth?.players["francois-louw"]?.squadRole).toBe("bench");
  });

  it("does not record unused squad members as appearances", () => {
    const argentinaSlugs = [
      "south-africa-v-argentina-2012-08-18",
      "argentina-g567pe6e-v-south-africa-2012-08-25",
    ];
    for (const slug of argentinaSlugs) {
      const match = MATCHES.matches.find((row) => row.fixtureSlug === slug);
      expect(match?.players["francois-louw"]).toBeUndefined();
    }
    const lastTwo = [
      "south-africa-v-australia-2012-09-29",
      "south-africa-v-new-zealand-2012-10-06",
    ];
    for (const slug of lastTwo) {
      const match = MATCHES.matches.find((row) => row.fixtureSlug === slug);
      expect(match?.players["morne-steyn"]).toBeUndefined();
      expect(match?.players["francois-steyn"]).toBeUndefined();
    }
  });
});

