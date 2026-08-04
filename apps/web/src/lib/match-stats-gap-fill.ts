/** Infer minutes for squad players omitted from SDMS player-stats feeds. */

export const FULL_MATCH_MINUTES = 80;

export function isStarterSquadRole(
  squadRole: string | null | undefined,
  jerseyNumber: number | null | undefined,
): boolean {
  const role = (squadRole ?? "").toLowerCase();
  if (role.includes("start") || role === "xv" || role === "15") return true;
  if (role.includes("bench") || role.includes("sub") || role.includes("replace")) return false;
  if (jerseyNumber != null && jerseyNumber >= 1 && jerseyNumber <= 15) return true;
  return false;
}

/**
 * Returns minutes to gap-fill, or null when the player should remain DNP
 * (unused bench with no substitution evidence).
 */
export function inferGapFillMinutes(input: {
  starter: boolean;
  subOnMinute?: number | null;
  subOffMinute?: number | null;
}): number | null {
  const { starter, subOnMinute, subOffMinute } = input;
  if (starter) {
    if (subOffMinute != null) {
      return Math.max(0, Math.min(FULL_MATCH_MINUTES, subOffMinute));
    }
    return FULL_MATCH_MINUTES;
  }
  if (subOnMinute != null) {
    const end = subOffMinute != null ? subOffMinute : FULL_MATCH_MINUTES;
    return Math.max(0, Math.min(FULL_MATCH_MINUTES, end - subOnMinute));
  }
  return null;
}
