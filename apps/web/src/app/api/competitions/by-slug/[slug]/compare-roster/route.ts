import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionCompareRosterBySlug } from "@/lib/competition-compare-roster-service";
import { publicJsonCacheHeaders, PUBLIC_CACHE_TTL } from "@/lib/public-data-cache";

export const dynamic = "force-dynamic";

/** Teams + squad players for competition → team → player compare pickers. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const seasonLabel = new URL(req.url).searchParams.get("season") ?? undefined;
    const data = await getCompetitionCompareRosterBySlug(slug, { seasonLabel });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: publicJsonCacheHeaders(PUBLIC_CACHE_TTL.competitionHub, PUBLIC_CACHE_TTL.competitionHub * 2),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load compare roster");
  }
}
