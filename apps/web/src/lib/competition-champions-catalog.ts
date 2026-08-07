import { formatSeasonRangeLabel, parseSeasonStartYear } from "./season-label-utils";
import { wikipediaArticleUrl } from "@rugby365/import-sdk";

export type SeasonChampionEntry = {
  /** Domestic season start year (e.g. 2024 → 2024–25). */
  startYear: number;
  label: string;
  winner: string;
  wikipediaUrl?: string;
  /** Optional Wikipedia tournament statistics page (player scoring boards, etc.). */
  wikipediaStatisticsUrl?: string;
  flashscoreTableUrl?: string;
  flashscorePlayoffUrl?: string;
};

/** Gallagher Premiership champions — winner is playoff/champion, not regular-season table leader. */
export const PREMIERSHIP_CHAMPIONS: SeasonChampionEntry[] = [
  {
    startYear: 2026,
    label: formatSeasonRangeLabel(2026),
    winner: "TBD",
    wikipediaUrl: "https://en.wikipedia.org/wiki/2026%E2%80%9327_Premiership_Rugby",
  },
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

const CHALLENGE_CUP_WINNERS: Record<number, string> = {
  1996: "Bourgoin",
  1997: "Nice",
  1998: "Colomiers",
  1999: "Narbonne",
  2000: "Pau",
  2001: "Saracens",
  2002: "Sale Sharks",
  2003: "Bristol",
  2004: "Brive",
  2005: "Sale Sharks",
  2006: "Gloucester",
  2007: "Clermont",
  2008: "Northampton Saints",
  2009: "Cardiff Blues",
  2010: "Newcastle Falcons",
  2011: "Harlequins",
  2012: "Toulon",
  2013: "Northampton Saints",
  2014: "Gloucester",
  2015: "Saracens",
  2016: "Montpellier",
  2017: "Brive",
  2018: "Bath",
  2019: "Bristol Bears",
  2020: "Leicester Tigers",
  2021: "Montpellier",
  2022: "Leinster",
  2023: "Benetton",
  2024: "Bath",
  2025: "Montpellier",
};

export function challengeCupSeasonPageTitle(startYear: number): string {
  const endYy = String((startYear + 1) % 100).padStart(2, "0");
  const dash = "–";
  if (startYear >= 2021) return `${startYear}${dash}${endYy} EPCR Challenge Cup`;
  if (startYear >= 2014) return `${startYear}${dash}${endYy} European Rugby Challenge Cup`;
  return `${startYear}${dash}${endYy} European Challenge Cup`;
}

export function challengeCupWikipediaSeasonUrl(startYear: number): string {
  return wikipediaArticleUrl(challengeCupSeasonPageTitle(startYear));
}

/** European Challenge Cup / EPCR Challenge Cup champions by season. */
export const CHALLENGE_CUP_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 30 }, (_, index) => {
  const startYear = 1996 + index;
  return {
    startYear,
    label: formatSeasonRangeLabel(startYear),
    winner: CHALLENGE_CUP_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: challengeCupWikipediaSeasonUrl(startYear),
  };
});

const RUGBY_CHAMPIONSHIP_WINNERS: Record<number, string> = {
  1996: "New Zealand",
  1997: "New Zealand",
  1998: "South Africa",
  1999: "New Zealand",
  2000: "Australia",
  2001: "Australia",
  2002: "New Zealand",
  2003: "New Zealand",
  2004: "South Africa",
  2005: "New Zealand",
  2006: "New Zealand",
  2007: "New Zealand",
  2008: "New Zealand",
  2009: "South Africa",
  2010: "New Zealand",
  2011: "Australia",
  2012: "New Zealand",
  2013: "New Zealand",
  2014: "New Zealand",
  2015: "New Zealand",
  2016: "New Zealand",
  2017: "New Zealand",
  2018: "New Zealand",
  2019: "South Africa",
  2020: "New Zealand",
  2021: "South Africa",
  2022: "New Zealand",
  2023: "South Africa",
  2024: "South Africa",
  2025: "TBD",
};

