import {
  DEFAULT_PREMIERSHIP_SCORING_RULES,
  type RugbyScoringRules,
} from "./table-types";
import { isRugbyChampionshipLineageSlug } from "../rugby-championship-lineage";

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
  // World Rugby pool stage: 4 win / 2 draw / try bonus (4+) / losing bonus (≤7).
  "rugby-world-cup": {
    winPoints: 4,
    drawPoints: 2,
    lossPoints: 0,
    tryBonusThreshold: 4,
    tryBonusPoints: 1,
    losingBonusMargin: 7,
    losingBonusPoints: 1,
  },
};

/**
 * The Rugby Championship / Tri Nations league points.
 * 2012–2015: 4-try bonus. From 2016: bonus for finishing 3+ tries ahead (SANZAAR).
 * Losing bonus (≤7) applies throughout.
 */
export function rugbyChampionshipScoringRules(year?: number | null): RugbyScoringRules {
  const base: RugbyScoringRules = {
    winPoints: 4,
    drawPoints: 2,
    lossPoints: 0,
    tryBonusThreshold: 4,
    tryBonusPoints: 1,
    losingBonusMargin: 7,
    losingBonusPoints: 1,
  };
  if (year != null && year >= 2016) {
    return { ...base, tryBonusLead: 3 };
  }
  return { ...base, tryBonusLead: null };
}

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
  seasonYear?: number | null,
): RugbyScoringRules {
  const key = (slug ?? "").trim().toLowerCase();
  if (isRugbyChampionshipLineageSlug(key)) {
    return rugbyChampionshipScoringRules(seasonYear);
  }
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
