import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  analyseWikipediaSeasonPage,
  importWikipediaSeasonPage,
  wikipediaSeasonImportPresets,
} from "@/lib/wikipedia-season-import-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const competitionSlug = searchParams.get("competition") ?? "premiership";
  return NextResponse.json({
    competitionSlug,
    presets: wikipediaSeasonImportPresets(competitionSlug),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: "analyse" | "import";
      url?: string;
      competitionSlug?: string;
      seasonStartYear?: number;
      mode?: "fill_missing" | "update_existing";
      createMissingTeams?: boolean;
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

    const competitionSlug = body.competitionSlug ?? "premiership";

    const report = await importWikipediaSeasonPage(url, {
      competitionSlug,
      seasonStartYear: body.seasonStartYear,
      mode: body.mode ?? "update_existing",
      createMissingTeams:
        body.createMissingTeams ??
        [
          "challenge-cup",
          "rugby-champions-cup",
          "rugby-championship",
          "currie-cup",
          "top-14",
          "super-rugby",
          "championship",
          "npc",
          "six-nations",
          "rugby-world-cup",
          "rugby-europe-championship",
          "end-of-year-internationals",
          "autumn-nations-cup",
          "nations-championship",
          "world-rugby-nations-cup",
        ].includes(competitionSlug) ||
        competitionSlug.startsWith("currie-cup") ||
        competitionSlug.startsWith("npc-") ||
        competitionSlug.startsWith("autumn-nations-cup"),
    });
    return NextResponse.json(report);
  } catch (e) {
    return apiErrorResponse(e, "Wikipedia season import failed");
  }
}