/** Tri Nations (1996–2011, 2020) and Rugby Championship (2012–2019, 2021+). */
export function rugbyChampionshipSeasonPageTitle(year: number): string {
  if (year === 2020 || (year >= 1996 && year <= 2011)) {
    return `${year} Tri Nations Series`;
  }
  return `${year} Rugby Championship`;
}

export function rugbyChampionshipWikipediaSeasonUrl(year: number): string {
  return wikipediaArticleUrl(rugbyChampionshipSeasonPageTitle(year));
}

export const RUGBY_CHAMPIONSHIP_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 30 }, (_, index) => {
  const startYear = 1996 + index;
  return {
    startYear,
    label: String(startYear),
    winner: RUGBY_CHAMPIONSHIP_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: rugbyChampionshipWikipediaSeasonUrl(startYear),
  };
});

/** Currie Cup (1968–2003, 2005–2006) and Currie Cup Premier Division (2004, 2007+). */
export function currieCupSeasonPageTitle(year: number): string {
  if (year === 2004 || year >= 2007) return `${year} Currie Cup Premier Division`;
  return `${year} Currie Cup`;
}

export function currieCupWikipediaSeasonUrl(year: number): string {
  return wikipediaArticleUrl(currieCupSeasonPageTitle(year));
}

export const CURRIE_CUP_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 58 }, (_, index) => {
  const startYear = 1968 + index;
  return {
    startYear,
    label: String(startYear),
    winner: "TBD",
    wikipediaUrl: currieCupWikipediaSeasonUrl(startYear),
  };
});

const CHAMPIONS_CUP_WINNERS: Record<number, string> = {
  1995: "Toulouse",
  1996: "Brive",
  1997: "Bath",
  1998: "Ulster",
  1999: "Northampton Saints",
  2000: "Leicester Tigers",
  2001: "Leicester Tigers",
  2002: "Toulouse",
  2003: "Wasps",
  2004: "Toulouse",
  2005: "Munster",
  2006: "Wasps",
  2007: "Munster",
  2008: "Leinster",
  2009: "Toulouse",
  2010: "Leinster",
  2011: "Leinster",
  2012: "Toulon",
  2013: "Toulon",
  2014: "Toulon",
  2015: "Saracens",
  2016: "Saracens",
  2017: "Leinster",
  2018: "Saracens",
  2019: "Exeter Chiefs",
  2020: "Toulouse",
  2021: "La Rochelle",
  2022: "La Rochelle",
  2023: "Toulouse",
  2024: "Bordeaux Bègles",
  2025: "TBD",
};

/** Heineken Cup (1995–2013) then European Rugby Champions Cup (2014+). */
export function championsCupSeasonPageTitle(startYear: number): string {
  const endYy = String((startYear + 1) % 100).padStart(2, "0");
  const dash = "–";
  if (startYear >= 2014) return `${startYear}${dash}${endYy} European Rugby Champions Cup`;
  return `${startYear}${dash}${endYy} Heineken Cup`;
}

export function championsCupWikipediaSeasonUrl(startYear: number): string {
  return wikipediaArticleUrl(championsCupSeasonPageTitle(startYear));
}

/** Heineken / Investec Champions Cup champions by season start year. */
export const CHAMPIONS_CUP_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 31 }, (_, index) => {
  const startYear = 1995 + index;
  return {
    startYear,
    label: formatSeasonRangeLabel(startYear),
    winner: CHAMPIONS_CUP_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: championsCupWikipediaSeasonUrl(startYear),
  };
});

