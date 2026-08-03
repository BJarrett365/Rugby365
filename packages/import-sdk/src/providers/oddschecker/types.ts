/** Oddschecker rugby-union types (parse + preview). */

export type OddscheckerPageKind = "listing" | "market" | "unknown";

export type OddscheckerParsedUrl = {
  sourceUrl: string;
  kind: OddscheckerPageKind;
  /** e.g. south-africa, england, internationals */
  regionSlug: string | null;
  /** e.g. currie-cup, gallagher-premiership */
  competitionSlug: string | null;
  /** e.g. griquas-v-cheetahs */
  matchSlug: string | null;
  /** e.g. winner, handicap, total-points */
  marketSlug: string | null;
  homeNameHint: string | null;
  awayNameHint: string | null;
};

export type OddscheckerBookmakerPrice = {
  bookmakerCode: string;
  bookmakerName: string;
  fractional: string | null;
  decimal: number | null;
  /** Implied probability from decimal (0–1), null if no price */
  impliedProbability: number | null;
};

export type OddscheckerOutcome = {
  name: string;
  selectionId: string | null;
  bestDecimal: number | null;
  bestFractional: string | null;
  bestBookmakerCodes: string[];
  prices: OddscheckerBookmakerPrice[];
};

export type OddscheckerMarketPreview = {
  kind: "market";
  sourceUrl: string;
  marketSlug: string;
  marketLabel: string;
  competitionSlug: string | null;
  competitionName: string | null;
  regionSlug: string | null;
  matchSlug: string | null;
  homeName: string | null;
  awayName: string | null;
  title: string | null;
  outcomes: OddscheckerOutcome[];
  bookmakerCount: number;
  scrapedAt: string;
};

export type OddscheckerListingMatch = {
  sourceUrl: string;
  competitionName: string | null;
  homeName: string;
  awayName: string;
  kickoffLabel: string | null;
  dayLabel: string | null;
  bestHomeFractional: string | null;
  bestDrawFractional: string | null;
  bestAwayFractional: string | null;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
};

export type OddscheckerListingPreview = {
  kind: "listing";
  sourceUrl: string;
  title: string | null;
  matches: OddscheckerListingMatch[];
  scrapedAt: string;
};

export type OddscheckerPreview = OddscheckerMarketPreview | OddscheckerListingPreview;
