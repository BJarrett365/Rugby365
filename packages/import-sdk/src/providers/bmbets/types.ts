/** BMbets rugby-union types (parse + preview). */

export type BmbetsPageKind = "sport_listing" | "competition" | "match" | "unknown";

export type BmbetsParsedUrl = {
  sourceUrl: string;
  kind: BmbetsPageKind;
  /** Always rugby-union when valid */
  sportSlug: "rugby-union";
  regionSlug: string | null;
  competitionSlug: string | null;
  matchSlug: string | null;
  /** Numeric BMbets event id when present in match URL */
  eventId: string | null;
  homeNameHint: string | null;
  awayNameHint: string | null;
};

export type BmbetsListingMatch = {
  sourceUrl: string;
  eventId: string | null;
  competitionName: string | null;
  regionSlug: string | null;
  competitionSlug: string | null;
  homeName: string;
  awayName: string;
  /** e.g. Friday, July 31, 2026 */
  dayLabel: string | null;
  /** e.g. 07:10 */
  kickoffLabel: string | null;
  /** Best-effort ISO kickoff from day + time (UTC assumed when TZ unknown) */
  kickoffAtIso: string | null;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
  bookmakerCount: number | null;
  /** True when URL/competition looks like Rugby League misfiled under Union */
  rejectedAsLeague: boolean;
  rejectReason: string | null;
};

export type BmbetsListingPreview = {
  kind: "listing";
  sourceUrl: string;
  title: string | null;
  competitionName: string | null;
  matches: BmbetsListingMatch[];
  /** Matches kept after League filter */
  unionMatches: BmbetsListingMatch[];
  rejectedLeagueMatches: BmbetsListingMatch[];
  scrapedAt: string;
};

export type BmbetsMatchPreview = {
  kind: "match";
  sourceUrl: string;
  eventId: string | null;
  competitionName: string | null;
  regionSlug: string | null;
  competitionSlug: string | null;
  homeName: string | null;
  awayName: string | null;
  kickoffLabel: string | null;
  kickoffAtIso: string | null;
  bestHomeDecimal: number | null;
  bestDrawDecimal: number | null;
  bestAwayDecimal: number | null;
  bookmakerCount: number | null;
  rejectedAsLeague: boolean;
  rejectReason: string | null;
  scrapedAt: string;
};

export type BmbetsPreview = BmbetsListingPreview | BmbetsMatchPreview;
