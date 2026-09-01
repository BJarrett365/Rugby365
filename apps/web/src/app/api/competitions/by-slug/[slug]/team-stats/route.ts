import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import type { HemisphereFilter } from "@/lib/competition-player-leaderboards-service";
import { getCompetitionTeamStatsBySlug } from "@/lib/competition-team-leaderboards-service";
import { publicJsonCacheHeaders, PUBLIC_CACHE_TTL } from "@/lib/public-data-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = searchParams.get("season") ?? undefined;
    const hemisphere = (searchParams.get("hemisphere") ?? "all") as HemisphereFilter;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    const data = await getCompetitionTeamStatsBySlug(slug, {
      seasonLabel,
      hemisphere:
        hemisphere === "northern" || hemisphere === "southern" || hemisphere === "all"
          ? hemisphere
          : "all",
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: publicJsonCacheHeaders(PUBLIC_CACHE_TTL.competitionHub, PUBLIC_CACHE_TTL.competitionHub * 2),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition team stats");
  }
}
