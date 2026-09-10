import { NextResponse } from "next/server";
import { getCompetitionStandingsBySlug } from "@/lib/competition-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";
import { cachedPublic, PUBLIC_CACHE_TTL, publicJsonCacheHeaders } from "@/lib/public-data-cache";
import { sanitizeSeasonQueryParam } from "@/lib/season-label-utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = sanitizeSeasonQueryParam(searchParams.get("season"));
    const view = (searchParams.get("view") ?? "overall") as "overall" | "home" | "away";

    const data = await cachedPublic(
      `standings:v4:${slug}:${seasonLabel ?? "default"}:${view}`,
      PUBLIC_CACHE_TTL.competitionStandings,
      () => getCompetitionStandingsBySlug(slug, { seasonLabel, view }),
    );
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: publicJsonCacheHeaders(
        PUBLIC_CACHE_TTL.competitionStandings,
        PUBLIC_CACHE_TTL.competitionStandings * 2,
      ),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load standings");
  }
}
