/**
 * Pre-game checklist: stadium, weather coords, referee, home/away coaches.
 * Used by Matches CMS ops filters and the dedicated pre-game board.
 */

export type PregameCheckCode =
  | "stadium"
  | "weather"
  | "referee"
  | "home_coach"
  | "away_coach";

export type PregameCheckItem = {
  code: PregameCheckCode;
  label: string;
  ok: boolean;
  detail: string;
};

export type PregameReadinessFlags = {
  venueId: string | null;
  venueHasCoords: boolean;
  refereeId: string | null;
  homeCoachId: string | null;
  awayCoachId: string | null;
};

export type PregameReadinessResult = {
  ready: boolean;
  readyCount: number;
  totalCount: number;
  missing: PregameCheckCode[];
  checks: PregameCheckItem[];
};

export function evaluatePregameReadiness(
  flags: PregameReadinessFlags,
): PregameReadinessResult {
  const checks: PregameCheckItem[] = [
    {
      code: "stadium",
      label: "Stadium",
      ok: Boolean(flags.venueId),
      detail: flags.venueId ? "Venue linked" : "No stadium assigned",
    },
    {
      code: "weather",
      label: "Weather",
      ok: Boolean(flags.venueId) && flags.venueHasCoords,
      detail: !flags.venueId
        ? "Needs stadium first"
        : flags.venueHasCoords
          ? "Venue has coordinates"
          : "Stadium missing lat/lng (weather unavailable)",
    },
    {
      code: "referee",
      label: "Referee",
      ok: Boolean(flags.refereeId),
      detail: flags.refereeId ? "Referee linked" : "No referee assigned",
    },
    {
      code: "home_coach",
      label: "Home coach",
      ok: Boolean(flags.homeCoachId),
      detail: flags.homeCoachId ? "Home coach linked" : "No home coach assigned",
    },
    {
      code: "away_coach",
      label: "Away coach",
      ok: Boolean(flags.awayCoachId),
      detail: flags.awayCoachId ? "Away coach linked" : "No away coach assigned",
    },
  ];

  const missing = checks.filter((c) => !c.ok).map((c) => c.code);
  const readyCount = checks.filter((c) => c.ok).length;
  return {
    ready: missing.length === 0,
    readyCount,
    totalCount: checks.length,
    missing,
    checks,
  };
}

export function isPregameStatus(status: string): boolean {
  return status === "scheduled" || status === "postponed";
}
