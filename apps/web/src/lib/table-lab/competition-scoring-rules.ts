import "server-only";
import { getCompetitionById } from "../competition-admin-service";
import {
  DOMESTIC_SCORING_DEFAULT,
  scoringRulesForCompetitionSlug,
} from "./competition-scoring-rules-catalog";
import type { RugbyScoringRules } from "./table-types";

export { scoringRulesForCompetitionSlug, DOMESTIC_SCORING_DEFAULT } from "./competition-scoring-rules-catalog";

export async function getScoringRulesForCompetition(
  competitionId?: string,
): Promise<RugbyScoringRules> {
  if (!competitionId) return DOMESTIC_SCORING_DEFAULT;
  const competition = await getCompetitionById(competitionId);
  if (!competition) return DOMESTIC_SCORING_DEFAULT;
  return scoringRulesForCompetitionSlug(competition.slug, competition.competitionType);
}
