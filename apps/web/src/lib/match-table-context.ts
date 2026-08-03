export type MatchTableContext = {
  competitionId: string;
  seasonId: string | null;
  competitionSlug: string | null;
  competitionName: string;
  /** CMS fixture id — used to keep Live Table scores in sync with this match. */
  fixtureId?: string | null;
  /** SDMS match id — polled while the match is live. */
  externalMatchId?: string | null;
  /** When true, Live Table panel refreshes periodically. */
  isLive?: boolean;
};
