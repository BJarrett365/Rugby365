/** Build the Wikipedia list URL for a Premiership transfer window label (e.g. `2026–27`). */
export function premiershipTransferWikiUrl(seasonLabel: string): string {
  const encoded = seasonLabel.replace(/\u2013/g, "%E2%80%93");
  return `https://en.wikipedia.org/wiki/List_of_${encoded}_Premiership_Rugby_transfers`;
}

/** Premiership transfer windows with Wikipedia lists, newest first. */
export const PREMIERSHIP_TRANSFER_SEASON_LABELS = [
  "2026–27",
  "2025–26",
  "2024–25",
  "2023–24",
  "2022–23",
  "2021–22",
  "2020–21",
  "2019–20",
  "2018–19",
  "2017–18",
  "2016–17",
  "2015–16",
  "2014–15",
  "2013–14",
] as const;

export type PremiershipTransferSeasonLabel = (typeof PREMIERSHIP_TRANSFER_SEASON_LABELS)[number];

export const PREMIERSHIP_TRANSFERS_WIKI_URL_2025_26 = premiershipTransferWikiUrl("2025–26");
export const PREMIERSHIP_TRANSFERS_WIKI_URL_2026_27 = premiershipTransferWikiUrl("2026–27");

/** Default audit season for Premiership transfer review. */
export const DEFAULT_PREMIERSHIP_TRANSFER_SEASON: PremiershipTransferSeasonLabel = "2026–27";

export const PREMIERSHIP_TRANSFERS_WIKI_URL = premiershipTransferWikiUrl(DEFAULT_PREMIERSHIP_TRANSFER_SEASON);

export const PREMIERSHIP_TRANSFER_SOURCES = PREMIERSHIP_TRANSFER_SEASON_LABELS.map((seasonLabel) => ({
  seasonLabel,
  url: premiershipTransferWikiUrl(seasonLabel),
  description: `Transfers before or during the ${seasonLabel} Premiership season`,
}));

/** Never auto-update player club on import — admin reviews conflicts in the audit UI. */
export const PREMIERSHIP_TRANSFER_CLUB_UPDATE_SEASONS = new Set<PremiershipTransferSeasonLabel>();
