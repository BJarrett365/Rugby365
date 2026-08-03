/**
 * Team rating v1 — transparent overall score for Compare Teams MVP.
 * Pure functions only.
 */

export const TEAM_RATING_MODEL = "team-rating-v1";

export type TeamRatingInputs = {
  /** Average player rating of top 23 (or full squad if smaller). */
  avgTop23Rating: number | null;
  /** Last-N win percentage 0–100. */
  formWinPct: number | null;
  /** Total squad market value GBP. */
  squadValueGbp: number | null;
  /** Count of rated players in squad. */
  ratedPlayerCount: number;
  /** Lifetime titles from competition_seasons.championTeamId. */
  trophyCount: number;
};

export type TeamRatingResult = {
  modelVersion: string;
  overall: number | null;
  components: {
    squadStrength: number | null;
    form: number | null;
    value: number | null;
    depth: number | null;
    trophies: number | null;
  };
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Map squad £ into ~35–99 band (log scale). */
export function valueToRatingScore(squadValueGbp: number | null): number | null {
  if (squadValueGbp == null || !Number.isFinite(squadValueGbp) || squadValueGbp <= 0) return null;
  // £500k → ~40, £10M → ~70, £50M → ~88, £100M+ → ~95
  const score = 28 + Math.log10(squadValueGbp) * 12;
  return round1(clamp(score, 35, 99));
}

export function depthToRatingScore(ratedPlayerCount: number): number {
  if (ratedPlayerCount <= 0) return 40;
  // 15 → ~55, 23 → ~70, 35 → ~85, 45+ → ~92
  return round1(clamp(40 + ratedPlayerCount * 1.15, 35, 99));
}

export function trophiesToRatingScore(trophyCount: number): number {
  if (trophyCount <= 0) return 45;
  return round1(clamp(50 + Math.sqrt(trophyCount) * 8, 45, 99));
}

export function computeTeamRating(input: TeamRatingInputs): TeamRatingResult {
  const squadStrength =
    input.avgTop23Rating != null && Number.isFinite(input.avgTop23Rating)
      ? round1(clamp(input.avgTop23Rating, 35, 99))
      : null;
  const form =
    input.formWinPct != null && Number.isFinite(input.formWinPct)
      ? round1(clamp(35 + (input.formWinPct / 100) * 64, 35, 99))
      : null;
  const value = valueToRatingScore(input.squadValueGbp);
  const depth = depthToRatingScore(input.ratedPlayerCount);
  const trophies = trophiesToRatingScore(input.trophyCount);

  const parts: Array<{ w: number; v: number }> = [];
  if (squadStrength != null) parts.push({ w: 0.45, v: squadStrength });
  if (form != null) parts.push({ w: 0.2, v: form });
  if (value != null) parts.push({ w: 0.15, v: value });
  parts.push({ w: 0.1, v: depth });
  parts.push({ w: 0.1, v: trophies });

  if (parts.length === 0) {
    return {
      modelVersion: TEAM_RATING_MODEL,
      overall: null,
      components: { squadStrength, form, value, depth, trophies },
    };
  }

  const weightSum = parts.reduce((s, p) => s + p.w, 0);
  const overall = round1(
    clamp(
      parts.reduce((s, p) => s + (p.v * p.w) / weightSum, 0),
      35,
      99,
    ),
  );

  return {
    modelVersion: TEAM_RATING_MODEL,
    overall,
    components: { squadStrength, form, value, depth, trophies },
  };
}
