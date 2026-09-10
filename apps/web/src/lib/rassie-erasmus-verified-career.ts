/**
 * Verified Rassie Erasmus biographical and tenure facts for CMS seeding.
 * Match stats are still calculated from fixtures + team_coaching_staff dates.
 *
 * Sources (see each field): Wikipedia, SA Rugby, SABC Sport, AP, BBC, Bokhist,
 * Munster Rugby, World Rugby Awards.
 */
export const RASSIE_ERASMUS_SLUG = "rassie-erasmus";
export const RASSIE_ERASMUS_WIKIPEDIA = "https://en.wikipedia.org/wiki/Rassie_Erasmus";
export const RASSIE_ERASMUS_WIKIDATA_ID = "Q2021513";

export const RASSIE_ERASMUS_PROFILE = {
  name: "Rassie Erasmus",
  knownAs: "Rassie",
  fullName: "Johan Erasmus",
  birthDate: "1972-11-05",
  placeOfBirth: "Despatch",
  countryOfBirth: "South Africa",
  nationality: "South Africa",
  heightCm: 191,
  formerPlayingPositions: "Flanker / No. 8",
  playingCareerStatus: "retired",
  coachingCareerStartYear: 2004,
  /** Current Springboks head-coach stint (SA Rugby, 6 February 2024). */
  appointedOn: "2024-02-06",
  /**
   * SA Rugby (5 Dec 2025) extended the deal through the 2031 World Cup.
   * No published calendar end-date — leave the date column empty.
   */
  contractExpiresOn: null as string | null,
  preferredSystem: null as string | null,
  coachingStyle: null as string | null,
  wikipediaUrl: RASSIE_ERASMUS_WIKIPEDIA,
  wikidataId: RASSIE_ERASMUS_WIKIDATA_ID,
  sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  bioSummary:
    "Johan “Rassie” Erasmus (born 5 November 1972 in Despatch) is a South African rugby union coach and former Springbok loose forward (36 Tests, 1997–2001, including the 1999 Rugby World Cup). He is the current Springboks head coach in his second stint, appointed by SA Rugby on 6 February 2024. He was first named Springboks head coach on 1 March 2018 and led South Africa through the 2019 Rugby World Cup, then served as Director of Rugby (including the 2023 World Cup cycle, when Jacques Nienaber was named head coach) before returning as head coach. South Africa won the Rugby World Cup in 2019 (head coach) and 2023 (director of rugby), and The Rugby Championship in 2019, 2024 and 2025. SA Rugby announced on 5 December 2025 that his contract had been extended through the 2031 Rugby World Cup; an exact calendar end-date has not been published.",
} as const;

export type RugbyChampionshipCoachInvolvement =
  | { year: number; involved: false; reason: string }
  | {
      year: number;
      involved: true;
      role: "head_coach" | "director_of_rugby" | "high_performance";
      namedHeadCoach: boolean;
      team: "South Africa";
      tournamentHeld: boolean;
      result?: string;
      notes: string;
    };

/**
 * Rugby Championship 2012–2026: only credit a head-coach role when he was the
 * named Springboks match coach. Employment at SARU alone is not enough.
 */
