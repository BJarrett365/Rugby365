import { describe, expect, it } from "vitest";
import {
  buildStandingsFromMatches,
  parseLiveSportMatchesFromFeed,
  parseLiveSportPage,
  parseTournamentMetaFromFeed,
} from "./parse-feed";
import { parseLiveSportCompetitionUrl, buildLiveSportMatchUrl } from "./parse-url";
import { resolveLiveSportSeasonUrl } from "./fetch-tournament";
import { buildLiveSportSeasonPathSlug } from "./season-url";

const SAMPLE_FEED =
  'ZA÷Rugby Union: Six Nations¬ZC÷4tMxxvwQ¬ZE÷season123¬' +
  'AA÷match1¬AD÷1738508400¬AE÷France¬AF÷Ireland¬AG÷25¬AH÷22¬AB÷3¬ER÷Round 1¬~' +
  'AA÷match2¬AD÷1739113200¬AE÷England¬AF÷Wales¬AG÷30¬AH÷30¬AB÷3¬ER÷Round 1¬~' +
  'AA÷match3¬AD÷1741809600¬AE÷Scotland¬AF÷Italy¬AB÷1¬ER÷Round 2¬~';

const META = {
  competitionSlug: "six-nations",
  seasonLabel: "2026",
  sourceUrl: "https://www.livesport.com/uk/rugby-union/europe/six-nations-2026/",
};

describe("parseLiveSportCompetitionUrl", () => {
  it("parses base competition URL and strips hash", () => {
    const parsed = parseLiveSportCompetitionUrl(
      "https://www.livesport.com/uk/rugby-union/europe/six-nations/#/4tMxxvwQ/standings/",
    );
    expect(parsed.competitionSlug).toBe("six-nations");
    expect(parsed.seasonLabel).toBeNull();
  });

  it("parses season suffix from slug", () => {
    const parsed = parseLiveSportCompetitionUrl(
      "https://www.livesport.com/uk/rugby-union/europe/six-nations-2026/",
    );
    expect(parsed.competitionSlug).toBe("six-nations");
    expect(parsed.seasonLabel).toBe("2026");
  });

  it("parses cross-year season suffix from slug", () => {
    const parsed = parseLiveSportCompetitionUrl(
      "https://www.livesport.com/uk/rugby-union/england/premiership-rugby-2024-2025/",
    );
    expect(parsed.competitionSlug).toBe("premiership-rugby");
    expect(parsed.seasonLabel).toBe("2024");
  });

  it("ignores archive path suffix when parsing competition", () => {
    const parsed = parseLiveSportCompetitionUrl(
      "https://www.livesport.com/uk/rugby-union/england/premiership-rugby/archive/",
    );
    expect(parsed.competitionSlug).toBe("premiership-rugby");
    expect(parsed.seasonLabel).toBeNull();
  });
});

describe("parseLiveSportMatchesFromFeed", () => {
  it("extracts matches with scores and scheduled fixtures", () => {
    const matches = parseLiveSportMatchesFromFeed(SAMPLE_FEED, META);
    expect(matches).toHaveLength(3);

    const franceIreland = matches.find((row) => row.matchId === "match1");
    expect(franceIreland).toMatchObject({
      homeTeam: "France",
      awayTeam: "Ireland",
      homeScore: 25,
      awayScore: 22,
      status: "full_time",
      round: "Round 1",
    });
    expect(franceIreland?.kickoffAt).toBe(new Date(1738508400 * 1000).toISOString());

    const scheduled = matches.find((row) => row.matchId === "match3");
    expect(scheduled).toMatchObject({
      homeTeam: "Scotland",
      awayTeam: "Italy",
      status: "scheduled",
      homeScore: null,
      awayScore: null,
    });
  });
});

