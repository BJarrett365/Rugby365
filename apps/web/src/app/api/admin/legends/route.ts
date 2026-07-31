import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getLegendsCatalogSummary, seedPlanetRugbyLegends } from "@/lib/legends-seed-service";
import { seedPlanetRugbyLegendCoaches } from "@/lib/legends-coach-seed-service";
import { listLegends } from "@/lib/legend-admin-service";
import { ensureLegendCollectionsSeeded } from "@/lib/legend-collections-service";
import { recalculateAllLegendScores } from "@/lib/legend-score-service";
import {
  LEGEND_COLLECTIONS,
  LEGEND_ERAS,
  PLANET_RUGBY_LEGEND_COACHES_CATALOG,
  mergeLegendCatalogByName,
} from "@/lib/legends-catalog";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("catalog") === "1") {
      return NextResponse.json({
        summary: getLegendsCatalogSummary(),
        eras: LEGEND_ERAS,
        collections: LEGEND_COLLECTIONS,
        coaches: PLANET_RUGBY_LEGEND_COACHES_CATALOG,
        players: mergeLegendCatalogByName(),
      });
    }
    const legends = await listLegends({
      search: searchParams.get("search") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      legendLevel: searchParams.get("legendLevel") ?? undefined,
      legendStatus: searchParams.get("legendStatus") ?? undefined,
    });
    return NextResponse.json({ legends });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list legends");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      limit?: number;
      dryRun?: boolean;
      enrichWikipedia?: boolean;
      delayMs?: number;
      search?: string;
      playerId?: string;
      legendLevel?: string;
      legendStatus?: string;
      teamId?: string | null;
      competitionId?: string | null;
      countryName?: string | null;
      internationalTeamId?: string | null;
      era?: string | null;
      reason?: string | null;
      careerSummary?: string | null;
      keyAchievements?: unknown;
      notableStats?: unknown;
      editorNotes?: string | null;
      sourceUrl?: string | null;
    };

    if (body.action === "ensure_collections") {
      const collections = await ensureLegendCollectionsSeeded();
      return NextResponse.json({ collections });
    }

    if (body.action === "seed" || body.action === "seed_catalog") {
      const result = await seedPlanetRugbyLegends({
        limit: typeof body.limit === "number" ? body.limit : undefined,
        dryRun: Boolean(body.dryRun),
        enrichWikipedia: body.enrichWikipedia !== false,
        delayMs: typeof body.delayMs === "number" ? body.delayMs : undefined,
        search: body.search,
      });
      return NextResponse.json(result);
    }

    if (body.action === "seed_coaches") {
      const result = await seedPlanetRugbyLegendCoaches({
        dryRun: Boolean(body.dryRun),
        enrichWikipedia: body.enrichWikipedia !== false,
      });
      return NextResponse.json(result);
    }

    if (body.action === "recalculate_scores") {
      const result = await recalculateAllLegendScores({
        limit: typeof body.limit === "number" ? body.limit : undefined,
      });
      return NextResponse.json(result);
    }

    const { createLegend } = await import("@/lib/legend-admin-service");
    const legend = await createLegend({
      playerId: String(body.playerId ?? ""),
      legendLevel: String(body.legendLevel ?? "club_legend"),
      legendStatus: body.legendStatus === "inactive" ? "inactive" : "active",
      teamId: body.teamId ? String(body.teamId) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      countryName: body.countryName ? String(body.countryName) : null,
      internationalTeamId: body.internationalTeamId ? String(body.internationalTeamId) : null,
      era: body.era ? String(body.era) : null,
      reason: body.reason ? String(body.reason) : null,
      careerSummary: body.careerSummary ? String(body.careerSummary) : null,
      keyAchievements: Array.isArray(body.keyAchievements)
        ? body.keyAchievements.map(String)
        : undefined,
      notableStats:
        body.notableStats && typeof body.notableStats === "object"
          ? (body.notableStats as Record<string, unknown>)
          : undefined,
      editorNotes: body.editorNotes ? String(body.editorNotes) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
    });
    return NextResponse.json({ legend }, { status: 201 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update legends");
  }
}