/** Northern Hemisphere national teams used for Admin → Teams season rosters. */
export const NORTHERN_HEMISPHERE_NATIONS: Array<{ name: string; wikipediaUrl: string }> = [
  { name: "England", wikipediaUrl: "https://en.wikipedia.org/wiki/England_national_rugby_union_team" },
  { name: "France", wikipediaUrl: "https://en.wikipedia.org/wiki/France_national_rugby_union_team" },
  { name: "Ireland", wikipediaUrl: "https://en.wikipedia.org/wiki/Ireland_national_rugby_union_team" },
  { name: "Scotland", wikipediaUrl: "https://en.wikipedia.org/wiki/Scotland_national_rugby_union_team" },
  { name: "Wales", wikipediaUrl: "https://en.wikipedia.org/wiki/Wales_national_rugby_union_team" },
  { name: "Italy", wikipediaUrl: "https://en.wikipedia.org/wiki/Italy_national_rugby_union_team" },
  { name: "Georgia", wikipediaUrl: "https://en.wikipedia.org/wiki/Georgia_national_rugby_union_team" },
  { name: "Portugal", wikipediaUrl: "https://en.wikipedia.org/wiki/Portugal_national_rugby_union_team" },
  { name: "Romania", wikipediaUrl: "https://en.wikipedia.org/wiki/Romania_national_rugby_union_team" },
  { name: "Spain", wikipediaUrl: "https://en.wikipedia.org/wiki/Spain_national_rugby_union_team" },
  { name: "Russia", wikipediaUrl: "https://en.wikipedia.org/wiki/Russia_national_rugby_union_team" },
  { name: "Belgium", wikipediaUrl: "https://en.wikipedia.org/wiki/Belgium_national_rugby_union_team" },
  { name: "Germany", wikipediaUrl: "https://en.wikipedia.org/wiki/Germany_national_rugby_union_team" },
  { name: "Netherlands", wikipediaUrl: "https://en.wikipedia.org/wiki/Netherlands_national_rugby_union_team" },
  { name: "Switzerland", wikipediaUrl: "https://en.wikipedia.org/wiki/Switzerland_national_rugby_union_team" },
  {
    name: "Czech Republic",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Czech_Republic_national_rugby_union_team",
  },
  { name: "Poland", wikipediaUrl: "https://en.wikipedia.org/wiki/Poland_national_rugby_union_team" },
  { name: "Ukraine", wikipediaUrl: "https://en.wikipedia.org/wiki/Ukraine_national_rugby_union_team" },
  { name: "Sweden", wikipediaUrl: "https://en.wikipedia.org/wiki/Sweden_national_rugby_union_team" },
  { name: "Norway", wikipediaUrl: "https://en.wikipedia.org/wiki/Norway_national_rugby_union_team" },
  { name: "Denmark", wikipediaUrl: "https://en.wikipedia.org/wiki/Denmark_national_rugby_union_team" },
  { name: "Lithuania", wikipediaUrl: "https://en.wikipedia.org/wiki/Lithuania_national_rugby_union_team" },
  { name: "Latvia", wikipediaUrl: "https://en.wikipedia.org/wiki/Latvia_national_rugby_union_team" },
  { name: "Moldova", wikipediaUrl: "https://en.wikipedia.org/wiki/Moldova_national_rugby_union_team" },
];

const SIX_NATIONS_WINNERS: Record<number, string> = {
  1995: "England",
  1996: "England",
  1997: "France",
  1998: "France",
  1999: "Scotland",
  2000: "England",
  2001: "England",
  2002: "France",
  2003: "England",
  2004: "France",
  2005: "Wales",
  2006: "France",
  2007: "France",
  2008: "Wales",
  2009: "Ireland",
  2010: "France",
  2011: "England",
  2012: "Wales",
  2013: "Wales",
  2014: "Ireland",
  2015: "Ireland",
  2016: "England",
  2017: "England",
  2018: "Ireland",
  2019: "Wales",
  2020: "England",
  2021: "Wales",
  2022: "France",
  2023: "Ireland",
  2024: "Ireland",
  2025: "France",
  2026: "TBD",
};

/** Five Nations (pre-2000) and Six Nations Championship season pages. */
export function sixNationsSeasonPageTitle(year: number): string {
  if (year < 2000) return `${year} Five Nations Championship`;
  return `${year} Six Nations Championship`;
}

export function sixNationsWikipediaSeasonUrl(year: number): string {
  return wikipediaArticleUrl(sixNationsSeasonPageTitle(year));
}

/** Five Nations from 1995 + Six Nations through current year. */
export const SIX_NATIONS_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 32 }, (_, index) => {
  const startYear = 1995 + index;
  return {
    startYear,
    label: String(startYear),
    winner: SIX_NATIONS_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: sixNationsWikipediaSeasonUrl(startYear),
  };
});