export const RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026: RugbyChampionshipCoachInvolvement[] = [
  {
    year: 2012,
    involved: true,
    role: "high_performance",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes:
      "SARU General Manager: High Performance from April 2012 (Wikipedia). Heyneke Meyer was Springboks head coach. Erasmus assisted in training camps — not the TRC match coach.",
  },
  {
    year: 2013,
    involved: true,
    role: "high_performance",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes: "Still SARU GM High Performance. Heyneke Meyer was Springboks head coach.",
  },
  {
    year: 2014,
    involved: true,
    role: "high_performance",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes: "Still SARU GM High Performance. Heyneke Meyer was Springboks head coach.",
  },
  {
    year: 2015,
    involved: true,
    role: "high_performance",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes: "Still SARU GM High Performance. Heyneke Meyer was Springboks head coach.",
  },
  {
    year: 2016,
    involved: false,
    reason:
      "Joined Munster as Director of Rugby on 1 July 2016 (Munster Rugby). Allister Coetzee was Springboks head coach for the 2016 Rugby Championship.",
  },
  {
    year: 2017,
    involved: false,
    reason:
      "Munster Director of Rugby through December 2017. Allister Coetzee coached the 2017 Rugby Championship. Erasmus’s SARU Director of Rugby role began after he left Munster.",
  },
  {
    year: 2018,
    involved: true,
    role: "head_coach",
    namedHeadCoach: true,
    team: "South Africa",
    tournamentHeld: true,
    result: "2nd (6 matches, 3 wins, 3 losses)",
    notes:
      "Named Springboks head coach 1 March 2018 (Wikipedia / SA Rugby). Led South Africa to second in the 2018 Rugby Championship.",
  },
  {
    year: 2019,
    involved: true,
    role: "head_coach",
    namedHeadCoach: true,
    team: "South Africa",
    tournamentHeld: true,
    result: "Champions (3 matches, 2 wins, 1 draw)",
    notes:
      "Springboks head coach. South Africa won the shortened 2019 Rugby Championship (Wikipedia / SANZAAR).",
  },
  {
    year: 2020,
    involved: true,
    role: "director_of_rugby",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes:
      "Director of Rugby after stepping back from the named head-coach role post-2019 World Cup. South Africa withdrew from the 2020 tournament (COVID-19). Jacques Nienaber was later the named head coach.",
  },
  {
    year: 2021,
    involved: true,
    role: "director_of_rugby",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes:
      "Director of Rugby. Jacques Nienaber was the named Springboks head coach (Bokhist: Nienaber Tests from 2 July 2021).",
  },
  {
    year: 2022,
    involved: true,
    role: "director_of_rugby",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    notes: "Director of Rugby. Jacques Nienaber was the named Springboks head coach.",
  },
  {
    year: 2023,
    involved: true,
    role: "director_of_rugby",
    namedHeadCoach: false,
    team: "South Africa",
    tournamentHeld: true,
    result: "2nd under named head coach Jacques Nienaber",
    notes:
      "Director of Rugby during the shortened 2023 Rugby Championship. Nienaber was named head coach. Erasmus is credited by SA Rugby with the 2023 World Cup programme, not as TRC match coach.",
  },
  {
    year: 2024,
    involved: true,
    role: "head_coach",
    namedHeadCoach: true,
    team: "South Africa",
    tournamentHeld: true,
    result: "Champions (6 matches, 5 wins, 1 loss)",
    notes:
      "Returned as Springboks head coach on 6 February 2024 (SA Rugby / SABC Sport / AP). South Africa won the 2024 Rugby Championship.",
  },
  {
    year: 2025,
    involved: true,
    role: "head_coach",
    namedHeadCoach: true,
    team: "South Africa",
    tournamentHeld: true,
    result: "Champions (6 matches, 4 wins, 2 losses)",
    notes: "Springboks head coach. South Africa won the 2025 Rugby Championship (Wikipedia / SA Rugby).",
  },
  {
    year: 2026,
    involved: false,
    reason:
      "The Rugby Championship was not held in 2026. Erasmus remains Springboks head coach (SA Rugby contract extension, 5 December 2025).",
  },
];

export function rassieErasmusRugbyChampionshipHeadCoachYears(): number[] {
  return RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026.filter(
    (row): row is Extract<RugbyChampionshipCoachInvolvement, { involved: true }> =>
      row.involved && row.namedHeadCoach,
  ).map((row) => row.year);
}

/** Inclusive calendar windows when Erasmus was the named Springboks head coach. */
export const RASSIE_ERASMUS_SPRINGBOK_HEAD_COACH_WINDOWS = [
  { startDate: "2018-03-01", endDate: "2019-11-02" },
  { startDate: "2024-02-06", endDate: null as string | null },
] as const;

