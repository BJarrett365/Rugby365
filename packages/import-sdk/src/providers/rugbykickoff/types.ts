export type RugbyKickoffProvider = {
  name: string;
  url: string | null;
  imageAlt: string | null;
};

export type RugbyKickoffListing = {
  /** Game path slug e.g. australia_england_2026-11-08 */
  externalId: string;
  sourceUrl: string;
  /** ISO date YYYY-MM-DD from the game URL */
  kickoffDate: string;
  /** Local wall-clock HH:mm from the listing (UK default) */
  kickoffLocalTime: string | null;
  homeName: string;
  awayName: string;
  competition: string;
  venue: string | null;
  providers: RugbyKickoffProvider[];
};

export type RugbyKickoffListingPreview = {
  kind: "listing";
  sourceUrl: string;
  country: string;
  listings: RugbyKickoffListing[];
};
