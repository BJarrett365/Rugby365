/**
 * Phase A Betting Intelligence helpers — pure geometry / squad quality math.
 * Wired by Match Centre + fixtures board loaders.
 */

export type SquadRatingRow = {
  careerRating: number | null;
  squadRole?: string | null;
  jerseyNumber?: number | null;
};

/** Earth-surface km between two WGS84 points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Travel disadvantage 0–1. Short hops ≈ 0; long-haul tours approach 1.
 */
export function travelDisadvantageFromKm(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km) || km < 0) return 0;
  if (km < 200) return 0;
  if (km >= 8000) return 1;
  return (km - 200) / (8000 - 200);
}

/**
 * Lineup-weighted career rating: starters (1–15 / starter role) count full,
 * bench at 0.55 so named XV quality dominates.
 */
export function weightedSquadRating(rows: SquadRatingRow[]): number | null {
  let sum = 0;
  let wSum = 0;
  for (const r of rows) {
    if (r.careerRating == null || !Number.isFinite(r.careerRating)) continue;
    const jersey = r.jerseyNumber;
    const starter =
      r.squadRole === "starter" ||
      (jersey != null && jersey >= 1 && jersey <= 15);
    const w = starter ? 1 : 0.55;
    sum += r.careerRating * w;
    wSum += w;
  }
  if (wSum <= 0) return null;
  return sum / wSum;
}

/** Share of squad rows with an international team link (0–1). */
export function internationalQualityShare(
  rows: Array<{ hasInternationalLink: boolean }>,
): number | null {
  if (!rows.length) return null;
  const n = rows.filter((r) => r.hasInternationalLink).length;
  return n / rows.length;
}

/** Share of squad who appeared in an international fixture in the fatigue window. */
export function fatigueShare(
  squadPlayerIds: string[],
  fatiguedPlayerIds: Set<string>,
): number | null {
  if (!squadPlayerIds.length) return null;
  const n = squadPlayerIds.filter((id) => fatiguedPlayerIds.has(id)).length;
  return n / squadPlayerIds.length;
}

/**
 * Climate-fit side from kickoff temperature and team home latitudes.
 * Hot (≥28°C) favours lower |lat|; cold (≤8°C) favours higher |lat|.
 */
export function weatherFitSide(input: {
  tempC: number | null;
  homeClimateLat: number | null;
  awayClimateLat: number | null;
}): "home" | "away" | "neutral" | null {
  const { tempC, homeClimateLat, awayClimateLat } = input;
  if (tempC == null || homeClimateLat == null || awayClimateLat == null) return null;
  const homeAbs = Math.abs(homeClimateLat);
  const awayAbs = Math.abs(awayClimateLat);
  if (Math.abs(homeAbs - awayAbs) < 8) return "neutral";

  if (tempC >= 28) {
    // Heat: lower absolute latitude preferred.
    return homeAbs < awayAbs ? "home" : "away";
  }
  if (tempC <= 8) {
    // Cold: higher absolute latitude preferred.
    return homeAbs > awayAbs ? "home" : "away";
  }
  return null;
}

export function formatTravelKm(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "—";
  if (km < 100) return `${Math.round(km)} km`;
  return `${Math.round(km / 10) * 10} km`;
}