const RUGBY_WORLD_CUP_WINNERS: Record<number, string> = {
  1987: "New Zealand",
  1991: "Australia",
  1995: "South Africa",
  1999: "Australia",
  2003: "England",
  2007: "South Africa",
  2011: "New Zealand",
  2015: "New Zealand",
  2019: "South Africa",
  2023: "South Africa",
  2027: "TBD",
};

export function rugbyWorldCupWikipediaSeasonUrl(year: number): string {
  if (year >= 2027) {
    return wikipediaArticleUrl(`${year} Men's Rugby World Cup`);
  }
  return wikipediaArticleUrl(`${year} Rugby World Cup`);
}

export function rugbyWorldCupWikipediaStatisticsUrl(year: number): string {
  return wikipediaArticleUrl(`${year} Rugby World Cup statistics`);
}

export const RUGBY_WORLD_CUP_CHAMPIONS: SeasonChampionEntry[] = [
  1987, 1991, 1995, 1999, 2003, 2007, 2011, 2015, 2019, 2023, 2027,
].map((startYear) => ({
  startYear,
  label: String(startYear),
  winner: RUGBY_WORLD_CUP_WINNERS[startYear] ?? "TBD",
  wikipediaUrl: rugbyWorldCupWikipediaSeasonUrl(startYear),
  wikipediaStatisticsUrl:
    startYear <= 2023 ? rugbyWorldCupWikipediaStatisticsUrl(startYear) : undefined,
}));

export function rugbyEuropeChampionshipWikipediaSeasonUrl(year: number): string {
  return wikipediaArticleUrl(`${year} Rugby Europe Championship`);
}

/** Rugby Europe Championship (modern naming from 2017). */
export const RUGBY_EUROPE_CHAMPIONSHIP_CHAMPIONS: SeasonChampionEntry[] = Array.from(
  { length: 10 },
  (_, index) => {
    const startYear = 2017 + index;
    return {
      startYear,
      label: String(startYear),
      winner: "TBD",
      wikipediaUrl: rugbyEuropeChampionshipWikipediaSeasonUrl(startYear),
    };
  },
);

/** Verified Wikipedia season pages for end-of-year / autumn internationals. */
export const END_OF_YEAR_INTERNATIONALS_SEASONS: SeasonChampionEntry[] = [
  2017, 2018, 2020, 2021, 2022, 2024, 2025,
].map((startYear) => ({
  startYear,
  label: String(startYear),
  winner: "TBD",
  wikipediaUrl: wikipediaArticleUrl(`${startYear} end-of-year rugby union internationals`),
}));

/** Standalone 2020 Autumn Nations Cup tournament page. */
export const AUTUMN_NATIONS_CUP_SEASONS: SeasonChampionEntry[] = [
  {
    startYear: 2020,
    label: "2020",
    winner: "England",
    wikipediaUrl: wikipediaArticleUrl("Autumn Nations Cup"),
  },
];

/** World Rugby Nations Championship (12-team top tier, launched 2026). */
export const NATIONS_CHAMPIONSHIP_SEASONS: SeasonChampionEntry[] = [
  {
    startYear: 2026,
    label: "2026",
    winner: "TBD",
    wikipediaUrl: wikipediaArticleUrl("2026 Nations Championship"),
  },
];

/** World Rugby Nations Cup (second tier, launched 2026). */
export const WORLD_RUGBY_NATIONS_CUP_SEASONS: SeasonChampionEntry[] = [
  {
    startYear: 2026,
    label: "2026",
    winner: "TBD",
    wikipediaUrl: wikipediaArticleUrl("2026 World Rugby Nations Cup"),
  },
];

