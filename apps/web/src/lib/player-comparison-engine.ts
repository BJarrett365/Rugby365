/**
 * Player comparison metrics for Profile V2 card.
 * Uses the same intelligence dimensions as Performance Radar — missing stays null.
 */

export type PlayerComparisonMetricKey =
  | "kicking"
  | "playmaking"
  | "gameManagement"
  | "attack"
  | "defence"
  | "physical"
  | "overall";

export type PlayerComparisonScores = Partial<
  Record<PlayerComparisonMetricKey, number | null>
>;

export type PlayerComparisonMetricRow = {
  key: PlayerComparisonMetricKey;
  label: string;
  left: number | null;
  right: number | null;
};

export const PLAYER_COMPARISON_METRIC_ORDER: Array<{
  key: PlayerComparisonMetricKey;
  label: string;
}> = [
  { key: "kicking", label: "Kicking" },
  { key: "playmaking", label: "Playmaking" },
  { key: "gameManagement", label: "Game Management" },
  { key: "attack", label: "Attack" },
  { key: "defence", label: "Defence" },
  { key: "physical", label: "Physical" },
  { key: "overall", label: "Overall" },
];

function cleanScore(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Build side-by-side rows. Missing ≠ 0.
 */
export function buildPlayerComparisonMetrics(
  left: PlayerComparisonScores,
  right: PlayerComparisonScores,
): PlayerComparisonMetricRow[] {
  return PLAYER_COMPARISON_METRIC_ORDER.map((m) => ({
    key: m.key,
    label: m.label,
    left: cleanScore(left[m.key]),
    right: cleanScore(right[m.key]),
  }));
}

export function comparisonPeerSubtitle(positionPeerLabel: string | null | undefined): string {
  const label = (positionPeerLabel ?? "Peers").trim();
  if (!label) return "VS TOP PEERS";
  const upper = label.toUpperCase();
  if (upper.endsWith("S") && !upper.endsWith("SS")) return `VS TOP ${upper}`;
  // Fly-Half → FLY-HALVES (before generic HALF → HALFS)
  if (upper.endsWith("-HALF") || upper.endsWith(" HALF")) {
    return `VS TOP ${upper.replace(/HALF$/, "HALVES")}`;
  }
  if (upper.endsWith("HALF")) return `VS TOP ${upper}S`;
  return `VS TOP ${upper}S`;
}

/** Relevance score for default peer — higher is better. Pure helper. */
export function scoreComparisonPeerRelevance(input: {
  samePosition: boolean;
  rating: number | null;
  subjectRating: number | null;
  sameCompetition: boolean;
  sameNation: boolean;
}): number {
  if (!input.samePosition) return -1000;
  let score = 0;
  if (input.rating != null) score += input.rating;
  if (
    input.rating != null &&
    input.subjectRating != null &&
    Number.isFinite(input.rating) &&
    Number.isFinite(input.subjectRating)
  ) {
    // Prefer peers near the subject's level (within ~15 pts still strong).
    score += Math.max(0, 20 - Math.abs(input.rating - input.subjectRating));
  }
  if (input.sameCompetition) score += 8;
  if (input.sameNation) score += 3;
  return score;
}

export function pickDefaultComparisonPeer<T extends { id: string }>(
  candidates: Array<T & Parameters<typeof scoreComparisonPeerRelevance>[0]>,
): T | null {
  if (!candidates.length) return null;
  const ranked = [...candidates].sort(
    (a, b) => scoreComparisonPeerRelevance(b) - scoreComparisonPeerRelevance(a),
  );
  return ranked[0] ?? null;
}
