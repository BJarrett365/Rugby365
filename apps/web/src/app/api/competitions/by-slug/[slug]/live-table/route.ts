import { NextResponse } from "next/server";
import { fetchSdmsMatchDetail } from "@rugby365/import-sdk";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionBySlug, listSeasonsForPicker } from "@/lib/competition-admin-service";
import { parseSeasonStartYear, usesDomesticSeasonCatalog, currentDomesticSeasonStartYear } from "@/lib/season-label-utils";
import { syncDomesticSeasonCatalog } from "@/lib/competition-admin-service";
import { findFixtureBySdmsMatchId } from "@/lib/fixture-admin-service";
import { syncFixtureLiveStateFromSdms } from "@/lib/fixture-live-score-sync";
import { calculateRugbyTable } from "@/lib/table-lab/table-calculation-service";
import { enrichNationsChampionshipResult } from "@/lib/table-lab/table-hemisphere-service";
import { enrichWorldCupPoolResult } from "@/lib/table-lab/table-pool-service";
import {
  enrichUrcPoolResult,
  loadUrcPoolTableResult,
} from "@/lib/table-lab/table-urc-pool-service";
import type { RugbyTableView } from "@/lib/table-lab/table-types";
import { urcCompetitionDisplayNameForYear } from "@/lib/urc-lineage";
import { cachedPublic, PUBLIC_CACHE_TTL } from "@/lib/public-data-cache";

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

function cacheControlForSeason(isActive: boolean | undefined): string {
  const ttl = isActive ? PUBLIC_CACHE_TTL.competitionTableLive : PUBLIC_CACHE_TTL.competitionTableHistoric;
  return `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`;
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

    // Bypass cache when syncing a live match score into the table.
    const buildPayload = async () => {
      const competition = await getCompetitionBySlug(slug);
      if (!competition) return null;

      if (usesDomesticSeasonCatalog(competition.competitionType)) {
        await syncDomesticSeasonCatalog(competition.id);
      }

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
        return {
          competition: { id: competition.id, slug: competition.slug, name: competition.name },
          seasons,
          season: null,
          view: viewParam === "home" || viewParam === "away" ? viewParam : "overall",
          result: null,
        };
      }

      const season = seasons.find((s) => s.id === seasonId) ?? null;
      const displayName =
        season?.year != null &&
        (competition.slug === "united-rugby-championship" ||
          competition.slug === "celtic-league" ||
          competition.slug === "pro12" ||
          competition.slug === "pro14")
          ? urcCompetitionDisplayNameForYear(season.year)
          : competition.name;

      if (season?.year != null) {
        const poolFast = await loadUrcPoolTableResult({
          competitionId: competition.id,
          competitionSlug: competition.slug,
          seasonId,
          seasonYear: season.year,
        });
        if (poolFast) {
          return {
            competition: { id: competition.id, slug: competition.slug, name: displayName },
            seasons,
            season,
            view: viewParam === "home" || viewParam === "away" ? viewParam : "overall",
            result: poolFast,
          };
        }
      }

      const result = await calculateRugbyTable("live_table", {
        competitionId: competition.id,
        seasonId,
        tableView,
        includeLiveMatches: true,
        includeScheduledMatches: false,
        showMovement: true,
      });
      const withHemisphere = await enrichNationsChampionshipResult(result, competition.id);
      const withWorldCup = await enrichWorldCupPoolResult(withHemisphere, {
        competitionId: competition.id,
        seasonYear: season?.year,
        seasonLabel: season?.label,
      });
      const enriched = await enrichUrcPoolResult(withWorldCup, {
        competitionSlug: competition.slug,
        seasonId,
        seasonYear: season?.year,
      });

      return {
        competition: { id: competition.id, slug: competition.slug, name: displayName },
        seasons,
        season,
        view: viewParam === "home" || viewParam === "away" ? viewParam : "overall",
        result: enriched,
      };
    };

    const cacheKey = `live-table:${slug}:${seasonLabel ?? "default"}:${tableView}`;
    const requestedYear = parseSeasonStartYear(seasonLabel);
    const ttl =
      requestedYear != null && requestedYear < currentDomesticSeasonStartYear()
        ? PUBLIC_CACHE_TTL.competitionTableHistoric
        : PUBLIC_CACHE_TTL.competitionTableLive;

    const payload = syncMatchId
      ? await buildPayload()
      : await cachedPublic(cacheKey, ttl, buildPayload);

    if (!payload) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": cacheControlForSeason(payload.season?.isActive),
      },
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load live table");
  }
}
