import "server-only";
import { getCompetitionById } from "../competition-admin-service";
import {
  isRugbyWorldCupSlug,
  poolStageFormSlots,
  resolveRugbyWorldCupYear,
  rugbyWorldCupPoolForTeam,
  rugbyWorldCupPoolsForYear,
} from "../rugby-world-cup-pools";
import { splitRowsIntoWorldCupPools } from "./table-pool-shared";
import type { RugbyTableResult } from "./table-types";

export { splitRowsIntoWorldCupPools } from "./table-pool-shared";

export async function enrichWorldCupPoolResult(
  result: RugbyTableResult,
  options: {
    competitionId?: string;
    seasonYear?: number | null;
    seasonLabel?: string | null;
  },
): Promise<RugbyTableResult> {
  if (!options.competitionId) return result;

  const competition = await getCompetitionById(options.competitionId);
  if (!competition || !isRugbyWorldCupSlug(competition.slug)) return result;

  const year = resolveRugbyWorldCupYear({
    seasonYear: options.seasonYear,
    seasonLabel: options.seasonLabel,
  });
  const pools = rugbyWorldCupPoolsForYear(year);
  if (!pools.length) return result;

  const poolGroups = splitRowsIntoWorldCupPools(result.rows, pools);
  const unmatched = result.rows.filter((row) => !rugbyWorldCupPoolForTeam(year, row.teamName));
  const warnings = [...result.warnings];
  if (unmatched.length > 0) {
    warnings.push(
      `Teams not in the ${year} World Cup pool draw were excluded from pool tables: ${unmatched
        .map((row) => row.teamName)
        .join(", ")}.`,
    );
  }

  const formSlots = poolGroups[0]?.formSlots ?? poolStageFormSlots(pools[0]!.teams.length);

  return {
    ...result,
    competition: { slug: competition.slug, name: competition.name },
    poolGroups,
    formMatchCount: formSlots,
    warnings,
  };
}