/** Top 14 champions keyed by domestic season start year (2005–06 → 2005). */
const TOP_14_WINNERS: Record<number, string> = {
  2005: "Biarritz",
  2006: "Stade Français",
  2007: "Toulouse",
  2008: "Perpignan",
  2009: "Clermont",
  2010: "Toulouse",
  2011: "Toulouse",
  2012: "Castres",
  2013: "Toulon",
  2014: "Stade Français",
  2015: "Racing 92",
  2016: "Clermont",
  2017: "Castres",
  2018: "Toulouse",
  2019: "Cancelled",
  2020: "Toulouse",
  2021: "Montpellier",
  2022: "Toulouse",
  2023: "Toulouse",
  2024: "Toulouse",
  2025: "TBD",
};

export function top14SeasonPageTitle(startYear: number): string {
  const end = String(startYear + 1).slice(-2);
  return `${startYear}–${end} Top 14 season`;
}

export function top14WikipediaSeasonUrl(startYear: number): string {
  return wikipediaArticleUrl(top14SeasonPageTitle(startYear));
}

/** French Top 14 seasons from the modern 14-team era (2005–06 onward). */
export const TOP_14_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 21 }, (_, index) => {
  const startYear = 2005 + index;
  return {
    startYear,
    label: formatSeasonRangeLabel(startYear),
    winner: TOP_14_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: top14WikipediaSeasonUrl(startYear),
  };
});

/** RFU Championship / Champ Rugby champions keyed by domestic season start year (2009–10 → 2009). */
const RFU_CHAMPIONSHIP_WINNERS: Record<number, string> = {
  2009: "Exeter Chiefs",
  2010: "Worcester Warriors",
  2011: "London Welsh",
  2012: "Newcastle Falcons",
  2013: "London Welsh",
  2014: "Worcester Warriors",
  2015: "Bristol",
  2016: "London Irish",
  2017: "Bristol",
  2018: "London Irish",
  2019: "Newcastle Falcons",
  2020: "Saracens",
  2021: "Ealing Trailfinders",
  2022: "Jersey Reds",
  2023: "Ealing Trailfinders",
  2024: "Ealing Trailfinders",
  2025: "Worcester Warriors",
};

export function rfuChampionshipSeasonPageTitle(startYear: number): string {
  const end = String(startYear + 1).slice(-2);
  // 2025–26 rebranded to Champ Rugby; older seasons stay RFU Championship.
  if (startYear >= 2025) return `${startYear}–${end} Champ Rugby`;
  return `${startYear}–${end} RFU Championship`;
}

export function rfuChampionshipWikipediaSeasonUrl(startYear: number): string {
  // Prefer the user-facing RFU Championship title when it exists (2009–25);
  // Champ Rugby title for the rebranded 2025–26 season.
  if (startYear >= 2025) {
    return wikipediaArticleUrl(rfuChampionshipSeasonPageTitle(startYear));
  }
  const end = String(startYear + 1).slice(-2);
  return wikipediaArticleUrl(`${startYear}–${end} RFU Championship`);
}

/** England RFU Championship / Champ Rugby seasons (2009–10 onward). */
export const RFU_CHAMPIONSHIP_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 17 }, (_, index) => {
  const startYear = 2009 + index;
  return {
    startYear,
    label: formatSeasonRangeLabel(startYear),
    winner: RFU_CHAMPIONSHIP_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: rfuChampionshipWikipediaSeasonUrl(startYear),
  };
});

/** Super Rugby champions keyed by calendar year (Super 12 / Super 14 / Super Rugby / Pacific). */
const SUPER_RUGBY_WINNERS: Record<number, string> = {
  1996: "Blues",
  1997: "Blues",
  1998: "Crusaders",
  1999: "Crusaders",
  2000: "Crusaders",
  2001: "Brumbies",
  2002: "Crusaders",
  2003: "Blues",
  2004: "Brumbies",
  2005: "Crusaders",
  2006: "Crusaders",
  2007: "Bulls",
  2008: "Crusaders",
  2009: "Bulls",
  2010: "Bulls",
  2011: "Reds",
  2012: "Chiefs",
  2013: "Chiefs",
  2014: "Waratahs",
  2015: "Highlanders",
  2016: "Hurricanes",
  2017: "Crusaders",
  2018: "Crusaders",
  2019: "Crusaders",
  2020: "Cancelled",
  2021: "Regional",
  2022: "Crusaders",
  2023: "Crusaders",
  2024: "Blues",
  2025: "Crusaders",
  2026: "Hurricanes",
};

