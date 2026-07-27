import {
  DEFAULT_PREMIERSHIP_SCORING_RULES,
  type RugbyScoringRules,
} from "./table-types";

/** Per-competition league scoring — not a single global Premiership default. */
/** Domestic SA Currie Cup — same bonus structure as Premiership / URC. */
const CURRIE_CUP_SCORING_RULES: RugbyScoringRules = DEFAULT_PREMIERSHIP_SCORING_RULES;

const SCORING_BY_SLUG: Record<string, RugbyScoringRules> = {
  premiership: DEFAULT_PREMIERSHIP_SCORING_RULES,
  championship: DEFAULT_PREMIERSHIP_SCORING_RULES,
  "currie-cup": CURRIE_CUP_SCORING_RULES,
  "top-14": {
    winPoints: 4,
    drawPoints: 2,
    lossPoints: 0,
    tryBonusThreshold: 3,
    tryBonusPoints: 1,
    losingBonusMargin: 7,
    losingBonusPoints: 1,
  },
  "united-rugby-championship": DEFAULT_PREMIERSHIP_SCORING_RULES,
  "rugby-championship": {
    winPoints: 4,
    drawPoints: 2,
    lossPoints: 0,
    tryBonusThreshold: 3,
    tryBonusPoints: 1,
    losingBonusMargin: 7,
    losingBonusPoints: 0,
  },
  "six-nations": {
    winPoints: 4,
    drawPoints: 2,
    lossPoints: 0,
    tryBonusThreshold: 4,
    tryBonusPoints: 1,
    losingBonusMargin: 7,
    losingBonusPoints: 0,
  },
  "nations-championship": {
    winPoints: 4,
    drawPoints: 2,
    lossPoints: 0,
    tryBonusThreshold: 3,
    tryBonusPoints: 1,
    losingBonusMargin: 7,
    losingBonusPoints: 1,
  },
};

export const DOMESTIC_SCORING_DEFAULT = DEFAULT_PREMIERSHIP_SCORING_RULES;

const INTERNATIONAL_DEFAULT: RugbyScoringRules = {
  winPoints: 4,
  drawPoints: 2,
  lossPoints: 0,
  tryBonusThreshold: 4,
  tryBonusPoints: 0,
  losingBonusMargin: 7,
  losingBonusPoints: 0,
};

export function scoringRulesForCompetitionSlug(
  slug: string | null | undefined,
  competitionType?: string | null,
): RugbyScoringRules {
  const key = (slug ?? "").trim().toLowerCase();
  if (key && SCORING_BY_SLUG[key]) {
    return SCORING_BY_SLUG[key]!;
  }
  // Provider slugs often append ids (currie-cup-pd9ro98v).
  for (const known of Object.keys(SCORING_BY_SLUG)) {
    if (key === known || key.startsWith(`${known}-`)) {
      return SCORING_BY_SLUG[known]!;
    }
  }
  if (competitionType === "international" || competitionType === "world_cup") {
    return INTERNATIONAL_DEFAULT;
  }
  return DOMESTIC_SCORING_DEFAULT;
}