describe("buildStandingsFromMatches", () => {
  it("computes Six Nations points from completed matches", () => {
    const matches = parseLiveSportMatchesFromFeed(SAMPLE_FEED, META);
    const standings = buildStandingsFromMatches(matches);

    expect(standings).toHaveLength(4);
    const france = standings.find((row) => row.teamName === "France");
    const ireland = standings.find((row) => row.teamName === "Ireland");
    const england = standings.find((row) => row.teamName === "England");

    expect(france).toMatchObject({ played: 1, won: 1, points: 4 });
    expect(ireland).toMatchObject({ played: 1, lost: 1, points: 0 });
    expect(england).toMatchObject({ played: 1, draw: 1, points: 2 });
    expect(standings[0].rank).toBe(1);
  });

  it("excludes playoff and final matches from regular-season standings", () => {
    const matches = parseLiveSportMatchesFromFeed(SAMPLE_FEED, META);
    const playoffMatch = {
      ...matches[0]!,
      matchId: "playoff1",
      round: "Semi-final",
      homeTeam: "Bath",
      awayTeam: "Saracens",
    };
    const standings = buildStandingsFromMatches([...matches, playoffMatch]);
    const bath = standings.find((row) => row.teamName === "Bath");
    const saracens = standings.find((row) => row.teamName === "Saracens");
    expect(bath).toBeUndefined();
    expect(saracens).toBeUndefined();
  });
});

describe("parseLiveSportPage", () => {
  it("parses embedded feed from HTML wrapper", () => {
    const html = `<html><body><script>window.__data="${SAMPLE_FEED}";</script></body></html>`;
    const preview = parseLiveSportPage(html, {
      competitionName: "Six Nations",
      competitionSlug: "six-nations",
      seasonLabel: "2026",
      tournamentId: null,
      seasonTournamentId: null,
      sourceUrl: META.sourceUrl,
      pagePath: "/uk/rugby-union/europe/six-nations-2026/",
    });

    expect(preview.kind).toBe("tournament");
    expect(preview.meta.tournamentId).toBe("4tMxxvwQ");
    expect(preview.matches).toHaveLength(3);
    expect(preview.standings.length).toBeGreaterThan(0);
  });
});

describe("parseTournamentMetaFromFeed", () => {
  it("reads tournament header fields", () => {
    const meta = parseTournamentMetaFromFeed(SAMPLE_FEED);
    expect(meta.competitionName).toBe("Six Nations");
    expect(meta.tournamentId).toBe("4tMxxvwQ");
    expect(meta.seasonTournamentId).toBe("season123");
  });
});

describe("resolveLiveSportSeasonUrl", () => {
  it("builds season-specific competition URL", () => {
    const url = resolveLiveSportSeasonUrl(
      "https://www.livesport.com/uk/rugby-union/europe/six-nations/",
      "2026",
    );
    expect(url).toBe("https://www.livesport.com/uk/rugby-union/europe/six-nations-2026/");
  });

  it("builds cross-year season URL for domestic leagues", () => {
    const url = resolveLiveSportSeasonUrl(
      "https://www.livesport.com/uk/rugby-union/england/premiership-rugby/archive/",
      "2024",
    );
    expect(url).toBe("https://www.livesport.com/uk/rugby-union/england/premiership-rugby-2024-2025/");
  });
});

describe("buildLiveSportSeasonPathSlug", () => {
  it("uses full cross-year path for Premiership", () => {
    expect(buildLiveSportSeasonPathSlug("premiership-rugby", "2024")).toBe("premiership-rugby-2024-2025");
  });

  it("uses single year for Six Nations", () => {
    expect(buildLiveSportSeasonPathSlug("six-nations", "2026")).toBe("six-nations-2026");
  });
});

describe("buildLiveSportMatchUrl", () => {
  it("builds match deep link", () => {
    const url = buildLiveSportMatchUrl({
      competitionSlug: "six-nations",
      seasonLabel: "2026",
      matchId: "abc123",
      homeSlug: "france",
      awaySlug: "ireland",
    });
    expect(url).toContain("six-nations-2026");
    expect(url).toContain("abc123");
  });
});
