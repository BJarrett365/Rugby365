/**
 * Admin catalog of competitions to ensure in CMS + import from feeds/Wikipedia.
 * Groups mirror competition-admin-groups.ts.
 */
export type CompCatalogEntry = {
  slug: string;
  name: string;
  competitionType: "domestic" | "international" | "european" | "world_cup";
  group:
    | "international"
    | "club"
    | "provincial"
    | "regional"
    | "historic";
  wikipediaUrl: string;
  planetRugbySlug?: string;
  sdmsCompCode?: string;
  /** First season year for empty shells (calendar or start-year). */
  firstYear?: number;
  /** Rugby Data league IDs (all seasons/stages map to this CMS competition). */
  rugbyDataLeagueIds?: number[];
  /** Optional Wikipedia season pages for import (previous + current). */
  wikiSeasons?: Array<{ startYear: number; url: string }>;
  notes?: string;
};

const wiki = (title: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

function crossYearRange(
  from: number,
  to: number,
  title: (startYear: number, endShort: string) => string,
): Array<{ startYear: number; url: string }> {
  const out: Array<{ startYear: number; url: string }> = [];
  for (let y = from; y <= to; y += 1) {
    const endShort = String((y + 1) % 100).padStart(2, "0");
    out.push({ startYear: y, url: wiki(title(y, endShort)) });
  }
  return out;
}

function calendarRange(
  from: number,
  to: number,
  title: (year: number) => string,
): Array<{ startYear: number; url: string }> {
  const out: Array<{ startYear: number; url: string }> = [];
  for (let y = from; y <= to; y += 1) {
    out.push({ startYear: y, url: wiki(title(y)) });
  }
  return out;
}

export const COMPETITION_IMPORT_CATALOG: CompCatalogEntry[] = [
  // ── International ──────────────────────────────────────────────
  {
    slug: "british-irish-lions",
    name: "British & Irish Lions Tours",
    competitionType: "international",
    group: "international",
    wikipediaUrl: wiki("British_&_Irish_Lions"),
    firstYear: 1989,
    rugbyDataLeagueIds: [31],
    wikiSeasons: [
      { startYear: 2025, url: wiki("2025_British_&_Irish_Lions_tour_to_Australia") },
      { startYear: 2021, url: wiki("2021_British_&_Irish_Lions_tour_to_South_Africa") },
      { startYear: 2017, url: wiki("2017_British_&_Irish_Lions_tour_to_New_Zealand") },
      { startYear: 2013, url: wiki("2013_British_&_Irish_Lions_tour_to_Australia") },
      { startYear: 2009, url: wiki("2009_British_&_Irish_Lions_tour_to_South_Africa") },
      { startYear: 2005, url: wiki("2005_British_&_Irish_Lions_tour_to_New_Zealand") },
      { startYear: 2001, url: wiki("2001_British_&_Irish_Lions_tour_to_Australia") },
      { startYear: 1997, url: wiki("1997_British_Lions_tour_to_South_Africa") },
      { startYear: 1993, url: wiki("1993_British_Lions_tour_to_New_Zealand") },
    ],
  },
  {
    slug: "pacific-nations-cup",
    name: "Pacific Nations Cup",
    competitionType: "international",
    group: "international",
    wikipediaUrl: wiki("Pacific_Nations_Cup"),
    firstYear: 2006,
    rugbyDataLeagueIds: [77, 78, 109, 110],
    wikiSeasons: calendarRange(2019, 2024, (y) => `${y}_Pacific_Nations_Cup`).concat([
      { startYear: 2018, url: wiki("2018_World_Rugby_Pacific_Nations_Cup") },
      { startYear: 2017, url: wiki("2017_World_Rugby_Pacific_Nations_Cup") },
      { startYear: 2016, url: wiki("2016_World_Rugby_Pacific_Nations_Cup") },
      { startYear: 2015, url: wiki("2015_World_Rugby_Pacific_Nations_Cup") },
    ]),
  },
  {
    slug: "world-rugby-u20-championship",
    name: "World Rugby U20 Championship",
    competitionType: "international",
    group: "international",
    wikipediaUrl: wiki("World_Rugby_U20_Championship"),
    firstYear: 2008,
    rugbyDataLeagueIds: [42, 43, 44, 40, 41, 193, 194, 195, 196, 220, 221],
    wikiSeasons: calendarRange(2015, 2025, (y) => `${y}_World_Rugby_U20_Championship`),
  },
  {
    slug: "world-rugby-u20-trophy",
    name: "World Rugby U20 Trophy",
    competitionType: "international",
    group: "international",
    wikipediaUrl: wiki("World_Rugby_U20_Trophy"),
    firstYear: 2008,
    wikiSeasons: calendarRange(2019, 2024, (y) => `${y}_World_Rugby_U20_Trophy`),
  },
  {
    slug: "world-rugby-pacific-challenge",
    name: "World Rugby Pacific Challenge",
    competitionType: "international",
    group: "international",
    wikipediaUrl: wiki("World_Rugby_Pacific_Challenge"),
    firstYear: 2006,
    wikiSeasons: calendarRange(2019, 2024, (y) => `${y}_World_Rugby_Pacific_Challenge`),
  },
  {
    slug: "international-matches-n062z68w",
    name: "Summer Internationals",
    competitionType: "international",
    group: "international",
    wikipediaUrl: wiki("Mid-year_rugby_union_internationals"),
    firstYear: 2000,
    notes: "Canonical Summer Internationals catch-all (SDMS international-matches).",
  },

  // ── Club / Domestic ────────────────────────────────────────────
  {
    slug: "pro-d2",
    name: "Pro D2",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Rugby_Pro_D2"),
    firstYear: 2000,
    rugbyDataLeagueIds: [51, 96, 232, 52, 187, 53, 189],
    wikiSeasons: crossYearRange(2015, 2024, (y, end) => `${y}–${end}_Rugby_Pro_D2_season`),
  },
  {
    slug: "nationale",
    name: "Nationale",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Nationale_(rugby_union)"),
    firstYear: 2020,
    wikiSeasons: [
      {
        startYear: 2024,
        url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_Championnat_F%C3%A9d%C3%A9ral_Nationale_season",
      },
      {
        startYear: 2023,
        url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Championnat_F%C3%A9d%C3%A9ral_Nationale_season",
      },
      {
        startYear: 2022,
        url: "https://en.wikipedia.org/wiki/2022%E2%80%9323_Nationale",
      },
      {
        startYear: 2021,
        url: "https://en.wikipedia.org/wiki/2021%E2%80%9322_Nationale",
      },
      {
        startYear: 2020,
        url: "https://en.wikipedia.org/wiki/2020%E2%80%9321_Nationale",
      },
    ],
  },
  {
    slug: "premiership-rugby-cup",
    name: "Premiership Rugby Cup",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Premiership_Rugby_Cup"),
    firstYear: 2018,
    rugbyDataLeagueIds: [56, 57, 106, 155, 230],
    wikiSeasons: [
      { startYear: 2024, url: wiki("2024–25_Premiership_Rugby_Cup") },
      { startYear: 2023, url: wiki("2023–24_Premiership_Rugby_Cup") },
      { startYear: 2022, url: wiki("2022–23_Premiership_Rugby_Cup") },
      { startYear: 2021, url: wiki("2021–22_Premiership_Rugby_Cup") },
      { startYear: 2019, url: wiki("2019–20_Premiership_Rugby_Cup") },
      { startYear: 2018, url: wiki("2018–19_Premiership_Rugby_Cup") },
    ],
  },
  {
    slug: "national-league-1",
    name: "National League 1",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("National_League_1"),
    firstYear: 2009,
    wikiSeasons: crossYearRange(2018, 2024, (y, end) => `${y}–${end}_National_League_1`),
  },
  {
    slug: "national-league-2",
    name: "National League 2",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("National_League_2_East"),
    firstYear: 2009,
    notes: "England National League 2 (East/West structure varies by season).",
  },
  {
    slug: "all-ireland-league",
    name: "All-Ireland League",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("All-Ireland_League_(rugby_union)"),
    firstYear: 1990,
  },
  {
    slug: "welsh-premiership",
    name: "Welsh Premiership",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Welsh_Premier_Division"),
    firstYear: 1990,
    wikiSeasons: crossYearRange(2018, 2023, (y, end) => `${y}–${end}_Welsh_Premier_Division`),
  },
  {
    slug: "super-series",
    name: "Super Series",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Super_Series_(rugby_union)"),
    firstYear: 2022,
    wikiSeasons: [
      { startYear: 2023, url: wiki("2023–24_Super_Series") },
      { startYear: 2022, url: wiki("2022–23_Super_Series") },
    ],
  },
  {
    slug: "serie-a-elite",
    name: "Serie A Elite",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Serie_A_Elite"),
    firstYear: 2023,
    wikiSeasons: crossYearRange(2023, 2024, (y, end) => `${y}–${end}_Serie_A_Elite`),
  },
  {
    slug: "japan-rugby-league-one",
    name: "Japan Rugby League One",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Japan_Rugby_League_One"),
    firstYear: 2003,
    wikiSeasons: [
      {
        startYear: 2024,
        url: "https://en.wikipedia.org/wiki/2024%E2%80%9325_Japan_Rugby_League_One_%E2%80%93_Division_1",
      },
      {
        startYear: 2023,
        url: "https://en.wikipedia.org/wiki/2023%E2%80%9324_Japan_Rugby_League_One_%E2%80%93_Division_1",
      },
      {
        startYear: 2022,
        url: "https://en.wikipedia.org/wiki/2022%E2%80%9323_Japan_Rugby_League_One_%E2%80%93_Division_1",
      },
      ...crossYearRange(2015, 2021, (y, end) => `${y}–${end}_Top_League`),
    ],
  },
  {
    slug: "major-league-rugby",
    name: "Major League Rugby",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Major_League_Rugby"),
    firstYear: 2018,
    rugbyDataLeagueIds: [46, 75],
    wikiSeasons: calendarRange(2018, 2025, (y) => `${y}_Major_League_Rugby_season`),
  },
  {
    slug: "super-rugby-americas",
    name: "Super Rugby Americas",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Super_Rugby_Americas"),
    firstYear: 2019,
    wikiSeasons: [
      { startYear: 2025, url: wiki("2025_Super_Rugby_Americas_season") },
      { startYear: 2024, url: wiki("2024_Super_Rugby_Americas_season") },
      { startYear: 2023, url: wiki("2023_Super_Rugby_Americas") },
      { startYear: 2022, url: wiki("2022_Súper_Liga_Americana_de_Rugby") },
      { startYear: 2021, url: wiki("2021_Súper_Liga_Americana_de_Rugby") },
      { startYear: 2020, url: wiki("2020_Súper_Liga_Americana_de_Rugby") },
      { startYear: 2019, url: wiki("2019_Súper_Liga_Americana_de_Rugby") },
    ],
  },
  {
    slug: "campeonato-portugues",
    name: "Campeonato Português",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Campeonato_Português_de_Rugby"),
    firstYear: 2000,
  },
  {
    slug: "division-de-honor",
    name: "División de Honor",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("División_de_Honor_de_Rugby"),
    firstYear: 2000,
  },
  {
    slug: "liga-nationala",
    name: "Liga Națională de Rugby",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Liga_Națională_de_Rugby"),
    firstYear: 2000,
  },
  {
    slug: "didi-10",
    name: "Didi 10",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Didi_10"),
    firstYear: 2011,
  },

  // ── Provincial ─────────────────────────────────────────────────
  {
    slug: "heartland-championship",
    name: "Heartland Championship",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("Heartland_Championship"),
    firstYear: 2006,
    rugbyDataLeagueIds: [107, 217, 121],
    wikiSeasons: calendarRange(2015, 2025, (y) => `${y}_Heartland_Championship`),
  },
  {
    slug: "ranfurly-shield",
    name: "Ranfurly Shield",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("Ranfurly_Shield"),
    firstYear: 2000,
  },
  {
    slug: "farah-palmer-cup",
    name: "Farah Palmer Cup",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("Farah_Palmer_Cup"),
    firstYear: 2006,
    wikiSeasons: calendarRange(2018, 2024, (y) => `${y}_Farah_Palmer_Cup`),
  },
  {
    slug: "sa-cup",
    name: "SA Cup",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("SA_Cup"),
    firstYear: 2024,
    wikiSeasons: calendarRange(2024, 2026, (y) => `${y}_SA_Cup`),
  },
  {
    slug: "currie-cup-first-division",
    name: "Currie Cup First Division",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("Currie_Cup_First_Division"),
    firstYear: 2000,
    wikiSeasons: calendarRange(2010, 2026, (y) => `${y}_Currie_Cup_First_Division`),
  },
  {
    slug: "varsity-cup",
    name: "Varsity Cup",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Varsity_Cup"),
    firstYear: 2008,
    wikiSeasons: calendarRange(2008, 2026, (y) => `${y}_Varsity_Cup`),
    notes: "University pathway for Springboks.",
  },
  {
    slug: "varsity-shield",
    name: "Varsity Shield",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("Varsity_Shield"),
    firstYear: 2011,
    wikiSeasons: calendarRange(2011, 2026, (y) => `${y}_Varsity_Shield`),
    notes: "Second-tier university competition.",
  },
  {
    slug: "craven-week",
    name: "Craven Week",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("Craven_Week"),
    firstYear: 1964,
    notes: "Schools pathway hub — season pages are sparse; shell + Wikipedia hub for now.",
  },
  {
    slug: "academy-week",
    name: "Academy Week",
    competitionType: "domestic",
    group: "provincial",
    wikipediaUrl: wiki("Craven_Week"),
    firstYear: 2000,
    notes: "SA Rugby schools academy week — Wikipedia coverage is event-page based; hub linked via Craven Week.",
  },
  {
    slug: "sa-schools",
    name: "SA Schools",
    competitionType: "international",
    group: "provincial",
    wikipediaUrl: wiki("South_Africa_national_under-18_rugby_union_team"),
    firstYear: 2000,
    notes: "South Africa Schools / U18 national pathway side.",
  },

  // ── Regional / European ────────────────────────────────────────
  {
    slug: "rugby-europe-super-cup",
    name: "Rugby Europe Super Cup",
    competitionType: "european",
    group: "regional",
    wikipediaUrl: wiki("Rugby_Europe_Super_Cup"),
    firstYear: 2021,
    wikiSeasons: calendarRange(2021, 2024, (y) => `${y}_Rugby_Europe_Super_Cup`),
  },

  // ── Club: URC lineage (canonical modern slug) ──────────────────
  {
    slug: "united-rugby-championship",
    name: "United Rugby Championship",
    competitionType: "domestic",
    group: "club",
    wikipediaUrl: wiki("United_Rugby_Championship"),
    planetRugbySlug: "united-rugby-championship",
    sdmsCompCode: "vx91ejw1",
    firstYear: 2001,
    wikiSeasons: [
      ...crossYearRange(2001, 2010, (y, end) => `${y}–${end}_Celtic_League`),
      ...crossYearRange(2011, 2016, (y, end) => `${y}–${end}_Pro12`),
      ...crossYearRange(2017, 2020, (y, end) => `${y}–${end}_Pro14`),
      ...crossYearRange(2021, 2025, (y, end) => `${y}–${end}_United_Rugby_Championship`),
    ],
    notes:
      "Canonical URC page. Lineage Celtic League (2001) → Pro12 → Pro14 → URC (2021+). Historic branding rows remain under celtic-league / pro12 / pro14.",
  },

  // ── Historic ───────────────────────────────────────────────────
  {
    slug: "celtic-league",
    name: "Celtic League",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("Celtic_League_(rugby_union)"),
    firstYear: 2001,
    wikiSeasons: crossYearRange(2001, 2010, (y, end) => `${y}–${end}_Celtic_League`),
    notes: "Predecessor of Pro12 / Pro14 / URC.",
  },
  {
    slug: "pro12",
    name: "Pro12",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("Pro12"),
    firstYear: 2011,
    wikiSeasons: crossYearRange(2011, 2016, (y, end) => `${y}–${end}_Pro12`),
  },
  {
    slug: "pro14",
    name: "Pro14",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("Pro14"),
    firstYear: 2017,
    wikiSeasons: crossYearRange(2017, 2020, (y, end) => `${y}–${end}_Pro14`),
  },
  {
    slug: "anglo-welsh-cup",
    name: "Anglo-Welsh Cup",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("Anglo-Welsh_Cup"),
    firstYear: 2005,
    wikiSeasons: crossYearRange(2014, 2017, (y, end) => `${y}–${end}_Anglo-Welsh_Cup`),
  },
  {
    slug: "heineken-cup",
    name: "Heineken Cup",
    competitionType: "european",
    group: "historic",
    wikipediaUrl: wiki("Heineken_Cup"),
    firstYear: 1995,
    wikiSeasons: crossYearRange(2005, 2013, (y, end) => `${y}–${end}_Heineken_Cup`),
    notes: "Historic branding of Champions Cup; modern seasons live under rugby-champions-cup.",
  },
  {
    slug: "european-challenge-cup-historic",
    name: "European Rugby Challenge Cup (historic)",
    competitionType: "european",
    group: "historic",
    wikipediaUrl: wiki("EPCR_Challenge_Cup"),
    firstYear: 1996,
    notes: "Historic Challenge Cup branding; modern seasons under challenge-cup.",
  },
  {
    slug: "air-new-zealand-cup",
    name: "Air New Zealand Cup",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("Air_New_Zealand_Cup"),
    firstYear: 2006,
    wikiSeasons: calendarRange(2006, 2009, (y) => `${y}_Air_New_Zealand_Cup`),
    notes: "2006–09 NPC branding; seasons primarily under npc.",
  },
  {
    slug: "itm-cup",
    name: "ITM Cup",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("ITM_Cup"),
    firstYear: 2010,
    wikiSeasons: calendarRange(2010, 2015, (y) => `${y}_ITM_Cup`),
    notes: "2010–15 NPC branding; seasons primarily under npc.",
  },
  {
    slug: "mitre-10-cup",
    name: "Mitre 10 Cup",
    competitionType: "domestic",
    group: "historic",
    wikipediaUrl: wiki("Mitre_10_Cup"),
    firstYear: 2016,
    wikiSeasons: calendarRange(2016, 2020, (y) => `${y}_Mitre_10_Cup`),
    notes: "2016–20 NPC branding; seasons primarily under npc.",
  },
];

export function catalogBySlug(slug: string): CompCatalogEntry | undefined {
  return COMPETITION_IMPORT_CATALOG.find((c) => c.slug === slug);
}
