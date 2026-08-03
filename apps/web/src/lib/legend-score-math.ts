/**
 * Planet Rugby Legend Score v1 — pure math (0–100 components → overall).
 * Unique IP: compare legends across eras with a transparent weighted model.
 */

export const LEGEND_SCORE_MODEL = "legend-score-v1";

export type LegendScoreHallStatus =
  | "none"
  | "nominee"
  | "inductee"
  | "rugby_icon"
  | "hall_of_fame";

export type LegendScoreInputs = {
  /** Career ability ~35–99 */
  careerRating: number | null;
  peakRating: number | null;
  reputation: number | null;
  legendLevel: string | null;
  collectionSlugs: string[];
  titleCount: number;
  internationalApps: number | null;
  clubStintCount: number | null;
  /** Optional CMS overrides applied after model */
  overrides?: Partial<LegendScoreComponents> & { overallScore?: number | null };
};

export type LegendScoreComponents = {
  careerRating: number;
  peakRating: number;
  legacyRating: number;
  influenceRating: number;
  leadershipRating: number;
  trophyScore: number;
  internationalScore: number;
  clubScore: number;
};

export type LegendScoreResult = {
  modelVersion: string;
  overallScore: number;
  hallOfFameStatus: LegendScoreHallStatus;
  components: LegendScoreComponents;
  weights: Record<keyof LegendScoreComponents, number>;
  notes: string[];
};

const WEIGHTS: Record<keyof LegendScoreComponents, number> = {
  careerRating: 0.18,
  peakRating: 0.14,
  legacyRating: 0.16,
  influenceRating: 0.14,
  leadershipRating: 0.1,
  trophyScore: 0.1,
  internationalScore: 0.1,
  clubScore: 0.08,
};

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function levelBaseline(level: string | null): number {
  const l = (level ?? "").toLowerCase();
  if (l.includes("hall")) return 92;
  if (l.includes("icon")) return 88;
  if (l.includes("international")) return 84;
  if (l.includes("competition")) return 80;
  if (l.includes("club")) return 76;
  return 70;
}

function hallStatus(level: string | null, collections: string[]): LegendScoreHallStatus {
  const l = (level ?? "").toLowerCase();
  if (l.includes("hall")) return "hall_of_fame";
  if (l.includes("icon")) return "rugby_icon";
  if (collections.includes("greatest-players")) return "inductee";
  if (collections.length > 0) return "nominee";
  return "none";
}

function scaleRating(raw: number | null, fallback: number): number {
  if (raw == null || !Number.isFinite(raw)) return fallback;
  // Ratings are already ~35–99; treat as 0–100 after mild stretch
  return clampScore(raw);
}

/**
 * Compute Legend Score from available career + editorial signals.
 */
export function computeLegendScore(input: LegendScoreInputs): LegendScoreResult {
  const notes: string[] = [];
  const baseline = levelBaseline(input.legendLevel);
  const collections = input.collectionSlugs ?? [];

  const career = scaleRating(input.careerRating, baseline);
  const peak = scaleRating(
    input.peakRating ?? input.careerRating,
    Math.min(99, baseline + 4),
  );
  const rep = scaleRating(input.reputation, baseline - 2);

  let legacy = baseline;
  if (collections.includes("greatest-players")) legacy += 8;
  if (collections.includes("greatest-all-blacks") || collections.includes("greatest-springboks")) {
    legacy += 3;
  }
  if (collections.includes("greatest-lions")) legacy += 2;
  legacy = clampScore(legacy);

  let influence = clampScore(rep * 0.55 + legacy * 0.45);
  if (collections.includes("greatest-players")) {
    influence = clampScore(influence + 4);
    notes.push("GOAT collection boost on influence");
  }

  let leadership = clampScore(baseline - 6);
  if (collections.includes("greatest-captains")) {
    leadership = clampScore(Math.max(leadership, 88));
    notes.push("Captain collection boost on leadership");
  } else if (input.reputation != null) {
    leadership = clampScore(rep * 0.4 + baseline * 0.35);
  }

  const trophyScore = clampScore(40 + Math.min(50, (input.titleCount ?? 0) * 8));
  const intlApps = input.internationalApps ?? 0;
  const internationalScore = clampScore(
    intlApps > 0 ? 45 + Math.min(50, Math.log10(intlApps + 1) * 28) : baseline - 8,
  );
  const clubStints = input.clubStintCount ?? 0;
  const clubScore = clampScore(clubStints > 0 ? 50 + Math.min(40, clubStints * 8) : baseline - 10);

  let components: LegendScoreComponents = {
    careerRating: career,
    peakRating: Math.max(career, peak),
    legacyRating: legacy,
    influenceRating: influence,
    leadershipRating: leadership,
    trophyScore,
    internationalScore,
    clubScore,
  };

  const overrides = input.overrides ?? {};
  for (const key of Object.keys(WEIGHTS) as Array<keyof LegendScoreComponents>) {
    const ov = overrides[key];
    if (typeof ov === "number" && Number.isFinite(ov)) {
      components = { ...components, [key]: clampScore(ov) };
      notes.push(`Override applied: ${key}`);
    }
  }

  let overall = 0;
  for (const key of Object.keys(WEIGHTS) as Array<keyof LegendScoreComponents>) {
    overall += components[key] * WEIGHTS[key];
  }
  overall = clampScore(overall);
  if (typeof overrides.overallScore === "number" && Number.isFinite(overrides.overallScore)) {
    overall = clampScore(overrides.overallScore);
    notes.push("Override applied: overallScore");
  }

  return {
    modelVersion: LEGEND_SCORE_MODEL,
    overallScore: overall,
    hallOfFameStatus: hallStatus(input.legendLevel, collections),
    components,
    weights: { ...WEIGHTS },
    notes,
  };
}
