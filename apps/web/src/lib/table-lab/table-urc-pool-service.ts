import { getSeasonStandings } from "@/lib/competition-admin-service";
import {
  isUrcLineageSlug,
  urcSeasonUsesSplitTables,
  urcSplitGroupLabel,
  urcSplitTableKindForYear,
  urcStandingViewForSplit,
  type UrcSplitTableKind,
} from "@/lib/urc-lineage";
import { getRugbyTableDefinition } from "@/lib/table-lab/table-definition-service";
import { standingRowsToTableRows } from "@/lib/table-lab/table-pool-shared";
import type { RugbyTablePoolGroup, RugbyTableResult } from "@/lib/table-lab/table-types";

function poolGroupFromSynced(
  id: string,
  label: string,
  rows: Awaited<ReturnType<typeof getSeasonStandings>>,
): RugbyTablePoolGroup | null {
  if (!rows.length) return null;
  const mapped = standingRowsToTableRows(
    rows.map((row) => ({
      rank: row.rank,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      played: row.played,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      pointsDiff: row.pointsDiff,
      bonusPoints: row.bonusPoints,
      points: row.points,
      form: row.form,
    })),
  );
  return {
    id,
    label,
    rows: mapped,
    formSlots: 5,
  };
}

async function loadUrcSplitGroups(
  seasonId: string,
  kind: UrcSplitTableKind,
): Promise<RugbyTablePoolGroup[] | null> {
  const keys = ["A", "B"] as const;
  const groups = (
    await Promise.all(
      keys.map(async (key) => {
        const view = urcStandingViewForSplit(kind, key);
        const rows = await getSeasonStandings(seasonId, view);
        return poolGroupFromSynced(view, urcSplitGroupLabel(kind, key), rows);
      }),
    )
  ).filter((group): group is RugbyTablePoolGroup => Boolean(group));

  return groups.length >= 2 ? groups : null;
}

function splitNote(kind: UrcSplitTableKind, cached: boolean): string {
  if (kind === "conference") {
    return cached
      ? "Guinness PRO14 conference phase — tables shown as Conference A and Conference B (cached standings)."
      : "Guinness PRO14 conference phase — tables shown as Conference A and Conference B.";
  }
  return cached
    ? "Celtic League pool phase — tables shown as Pool A and Pool B (cached standings)."
    : "Celtic League pool phase — tables shown as Pool A and Pool B.";
}

/**
 * Fast path for Celtic League pool / Guinness PRO14 conference seasons —
 * synced split views only, no full fixture live-table calculation.
 */
export async function loadUrcPoolTableResult(input: {
  competitionId: string;
  competitionSlug: string;
  seasonId: string;
  seasonYear: number;
}): Promise<RugbyTableResult | null> {
  if (!isUrcLineageSlug(input.competitionSlug)) return null;
  const kind = urcSplitTableKindForYear(input.seasonYear);
  if (!kind) return null;

  const poolGroups = await loadUrcSplitGroups(input.seasonId, kind);
  if (!poolGroups) return null;

  const definition = getRugbyTableDefinition("live_table");
  if (!definition) return null;

  return {
    definition,
    available: true,
    confidence: "high",
    dataCoveragePct: 100,
    rows: [],
    poolGroups,
    warnings: [],
    fixtureCount: 0,
    evaluatedFixtureCount: 0,
    context: {
      competitionId: input.competitionId,
      seasonId: input.seasonId,
      tableView: "all",
      formMatchCount: 5,
      includeLiveMatches: false,
      showMovement: false,
    },
    formMatchCount: 5,
    showMovement: false,
    includeLiveMatches: false,
    liveMatchCount: 0,
    liveTableCalculationNote: splitNote(kind, true),
  };
}

/**
 * Celtic League 2001–02 used Pool A/B; Guinness PRO14 2017–20 used Conference A/B.
 * When wiki import stored matching standing views, present those as poolGroups.
 */
export async function enrichUrcPoolResult(
  result: RugbyTableResult,
  input: {
    competitionSlug: string;
    seasonId: string | null | undefined;
    seasonYear: number | null | undefined;
  },
): Promise<RugbyTableResult> {
  if (!isUrcLineageSlug(input.competitionSlug)) return result;
  if (input.seasonYear == null || !urcSeasonUsesSplitTables(input.seasonYear)) return result;
  if (!input.seasonId) return result;

  const kind = urcSplitTableKindForYear(input.seasonYear);
  if (!kind) return result;

  const poolGroups = await loadUrcSplitGroups(input.seasonId, kind);
  if (!poolGroups) return result;

  return {
    ...result,
    rows: [],
    poolGroups,
    liveTableCalculationNote: result.liveTableCalculationNote ?? splitNote(kind, false),
  };
}
