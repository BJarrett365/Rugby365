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
const HERSCHEL_LINES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-herschel-jantjies-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;
const ELTON_LINES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-jantjies-season-lines.json"), "utf8"),
) as Record<string, SeasonLine[]>;

function trc2019(lines: Record<string, SeasonLine[]>, key: string) {
  const line = lines[key]?.find(
    (row) => row.competitionSlug === "rugby-championship" && row.seasonYear === 2019,
  );
  if (!line) throw new Error(`Missing 2019 TRC line for ${key}`);
  return line;
}

describe("2019 Rugby Championship Jantjies season lines", () => {
  it("records verified match involvement, not squad membership", () => {
    expect(trc2019(HERSCHEL_LINES, "herschel-jantjies")).toMatchObject({
      appearances: 3,
      starts: 1,
      tries: 3,
      points: 15,
      minutes: 109,
    });
    expect(trc2019(ELTON_LINES, "elton-jantjies")).toMatchObject({
      appearances: 1,
      starts: 1,
      tries: 0,
      points: 10,
      minutes: 80,
    });
  });

  it("maps All.Rugby 18/19 Rugby Championship rows to calendar 2019", () => {
    const herschel = HERSCHEL_LINES["herschel-jantjies"]?.filter(
      (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "18/19",
    );
    const elton = ELTON_LINES["elton-jantjies"]?.filter(
      (row) => row.competitionSlug === "rugby-championship" && row.allRugbySeason === "18/19",
    );
    expect(herschel).toHaveLength(1);
    expect(herschel[0]?.seasonYear).toBe(2019);
    expect(elton).toHaveLength(1);
    expect(elton[0]?.seasonYear).toBe(2019);
  });

  it("omits Herschel's unused Rugby World Cup semi-final from appearances", () => {
    const rwc = HERSCHEL_LINES["herschel-jantjies"]?.find(
      (row) => row.competitionSlug === "rugby-world-cup" && row.seasonYear === 2019,
    );
    expect(rwc).toMatchObject({ appearances: 6, starts: 1, minutes: 125 });
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
        jerseyNumber?: number;
        conversions?: number;
      }
    >;
  }>;
};

const MATCHES = JSON.parse(
  readFileSync(join(here, "../../../../scripts/springboks-jantjies-2019-trc-matches.json"), "utf8"),
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

describe("2019 Rugby Championship Jantjies match sheets", () => {
  it("match-by-match minutes and scoring sum to the verified season lines", () => {
    expect(matchTotals("herschel-jantjies")).toEqual({
      appearances: 3,
      starts: 1,
      tries: 3,
      points: 15,
      minutes: 109,
    });
    expect(matchTotals("elton-jantjies")).toEqual({
      appearances: 1,
      starts: 1,
      tries: 0,
      points: 10,
      minutes: 80,
    });
  });

  it("omits Elton from the last two Tests he did not play", () => {
    const wellington = MATCHES.matches.find(
      (row) => row.fixtureSlug === "new-zealand-5d9ywpjo-v-south-africa-2019-07-27",
    );
    const salta = MATCHES.matches.find(
      (row) => row.fixtureSlug === "argentina-g567pe6e-v-south-africa-2019-08-10",
    );
    expect(wellington?.players["elton-jantjies"]).toBeUndefined();
    expect(salta?.players["elton-jantjies"]).toBeUndefined();
    expect(MATCHES.matches).toHaveLength(3);
  });

  it("records Herschel's debut double and Elton's five conversions vs Australia", () => {
    const ellis = MATCHES.matches.find((row) => row.fixtureSlug === "south-africa-v-australia-2019-07-20");
    expect(ellis?.players["herschel-jantjies"]?.squadRole).toBe("starting");
    expect(ellis?.players["herschel-jantjies"]?.jerseyNumber).toBe(9);
    expect(ellis?.players["herschel-jantjies"]?.tries).toBe(2);
    expect(ellis?.players["herschel-jantjies"]?.minutes).toBe(65);
    expect(ellis?.players["elton-jantjies"]?.squadRole).toBe("starting");
    expect(ellis?.players["elton-jantjies"]?.conversions).toBe(5);
    expect(ellis?.players["elton-jantjies"]?.points).toBe(10);

    const wellington = MATCHES.matches.find(
      (row) => row.fixtureSlug === "new-zealand-5d9ywpjo-v-south-africa-2019-07-27",
    );
    expect(wellington?.players["herschel-jantjies"]?.squadRole).toBe("bench");
    expect(wellington?.players["herschel-jantjies"]?.tries).toBe(1);
    expect(wellington?.players["herschel-jantjies"]?.minutes).toBe(36);
  });
});
