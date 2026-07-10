import { formatSeasonRangeLabel, parseSeasonStartYear } from "./season-label-utils";

export type SeasonChampionEntry = {
  /** Domestic season start year (e.g. 2024 → 2024–25). */
  startYear: number;
  label: string;
  winner: string;
  wikipediaUrl?: string;
  flashscoreTableUrl?: string;
  flashscorePlayoffUrl?: string;
};

/** Gallagher Premiership champions — winner is playoff/champion, not regular-season table leader. */
export const PREMIERSHIP_CHAMPIONS: SeasonChampionEntry[] = [
  {
    startYear: 2025,
    label: formatSeasonRangeLabel(2025),
    winner: "Northampton Saints",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2025%E2%80%9326_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby/standings/4j70XxXN/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby/standings/0MhWRGfo/draw/",
  },
  {
    startYear: 2024,
    label: formatSeasonRangeLabel(2024),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2024%E2%80%9325_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2024-2025/standings/xEIK94mk/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2024-2025/standings/G4HO8O2e/draw/",
  },
  {
    startYear: 2023,
    label: formatSeasonRangeLabel(2023),
    winner: "Northampton Saints",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2023-2024/standings/QTwnF3q5/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2023-2024/standings/8x1bENbB/draw/",
  },
  {
    startYear: 2022,
    label: formatSeasonRangeLabel(2022),
    winner: "Saracens",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2022%E2%80%9323_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2022-2023/standings/QXTVklvo/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2022-2023/standings/rgtMEXGo/draw/",
  },
  {
    startYear: 2021,
    label: formatSeasonRangeLabel(2021),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2021%E2%80%9322_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2021-2022/standings/6mmaeAGN/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2021-2022/standings/OOs4fUVT/draw/",
  },
  {
    startYear: 2020,
    label: formatSeasonRangeLabel(2020),
    winner: "Harlequins",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2020%E2%80%9321_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2020-2021/standings/6mmaeAGN/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2020-2021/standings/OOs4fUVT/draw/",
  },
  {
    startYear: 2019,
    label: formatSeasonRangeLabel(2019),
    winner: "Exeter Chiefs",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2019%E2%80%9320_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2019-2020/standings/OzyJIzKQ/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2019-2020/standings/QqNpEfSs/draw/",
  },
  {
    startYear: 2018,
    label: formatSeasonRangeLabel(2018),
    winner: "Saracens",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2018%E2%80%9319_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2018-2019/standings/QJFxOJJn/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2018-2019/standings/4AEtNwZh/draw/",
  },
  {
    startYear: 2017,
    label: formatSeasonRangeLabel(2017),
    winner: "Saracens",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2017%E2%80%9318_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2017-2018/standings/8dCrzcVa/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2017-2018/standings/GQB8zHp6/draw/",
  },
  {
    startYear: 2016,
    label: formatSeasonRangeLabel(2016),
    winner: "Exeter Chiefs",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2016%E2%80%9317_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2016-2017/standings/fRcGzohJ/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2016-2017/standings/0l07aUUJ/draw/",
  },
  {
    startYear: 2015,
    label: formatSeasonRangeLabel(2015),
    winner: "Saracens",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2015%E2%80%9316_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2015-2016/standings/vqaJ0vVh/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2015-2016/standings/Y5bNabpa/draw/",
  },
  {
    startYear: 2014,
    label: formatSeasonRangeLabel(2014),
    winner: "Saracens",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2014%E2%80%9315_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2014-2015/standings/vqaJ0vVh/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2014-2015/standings/Y5bNabpa/draw/",
  },
  {
    startYear: 2013,
    label: formatSeasonRangeLabel(2013),
    winner: "Northampton Saints",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2013%E2%80%9314_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2013-2014/standings/4dRyFv7o/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2013-2014/standings/rmQuEbMi/draw/",
  },
  {
    startYear: 2012,
    label: formatSeasonRangeLabel(2012),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2012%E2%80%9313_Premiership_Rugby",
    flashscoreTableUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2012-2013/standings/p65V9XVF/standings/overall/",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2012-2013/standings/SUfz9ioM/draw/",
  },
  {
    startYear: 2011,
    label: formatSeasonRangeLabel(2011),
    winner: "Harlequins",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2011%E2%80%9312_Premiership_Rugby",
    flashscorePlayoffUrl:
      "https://www.flashscore.co.uk/rugby-union/england/premiership-rugby-2011-2012/draw/M9T8s6pD/draw/",
  },
  {
    startYear: 2010,
    label: formatSeasonRangeLabel(2010),
    winner: "Saracens",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2010%E2%80%9311_Premiership_Rugby",
  },
  {
    startYear: 2009,
    label: formatSeasonRangeLabel(2009),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2009%E2%80%9310_Premiership_Rugby",
  },
  {
    startYear: 2008,
    label: formatSeasonRangeLabel(2008),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2008%E2%80%9309_Premiership_Rugby",
  },
  {
    startYear: 2007,
    label: formatSeasonRangeLabel(2007),
    winner: "Wasps",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2007%E2%80%9308_Premiership_Rugby",
  },
  {
    startYear: 2006,
    label: formatSeasonRangeLabel(2006),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2006%E2%80%9307_Premiership_Rugby",
  },
  {
    startYear: 2005,
    label: formatSeasonRangeLabel(2005),
    winner: "Sale Sharks",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2005%E2%80%9306_Premiership_Rugby",
  },
  {
    startYear: 2004,
    label: formatSeasonRangeLabel(2004),
    winner: "Wasps",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2004%E2%80%9305_Premiership_Rugby",
  },
  {
    startYear: 2003,
    label: formatSeasonRangeLabel(2003),
    winner: "Wasps",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2003%E2%80%9304_Premiership_Rugby",
  },
  {
    startYear: 2002,
    label: formatSeasonRangeLabel(2002),
    winner: "Wasps",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2002%E2%80%9303_Premiership_Rugby",
  },
  {
    startYear: 2001,
    label: formatSeasonRangeLabel(2001),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2001%E2%80%9302_Premiership_Rugby",
  },
  {
    startYear: 2000,
    label: formatSeasonRangeLabel(2000),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2000%E2%80%9301_Premiership_Rugby",
  },
  {
    startYear: 1999,
    label: formatSeasonRangeLabel(1999),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1999%E2%80%9300_Premiership_1",
  },
  {
    startYear: 1998,
    label: formatSeasonRangeLabel(1998),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1998%E2%80%9399_Premiership_1",
  },
  {
    startYear: 1997,
    label: formatSeasonRangeLabel(1997),
    winner: "Newcastle Falcons",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1997%E2%80%9398_Premiership_1",
  },
  {
    startYear: 1996,
    label: formatSeasonRangeLabel(1996),
    winner: "Wasps",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1996%E2%80%9397_National_Division_1",
  },
  {
    startYear: 1995,
    label: formatSeasonRangeLabel(1995),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1995%E2%80%9396_National_Division_1",
  },
  {
    startYear: 1994,
    label: formatSeasonRangeLabel(1994),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1994%E2%80%9395_National_Division_1",
  },
  {
    startYear: 1993,
    label: formatSeasonRangeLabel(1993),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1993%E2%80%9394_National_Division_1",
  },
  {
    startYear: 1992,
    label: formatSeasonRangeLabel(1992),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1992%E2%80%9393_National_Division_1",
  },
  {
    startYear: 1991,
    label: formatSeasonRangeLabel(1991),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1991%E2%80%9392_National_Division_1",
  },
  {
    startYear: 1990,
    label: formatSeasonRangeLabel(1990),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1990%E2%80%9391_National_Division_1",
  },
  {
    startYear: 1989,
    label: formatSeasonRangeLabel(1989),
    winner: "Wasps",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1989%E2%80%9390_National_Division_1",
  },
  {
    startYear: 1988,
    label: formatSeasonRangeLabel(1988),
    winner: "Bath",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1988%E2%80%9389_National_Division_1",
  },
  {
    startYear: 1987,
    label: formatSeasonRangeLabel(1987),
    winner: "Leicester Tigers",
    wikipediaUrl: "https://en.wikipedia.org/wiki/1987%E2%80%9388_National_Division_1",
  },
];

const BY_COMPETITION: Record<string, SeasonChampionEntry[]> = {
  premiership: PREMIERSHIP_CHAMPIONS,
};

export function getSeasonChampion(
  competitionSlug: string,
  startYear: number,
): SeasonChampionEntry | null {
  const entries = BY_COMPETITION[competitionSlug];
  if (!entries) return null;
  return entries.find((entry) => entry.startYear === startYear) ?? null;
}

export function lookupCompetitionChampion(
  competitionSlug: string,
  seasonLabel: string,
): SeasonChampionEntry | null {
  const startYear = parseSeasonStartYear(seasonLabel);
  if (startYear == null) return null;
  return getSeasonChampion(competitionSlug, startYear);
}

export function listSeasonChampions(competitionSlug: string): SeasonChampionEntry[] {
  return BY_COMPETITION[competitionSlug] ?? [];
}
