import { NextResponse } from "next/server";
import {
  deleteCompetition,
  getCompetitionDetail,
  getSeasonStandings,
  updateCompetition,
} from "@/lib/competition-admin-service";
import {
  syncCompetitionSeasonsFromSdms,
  syncCompetitionStandings,
  syncSeasonStandings,
} from "@/lib/standings-sync-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getCompetitionDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const activeSeason = detail.seasons.find((s) => s.isActive) ?? detail.seasons[0];
    const standings = activeSeason
      ? await getSeasonStandings(activeSeason.id, "overall")
      : [];

    return NextResponse.json({ ...detail, standings });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "import-planet-rugby") {
      const { importPlanetRugbyCompetition } = await import("@/lib/planet-rugby-import-service");
      const result = await importPlanetRugbyCompetition({
        competitionId: id,
        seasonLabel: body.seasonLabel ? String(body.seasonLabel) : undefined,
        importFixtures: body.importFixtures !== false,
        importResults: body.importResults !== false,
        syncStandings: body.syncStandings !== false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "recompute-form") {
      const { recomputeStandingForms } = await import("@/lib/standing-form-recompute-service");
      const result = await recomputeStandingForms({
        competitionId: id,
        force: body.force === true,
        activeOnly: body.allSeasons !== true,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "sync-seasons") {
      const result = await syncCompetitionSeasonsFromSdms(id);
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "sync-standings") {
      const result = await syncCompetitionStandings(
        id,
        body.seasonLabel ? String(body.seasonLabel) : undefined,
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "sync-season-standings" && body.seasonId) {
      const result = await syncSeasonStandings(String(body.seasonId));
      return NextResponse.json({ ok: true, ...result });
    }

    const competition = await updateCompetition(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.competitionType !== undefined
        ? { competitionType: body.competitionType as "domestic" | "international" | "world_cup" | "european" }
        : {}),
      ...(body.sdmsCompCode !== undefined
        ? { sdmsCompCode: body.sdmsCompCode ? String(body.sdmsCompCode) : null }
        : {}),
      ...(body.planetRugbySlug !== undefined
        ? { planetRugbySlug: body.planetRugbySlug ? String(body.planetRugbySlug) : null }
        : {}),
    });
    return NextResponse.json({ competition });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update competition";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCompetition(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete competition";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
