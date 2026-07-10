import { NextResponse } from "next/server";
import { importFromLiveSportTournamentUrl } from "@/lib/livesport-import-service";
import { LIVESPORT_LEAGUE_PRESETS } from "@/lib/livesport-import-presets";
import { importStreamResponse } from "@/lib/import-stream-response";

export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({
    presets: LIVESPORT_LEAGUE_PRESETS,
    defaultUrl: LIVESPORT_LEAGUE_PRESETS[0].url,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const tournamentUrl = String(body.tournamentUrl ?? "").trim();
    if (!tournamentUrl) {
      return NextResponse.json({ error: "tournamentUrl is required" }, { status: 400 });
    }

    const importOptions = {
      seasonLabel: body.seasonLabel ? String(body.seasonLabel) : undefined,
      importFixtures: body.importFixtures !== undefined ? Boolean(body.importFixtures) : true,
      importResults: body.importResults !== undefined ? Boolean(body.importResults) : true,
      syncStandings: body.syncStandings !== undefined ? Boolean(body.syncStandings) : true,
    };

    if (Boolean(body.streamProgress)) {
      return importStreamResponse(async (onProgress) => {
        const result = await importFromLiveSportTournamentUrl(tournamentUrl, {
          ...importOptions,
          onProgress,
        });
        return { ok: true, ...result };
      });
    }

    const result = await importFromLiveSportTournamentUrl(tournamentUrl, importOptions);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
