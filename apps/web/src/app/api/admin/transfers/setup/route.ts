import { NextResponse } from "next/server";
import { listPlayersForPicker } from "@/lib/entity-admin-service";
import {
  listSeasonsForPicker,
  upsertSeason,
} from "@/lib/competition-admin-service";
import { listTeamPickerData } from "@/lib/team-picker-service";
import {
  DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
  PREMIERSHIP_TRANSFER_SOURCES,
  PREMIERSHIP_TRANSFERS_WIKI_URL,
} from "@/lib/premiership-transfer-constants";
import { resolvePremiershipSeason } from "@/lib/transfer-admin-service";
import { parseSeasonStartYear } from "@/lib/season-label-utils";
import { pickDefaultSeasonForPicker } from "@/lib/season-list-utils";
import { apiErrorResponse } from "@/lib/api-errors";

/** One round-trip for the transfers admin page — avoids parallel DB pool exhaustion. */
export async function GET() {
  try {
    const wikiYear = parseSeasonStartYear(DEFAULT_PREMIERSHIP_TRANSFER_SEASON) ?? 2026;
    const { competition } = await resolvePremiershipSeason(DEFAULT_PREMIERSHIP_TRANSFER_SEASON);

    // Force Wiki current window into competition_seasons (undepricate + activate)
    await upsertSeason({
      competitionId: competition.id,
      label: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
      isActive: true,
    });

    let seasonRows = await listSeasonsForPicker(competition.id);

    // If still missing (edge cases), upsert again and reload
    if (!seasonRows.some((row) => row.year === wikiYear)) {
      await upsertSeason({
        competitionId: competition.id,
        label: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
        isActive: true,
      });
      seasonRows = await listSeasonsForPicker(competition.id);
    }

    const defaultSeason =
      seasonRows.find((row) => row.year === wikiYear) ??
      seasonRows.find((row) => row.label === DEFAULT_PREMIERSHIP_TRANSFER_SEASON) ??
      pickDefaultSeasonForPicker(seasonRows);

    const teams = await listTeamPickerData();
    const players = await listPlayersForPicker();

    return NextResponse.json({
      teams,
      players,
      import: {
        defaultUrl: PREMIERSHIP_TRANSFERS_WIKI_URL,
        defaultSeasonLabel: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
        sources: PREMIERSHIP_TRANSFER_SOURCES,
        competitionId: competition.id,
        defaultSeasonId: defaultSeason?.id ?? null,
        seasons: seasonRows.map((row) => ({
          id: row.id,
          label: row.label,
          displayLabel: row.displayLabel,
          status: row.status,
          year: row.year,
        })),
      },
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load transfer setup");
  }
}
