import type { ResolvedAnimationAvailability } from "./match-animation-availability";
import type { AnimationPitchEvent } from "./match-animation-events";
import type { MatchResultKind } from "./match-animation-fulltime";
import type { AnimationTeamStatsBundle } from "./match-animation-insight";
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
  venue: {
    name: string;
    city: string | null;
    country: string | null;
    capacity: number | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  /** Open-Meteo conditions at venue GEO (null when coords missing or fetch failed). */
  weather: {
    temperatureC: number | null;
    humidityPct: number | null;
    precipitationMm: number | null;
    windSpeedKmh: number | null;
    windDirectionDeg: number | null;
    windCompass: string | null;
    weatherCode?: number | null;
    icon?: import("./weather-condition").WeatherIconKind | null;
    conditionLabel?: string | null;
    observedAt: string | null;
    source: "forecast" | "archive";
  } | null;
  homeCoachName: string | null;
  awayCoachName: string | null;
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
  playerOfTheMatchImageUrl: string | null;
  playerOfTheMatchTeamSide: "home" | "away" | null;
  resultKind: MatchResultKind;
  availability: ResolvedAnimationAvailability;
  events: AnimationPitchEvent[];
  /** Attack / Defence / Kicking / Errors / Carries — from SDMS player stats when available. */
  playerStats: MatchAnimationPlayerStats | null;
  /** Collected team match stats for HT/FT insight cards (null sides when missing). */
  teamStats: AnimationTeamStatsBundle;
  settings: {
    publicAnimationEnabled: boolean;
    publicReplayEnabled: boolean;
    kickOffDelayed: boolean;
    countdownHeld: boolean;
    fullTimeConfirmed: boolean;
  } | null;
};
