import {
  isNationsChampionshipSlug,
  nationsChampionshipHemisphereForTeam,
} from "../nations-championship-hemisphere";
import { getCompetitionById } from "../competition-admin-service";
import type { RugbyTableResult } from "./table-types";
import { splitRowsByHemisphere } from "./table-hemisphere-shared";

export { splitRowsByHemisphere } from "./table-hemisphere-shared";

export async function enrichNationsChampionshipResult(
  result: RugbyTableResult,
  competitionId?: string,
): Promise<RugbyTableResult> {
  if (result.definition.id === "hemisphere_table") return result;
  if (!competitionId || result.rows.length === 0) return result;

  const competition = await getCompetitionById(competitionId);
  if (!competition || !isNationsChampionshipSlug(competition.slug)) return result;

  const hemisphereGroups = splitRowsByHemisphere(result.rows, result.definition);
  if (hemisphereGroups.length === 0) return result;

  const unmatched = result.rows
    .filter((row) => !nationsChampionshipHemisphereForTeam(row.teamName))
    .map((row) => row.teamName);

  const warnings = [...result.warnings];
  if (unmatched.length > 0) {
    warnings.push(
      `Teams outside the Nations Championship pools were excluded from hemisphere tables: ${unmatched.join(", ")}.`,
    );
  }

  return {
    ...result,
    competition: { slug: competition.slug, name: competition.name },
    hemisphereGroups,
    warnings,
  };
}
