import type { ResolvedAnimationAvailability } from "./match-animation-availability";
import type { AnimationPitchEvent } from "./match-animation-events";
import type { MatchResultKind } from "./match-animation-fulltime";
import type { MatchAnimationPlayerStats } from "./match-animation-player-stats";

export type MatchAnimationPublicPayload = {
  matchId: string;
  cmsFixtureId: string | null;
  serverNow: string;
  timeZone: string;
  competitionName: string;
  competitionLogoUrl: string | null;
  home: {
    name: string;
    shortName: string;
    imageUrl: string | null;
    colour: string;
  };
  away: {
    name: string;
    shortName: string;
    imageUrl: string | null;
    colour: string;
  };
  venueName: string | null;
  scheduledKickoffAt: string | null;
  statusLabel: string;
  refereeName: string | null;
  /** Official final / current score from CMS fixture when available. */
  homeScore: number;
  awayScore: number;
  scoreSource: "cms" | "fallback";
  /** Live match clock from CMS (may be stale — client also derives from events). */
  matchMinute: number;
  matchSecond: number;
  period: string | null;
  halfTimeHome: number | null;
  halfTimeAway: number | null;
  round: string | null;
  attendance: number | null;
  matchDateLabel: string | null;
  playerOfTheMatch: string | null;
  resultKind: MatchResultKind;
  availability: ResolvedAnimationAvailability;
  events: AnimationPitchEvent[];
  /** Attack / Defence / Kicking / Errors / Carries — from SDMS player stats when available. */
  playerStats: MatchAnimationPlayerStats | null;
  settings: {
    publicAnimationEnabled: boolean;
    publicReplayEnabled: boolean;
    kickOffDelayed: boolean;
    countdownHeld: boolean;
    fullTimeConfirmed: boolean;
  } | null;
};