export function superRugbySeasonPageTitle(year: number): string {
  if (year <= 2005) return `${year} Super 12 season`;
  if (year <= 2010) return `${year} Super 14 season`;
  if (year <= 2021) return `${year} Super Rugby season`;
  return `${year} Super Rugby Pacific season`;
}

export function superRugbyWikipediaSeasonUrl(year: number): string {
  return wikipediaArticleUrl(superRugbySeasonPageTitle(year));
}

/** Super Rugby calendar-year seasons from Super 12 (1996) through Super Rugby Pacific. */
export const SUPER_RUGBY_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 31 }, (_, index) => {
  const startYear = 1996 + index;
  return {
    startYear,
    label: String(startYear),
    winner: SUPER_RUGBY_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: superRugbyWikipediaSeasonUrl(startYear),
  };
});

/** NZ National Provincial Championship champions (modern professional era, 2006–). */
const NPC_WINNERS: Record<number, string> = {
  2006: "Waikato",
  2007: "Auckland",
  2008: "Canterbury",
  2009: "Canterbury",
  2010: "Canterbury",
  2011: "Canterbury",
  2012: "Canterbury",
  2013: "Canterbury",
  2014: "Taranaki",
  2015: "Canterbury",
  2016: "Canterbury",
  2017: "Canterbury",
  2018: "Auckland",
  2019: "Tasman",
  2020: "Tasman",
  2021: "Waikato",
  2022: "Wellington",
  2023: "Taranaki",
  2024: "Wellington",
  2025: "Canterbury",
  2026: "TBD",
};

export function npcSeasonPageTitle(year: number): string {
  if (year <= 2009) return `${year} Air New Zealand Cup`;
  if (year <= 2015) return `${year} ITM Cup`;
  if (year <= 2020) return `${year} Mitre 10 Cup`;
  return `${year} Bunnings NPC`;
}

export function npcWikipediaSeasonUrl(year: number): string | undefined {
  // 2026 season page may not exist yet on Wikipedia.
  if (year >= 2026) return undefined;
  return wikipediaArticleUrl(npcSeasonPageTitle(year));
}

/** NZ NPC / Air NZ Cup / ITM Cup / Mitre 10 Cup / Bunnings NPC (2006 onward). */
export const NPC_CHAMPIONS: SeasonChampionEntry[] = Array.from({ length: 21 }, (_, index) => {
  const startYear = 2006 + index;
  return {
    startYear,
    label: String(startYear),
    winner: NPC_WINNERS[startYear] ?? "TBD",
    wikipediaUrl: npcWikipediaSeasonUrl(startYear),
  };
});

const BY_COMPETITION: Record<string, SeasonChampionEntry[]> = {
  premiership: PREMIERSHIP_CHAMPIONS,
  "challenge-cup": CHALLENGE_CUP_CHAMPIONS,
  "rugby-champions-cup": CHAMPIONS_CUP_CHAMPIONS,
  "rugby-championship": RUGBY_CHAMPIONSHIP_CHAMPIONS,
  "currie-cup": CURRIE_CUP_CHAMPIONS,
  "six-nations": SIX_NATIONS_CHAMPIONS,
  "rugby-world-cup": RUGBY_WORLD_CUP_CHAMPIONS,
  "rugby-europe-championship": RUGBY_EUROPE_CHAMPIONSHIP_CHAMPIONS,
  "end-of-year-internationals": END_OF_YEAR_INTERNATIONALS_SEASONS,
  "autumn-nations-cup": AUTUMN_NATIONS_CUP_SEASONS,
  "nations-championship": NATIONS_CHAMPIONSHIP_SEASONS,
  "world-rugby-nations-cup": WORLD_RUGBY_NATIONS_CUP_SEASONS,
  "top-14": TOP_14_CHAMPIONS,
  "super-rugby": SUPER_RUGBY_CHAMPIONS,
  championship: RFU_CHAMPIONSHIP_CHAMPIONS,
  npc: NPC_CHAMPIONS,
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