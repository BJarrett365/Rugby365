import { NextResponse } from "next/server";
import { importFromPlanetRugbyTournamentUrl } from "@/lib/planet-rugby-import-service";
import {
  importOptionsForMode,
  PLANET_RUGBY_LEAGUE_PRESETS,
  type PlanetRugbyImportMode,
} from "@/lib/planet-rugby-import-presets";
import { importStreamResponse } from "@/lib/import-stream-response";

export const maxDuration = 800;

export async function GET() {
  return NextResponse.json({
    presets: PLANET_RUGBY_LEAGUE_PRESETS,
    defaultUrl: PLANET_RUGBY_LEAGUE_PRESETS[0].url,
    modes: {
      table: "Create/update league, seasons, and league table only",
      full: "League, table, results, and fixtures",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const tournamentUrl = String(body.tournamentUrl ?? "").trim();
    if (!tournamentUrl) {
      return NextResponse.json({ error: "tournamentUrl is required" }, { status: 400 });
    }

    const mode = (body.mode === "table" ? "table" : "full") as PlanetRugbyImportMode;
    const modeOptions = importOptionsForMode(mode);
    const importAllSeasons = Boolean(body.importAllSeasons);
    const streamProgress = Boolean(body.streamProgress) || importAllSeasons;

    const importOptions = {
      seasonLabel: body.seasonLabel ? String(body.seasonLabel) : undefined,
      importFixtures:
        body.importFixtures !== undefined ? Boolean(body.importFixtures) : modeOptions.importFixtures,
      importResults:
        body.importResults !== undefined ? Boolean(body.importResults) : modeOptions.importResults,
      syncStandings:
        body.syncStandings !== undefined ? Boolean(body.syncStandings) : modeOptions.syncStandings,
      importMatchDetails:
        body.importMatchDetails !== undefined
          ? Boolean(body.importMatchDetails)
          : modeOptions.importMatchDetails,
      importAllSeasons,
    };

    if (streamProgress) {
      return importStreamResponse(async (onProgress) => {
        const result = await importFromPlanetRugbyTournamentUrl(tournamentUrl, {
          ...importOptions,
          onProgress,
        });
        return { ok: true, mode, ...result };
      });
    }

    const result = await importFromPlanetRugbyTournamentUrl(tournamentUrl, importOptions);
    return NextResponse.json({ ok: true, mode, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
