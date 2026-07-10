import { NextResponse } from "next/server";
import { createCompetition, listCompetitions } from "@/lib/competition-admin-service";
import { syncCompetitionStandings } from "@/lib/standings-sync-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const competitions = await listCompetitions();
    return NextResponse.json({ competitions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list competitions");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "import-all-planet-rugby") {
      const { importFromPlanetRugbyTournamentUrl } = await import("@/lib/planet-rugby-import-service");
      const { PLANET_RUGBY_LEAGUE_PRESETS } = await import("@/lib/planet-rugby-import-presets");
      const mode = body.mode === "table" ? "table" : "full";
      const importFixtures = mode === "full";
      const importResults = mode === "full";
      const results = [];
      for (const preset of PLANET_RUGBY_LEAGUE_PRESETS) {
        try {
          const result = await importFromPlanetRugbyTournamentUrl(preset.url, {
            importFixtures,
            importResults,
            syncStandings: true,
          });
          results.push({ slug: preset.slug, ...result });
        } catch (err) {
          results.push({
            slug: preset.slug,
            error: err instanceof Error ? err.message : "Import failed",
          });
        }
      }
      return NextResponse.json({ ok: true, results });
    }

    if (body.action === "sync-all-standings") {
      const all = await listCompetitions();
      const results = [];
      for (const c of all) {
        if (!c.sdmsCompCode) continue;
        try {
          const result = await syncCompetitionStandings(c.id);
          results.push({ slug: c.slug, ...result });
        } catch (err) {
          results.push({
            slug: c.slug,
            error: err instanceof Error ? err.message : "Sync failed",
          });
        }
      }
      return NextResponse.json({ ok: true, results });
    }

    const competition = await createCompetition({
      name: String(body.name ?? ""),
      slug: body.slug ? String(body.slug) : undefined,
      competitionType: body.competitionType as "domestic" | "international" | "world_cup" | "european" | undefined,
      sdmsCompCode: body.sdmsCompCode ? String(body.sdmsCompCode) : undefined,
      planetRugbySlug: body.planetRugbySlug ? String(body.planetRugbySlug) : undefined,
    });
    return NextResponse.json({ competition }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create competition";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
