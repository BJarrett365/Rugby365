import { NextResponse } from "next/server";
import { fetchSdmsMatchDetail } from "@rugby365/import-sdk";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionBySlug, listSeasonsForPicker } from "@/lib/competition-admin-service";
import { parseSeasonStartYear, usesDomesticSeasonCatalog } from "@/lib/season-label-utils";
import { syncDomesticSeasonCatalog } from "@/lib/competition-admin-service";
import { findFixtureBySdmsMatchId } from "@/lib/fixture-admin-service";
import { syncFixtureLiveStateFromSdms } from "@/lib/fixture-live-score-sync";
import { calculateRugbyTable } from "@/lib/table-lab/table-calculation-service";
import { enrichNationsChampionshipResult } from "@/lib/table-lab/table-hemisphere-service";
import type { RugbyTableView } from "@/lib/table-lab/table-types";

function resolveSeasonId(
  seasons: Array<{ id: string; label: string; year: number; isActive: boolean }>,
  seasonLabel?: string | null,
) {
  if (!seasons.length) return null;
  if (!seasonLabel?.trim()) {
    return seasons.find((s) => s.isActive)?.id ?? seasons[0]!.id;
  }
  const requested = seasonLabel.trim();
  const year = parseSeasonStartYear(requested);
  const match =
    seasons.find((s) => s.label === requested) ??
    seasons.find((s) => s.label.replace(/–/g, "-") === requested.replace(/–/g, "-")) ??
    (year != null ? seasons.find((s) => s.year === year) : null);
  return match?.id ?? seasons.find((s) => s.isActive)?.id ?? seasons[0]!.id;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = searchParams.get("season");
    const syncMatchId = searchParams.get("syncMatchId")?.trim() || null;
    const viewParam = searchParams.get("view") ?? "overall";
    const tableView: RugbyTableView =
      viewParam === "home" ? "home" : viewParam === "away" ? "away" : "all";

    const competition = await getCompetitionBySlug(slug);
    if (!competition) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (usesDomesticSeasonCatalog(competition.competitionType)) {
      await syncDomesticSeasonCatalog(competition.id);
    }

    // Keep the viewed live match scoreline in CMS before standings calc.
    if (syncMatchId) {
      try {
        const [detail, fixture] = await Promise.all([
          fetchSdmsMatchDetail(syncMatchId),
          findFixtureBySdmsMatchId(syncMatchId),
        ]);
        if (detail && fixture) {
          await syncFixtureLiveStateFromSdms(fixture.id, detail);
        }
      } catch (error) {
        console.warn(
          `[live-table] score sync failed for ${syncMatchId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    const seasons = await listSeasonsForPicker(competition.id);
    const seasonId = resolveSeasonId(seasons, seasonLabel);
    if (!seasonId) {
      return NextResponse.json({
        competition: { id: competition.id, slug: competition.slug, name: competition.name },
        seasons,
        season: null,
        result: null,
      });
    }

    const season = seasons.find((s) => s.id === seasonId) ?? null;
    const result = await calculateRugbyTable("live_table", {
      competitionId: competition.id,
      seasonId,
      tableView,
      includeLiveMatches: true,
      includeScheduledMatches: false,
      showMovement: true,
    });
    const enriched = await enrichNationsChampionshipResult(result, competition.id);

    return NextResponse.json({
      competition: { id: competition.id, slug: competition.slug, name: competition.name },
      seasons,
      season,
      view: viewParam === "home" || viewParam === "away" ? viewParam : "overall",
      result: enriched,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load live table");
  }
}
