/**
 * Verified 2012 Rugby Championship participation for five Springboks who appear
 * in the competition rankings Top 50 with empty public profiles.
 *
 * Appearances are from Wikipedia match sheets for 2012 Rugby Championship
 * (only players who took the field). Cross-checked with bokhist.com for Taute.
 * Unused squad members are omitted.
 */
export const TRC_2012_SOURCE = "https://en.wikipedia.org/wiki/2012_Rugby_Championship";

export type Trc2012PlayerKey =
  | "ruan-pienaar"
  | "francois-hougaard"
  | "tendai-mtawarira"
  | "jaco-taute"
  | "andries-bekker";

export type Trc2012SeasonTotals = {
  appearances: number;
  starts: number;
  benchAppearances: number;
  tries: number;
  conversions: number;
  points: number;
  minutes: number;
  unusedSquadMatches: number;
};

export const TRC_2012_SPRINGBOK_RANKINGS_PLAYERS: Record<
  Trc2012PlayerKey,
  {
    canonicalSlug: string;
    duplicateSlugs: string[];
    name: string;
    fullName: string;
    wikipediaUrl: string;
    birthDate: string;
    birthPlace: string;
    heightCm: number;
    weightKg: number;
    positionName: string;
    positions: string[];
    school?: string;
    university?: string;
    clubName: string;
    careerStatus: "active" | "released" | "retired";
    caps: number;
    tries: number | null;
    points: number;
    intlYearsLabel: string;
    trc2012: Trc2012SeasonTotals;
  }
> = {
  "ruan-pienaar": {
    canonicalSlug: "ruan-pienaar-10574",
    duplicateSlugs: ["ruan-pienaar-g9n43r6l"],
    name: "Ruan Pienaar",
    fullName: "Ruan Pienaar",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Ruan_Pienaar",
    birthDate: "1984-03-10",
    birthPlace: "Bloemfontein, South Africa",
    heightCm: 187,
    weightKg: 92,
    positionName: "scrum-half",
    positions: ["scrum-half", "fly-half", "fullback"],
    school: "Grey College, Bloemfontein",
    clubName: "",
    careerStatus: "retired",
    caps: 88,
    tries: null,
    points: 135,
    intlYearsLabel: "2006–2015",
    trc2012: {
      appearances: 6,
      starts: 4,
      benchAppearances: 2,
      tries: 0,
      conversions: 3,
      points: 6,
      minutes: 363,
      unusedSquadMatches: 0,
    },
  },
  "francois-hougaard": {
    canonicalSlug: "francois-hougaard-x91ng0jw__legacy__2f59ab8f",
    duplicateSlugs: ["francois-hougaard", "francois-hougaard-x91ng0jw"],
    name: "Francois Hougaard",
    fullName: "Francois Hougaard",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Francois_Hougaard",
    birthDate: "1988-04-06",
    birthPlace: "Paarl, South Africa",
    heightCm: 181,
    weightKg: 93,
    positionName: "scrum-half",
    positions: ["scrum-half", "wing"],
    school: "Paul Roos Gymnasium",
    clubName: "",
    careerStatus: "released",
    caps: 46,
    tries: 5,
    points: 25,
    intlYearsLabel: "2009–2017",
    trc2012: {
      appearances: 6,
      starts: 6,
      benchAppearances: 0,
      tries: 0,
      conversions: 0,
      points: 0,
      minutes: 437,
      unusedSquadMatches: 0,
    },
  },
  "tendai-mtawarira": {
    canonicalSlug: "tendai-mtawarira-10521",
    duplicateSlugs: ["tendai-mtawarira-10521__legacy__dfbea838"],
    name: "Tendai Mtawarira",
    fullName: "Tendai Mtawarira",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tendai_Mtawarira",
    birthDate: "1985-08-01",
    birthPlace: "Harare, Zimbabwe",
    heightCm: 183,
    weightKg: 116,
    positionName: "prop",
    positions: ["prop"],
    school: "Churchill School; Peterhouse Boys' School",
    clubName: "",
    careerStatus: "retired",
    caps: 117,
    tries: 2,
    points: 10,
    intlYearsLabel: "2008–2019",
    trc2012: {
      appearances: 6,
      starts: 6,
      benchAppearances: 0,
      tries: 0,
      conversions: 0,
      points: 0,
      minutes: 441,
      unusedSquadMatches: 0,
    },
  },
  "jaco-taute": {
    canonicalSlug: "jaco-taute",
    duplicateSlugs: ["jaco-taute-retired", "jaco-taute-retired__legacy__7a6e3f99"],
    name: "Jaco Taute",
    fullName: "Jacob Johannes Taute",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Jaco_Taute",
    birthDate: "1991-03-21",
    birthPlace: "Springs, South Africa",
    heightCm: 191,
    weightKg: 108,
    positionName: "centre",
    positions: ["centre", "fullback"],
    school: "Monument High School",
    university: "University of Johannesburg",
    clubName: "",
    careerStatus: "retired",
    caps: 3,
    tries: 0,
    points: 0,
    intlYearsLabel: "2012",
    trc2012: {
      appearances: 2,
      starts: 2,
      benchAppearances: 0,
      tries: 0,
      conversions: 0,
      points: 0,
      minutes: 151,
      unusedSquadMatches: 0,
    },
  },
  "andries-bekker": {
    canonicalSlug: "andries-bekker",
    duplicateSlugs: [],
    name: "Andries Bekker",
    fullName: "Andries Bekker",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Andries_Bekker",
    birthDate: "1983-12-05",
    birthPlace: "Goodwood, Cape Town, South Africa",
    heightCm: 208,
    weightKg: 121,
    positionName: "lock",
    positions: ["lock"],
    school: "Paul Roos Gymnasium",
    university: "University of South Africa",
    clubName: "",
    careerStatus: "retired",
    caps: 29,
    tries: 1,
    points: 5,
    intlYearsLabel: "2008–2012",
    trc2012: {
      appearances: 5,
      starts: 4,
      benchAppearances: 1,
      tries: 0,
      conversions: 0,
      points: 0,
      minutes: 296,
      unusedSquadMatches: 1,
    },
  },
};

export function trc2012RankingsPlayerKeys(): Trc2012PlayerKey[] {
  return Object.keys(TRC_2012_SPRINGBOK_RANKINGS_PLAYERS) as Trc2012PlayerKey[];
}