export function isRassieSpringbokHeadCoachMatchDate(isoDate: string): boolean {
  const day = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return RASSIE_ERASMUS_SPRINGBOK_HEAD_COACH_WINDOWS.some((window) => {
    if (day < window.startDate) return false;
    if (window.endDate && day > window.endDate) return false;
    return true;
  });
}

export type VerifiedCoachingTenure = {
  importKey: string;
  teamSlugCandidates: string[];
  role: string;
  careerType: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  isPrimaryCoach: boolean;
  eligibleForCareerRecord: boolean;
  showOnOverview: boolean;
  overviewLabel: string;
  teamDisplayName?: string;
  notes: string;
  sourceUrl: string;
};

export const RASSIE_ERASMUS_COACHING_TENURES: VerifiedCoachingTenure[] = [
  {
    importKey: "wikipedia:rassie:fsc:coach:2004-2006",
    teamSlugCandidates: ["free-state-cheetahs", "cheetahs-x7jq3161", "free-state"],
    role: "head_coach",
    careerType: "coach",
    startDate: "2004-01-01",
    endDate: "2006-12-31",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: true,
    showOnOverview: true,
    overviewLabel: "Head Coach",
    teamDisplayName: "Free State Cheetahs",
    notes: "Free State Cheetahs head coach. Currie Cup winners 2005 and shared 2006 (Wikipedia).",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:cheetahs:sr:2006-2007",
    teamSlugCandidates: ["free-state-cheetahs", "cheetahs-x7jq3161", "free-state"],
    role: "head_coach",
    careerType: "coach",
    startDate: "2006-01-01",
    endDate: "2007-06-30",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: true,
    showOnOverview: true,
    overviewLabel: "Head Coach",
    teamDisplayName: "Cheetahs",
    notes: "Cheetahs Super 14 2006–2007 (Wikipedia). Left after 2007 Super 14 for a brief Springboks technical role, then Western Province.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:sa:tech-adviser:2007",
    teamSlugCandidates: ["south-africa"],
    role: "technical_adviser",
    careerType: "technical",
    startDate: "2007-07-01",
    endDate: "2007-08-31",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "Technical Adviser",
    notes:
      "Appointed Springboks technical adviser ahead of the 2007 World Cup; left shortly afterwards for Western Province (Wikipedia). Not the Test match coach.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:wp:coach:2007-2010",
    teamSlugCandidates: ["western-province", "western-province-m46v"],
    role: "director_of_rugby",
    careerType: "management",
    startDate: "2007-08-01",
    endDate: "2012-01-31",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "Director of Rugby",
    teamDisplayName: "Western Province",
    notes:
      "Western Province director of rugby from 2007. From mid-2009 Allister Coetzee was named provincial head coach; Erasmus became senior professional coach (Wikipedia). Match stats are not attributed from this DoR row.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:stormers:coach:2008-2011",
    teamSlugCandidates: ["dhl-stormers-xxiii-pd9ry3j8", "stormers"],
    role: "head_coach",
    careerType: "coach",
    startDate: "2008-01-01",
    endDate: "2009-06-30",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: true,
    showOnOverview: true,
    overviewLabel: "Head Coach",
    teamDisplayName: "Stormers",
    notes:
      "Stormers head coach from the 2008 Super 14. Mid-2009 Coetzee became named Super Rugby head coach; Erasmus moved to senior professional coach (Wikipedia).",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "verified:rassie:stormers:senior:2009-2012",
    teamSlugCandidates: ["dhl-stormers-xxiii-pd9ry3j8", "stormers"],
    role: "other",
    careerType: "coach",
    startDate: "2009-07-01",
    endDate: "2012-01-31",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "Senior Professional Coach",
    teamDisplayName: "Stormers",
    notes:
      "Senior professional coach after the mid-2009 restructure (Wikipedia). Not the named Super Rugby head coach. Quit the region in January 2012.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:sa:tech-specialist:2011",
    teamSlugCandidates: ["south-africa"],
    role: "technical_specialist",
    careerType: "technical",
    startDate: "2011-04-01",
    endDate: "2011-10-31",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "Technical Specialist",
    notes: "Springboks technical specialist at the 2011 Rugby World Cup (Wikipedia). Peter de Villiers was head coach.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:sa:gm-hp:2012-2016",
    teamSlugCandidates: ["south-africa"],
    role: "other",
    careerType: "management",
    startDate: "2012-04-01",
    endDate: "2016-06-30",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "General Manager / High Performance",
    notes:
      "SARU General Manager: High Performance teams from April 2012 (Wikipedia). Assisted Heyneke Meyer in camps. Not Springboks head coach and not used for Test career-record matching.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:munster:dor:2016-2017",
    teamSlugCandidates: ["munster-m46vomjz", "munster"],
    role: "director_of_rugby",
    careerType: "coach",
    startDate: "2016-07-01",
    endDate: "2017-12-31",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: true,
    showOnOverview: true,
    overviewLabel: "Director of Rugby / Head Coach",
    teamDisplayName: "Munster",
    notes:
      "Munster Director of Rugby from 1 July 2016 (Munster Rugby). Took on head-coach duties after Anthony Foley’s death. Left in December 2017 for SARU. Pro12 Coach of the Season 2017; Pro12 runners-up 2017.",
    sourceUrl: "https://www.munsterrugby.ie/",
  },
  {
    importKey: "wikipedia:rassie:sa:dor:2017-2024",
    teamSlugCandidates: ["south-africa"],
    role: "director_of_rugby",
    careerType: "management",
    startDate: "2017-12-01",
    endDate: "2024-02-05",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "Director of Rugby",
    notes:
      "SARU Director of Rugby from December 2017. Overlaps the 2018–19 head-coach stint. After RWC 2019 he reverted to DoR while Jacques Nienaber was named head coach (2020–2023). Ended when SA Rugby named him head coach again on 6 February 2024.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:sa:hc:2018-2019",
    teamSlugCandidates: ["south-africa"],
    role: "head_coach",
    careerType: "coach",
    startDate: "2018-03-01",
    endDate: "2019-11-02",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: true,
    showOnOverview: true,
    overviewLabel: "Head Coach",
    notes:
      "First Springboks head-coach appointment, 1 March 2018, through the 2019 World Cup final (2 November 2019). Bokhist: 26 Tests, 2 June 2018–2 November 2019.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:barbarians:coach:2018",
    teamSlugCandidates: ["barbarians"],
    role: "head_coach",
    careerType: "coach",
    startDate: "2018-11-01",
    endDate: "2018-11-30",
    isCurrent: false,
    isPrimaryCoach: false,
    eligibleForCareerRecord: false,
    showOnOverview: true,
    overviewLabel: "Head Coach",
    teamDisplayName: "Barbarians",
    notes: "Barbarians invitation side, 2018 (Wikipedia coaching table). Not counted in Springboks career record.",
    sourceUrl: RASSIE_ERASMUS_WIKIPEDIA,
  },
  {
    importKey: "wikipedia:rassie:sa:hc:2024-",
    teamSlugCandidates: ["south-africa"],
    role: "head_coach",
    careerType: "coach",
    startDate: "2024-02-06",
    endDate: null,
    isCurrent: true,
    isPrimaryCoach: true,
    eligibleForCareerRecord: true,
    showOnOverview: true,
    overviewLabel: "Head Coach",
    notes:
      "Second Springboks head-coach stint. SA Rugby confirmed the appointment on 6 February 2024 (SABC Sport, AP, IOL, News24). Bokhist second stint from 22 June 2024.",
    sourceUrl: "https://www.sabcsport.com/rugby/news/rassie-erasmus-signs-on-until-2027-as-he-confirms-springbok-coaching-staff",
  },
];
