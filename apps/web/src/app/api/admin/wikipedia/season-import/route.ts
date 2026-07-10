import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  analyseWikipediaSeasonPage,
  importWikipediaSeasonPage,
  premiershipWikipediaSeasonUrls,
} from "@/lib/wikipedia-season-import-service";

export async function GET() {
  return NextResponse.json({
    presets: premiershipWikipediaSeasonUrls(),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: "analyse" | "import";
      url?: string;
      seasonStartYear?: number;
      mode?: "fill_missing" | "update_existing";
    };

    const url = body.url?.trim();
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    if (body.action === "analyse") {
      const parsed = await analyseWikipediaSeasonPage(url);
      return NextResponse.json({
        pageTitle: parsed.pageTitle,
        wikipediaUrl: parsed.wikipediaUrl,
        revisionId: parsed.revisionId,
        seasonStartYear: parsed.seasonStartYear,
        championName: parsed.championName,
        standings: parsed.standings.length,
        fixtures: parsed.fixtures.length,
        playoffs: parsed.playoffFixtures.length,
        attendance: [...parsed.fixtures, ...parsed.playoffFixtures].filter((f) => f.attendance != null)
          .length,
        venues: parsed.venues.length,
        referees: parsed.referees.length,
        warnings: parsed.warnings,
        tablePreview: parsed.standings.slice(0, 12),
        playoffPreview: parsed.playoffFixtures,
      });
    }

    const report = await importWikipediaSeasonPage(url, {
      seasonStartYear: body.seasonStartYear,
      mode: body.mode ?? "update_existing",
      createMissingTeams: false,
    });
    return NextResponse.json(report);
  } catch (e) {
    return apiErrorResponse(e, "Wikipedia season import failed");
  }
}
