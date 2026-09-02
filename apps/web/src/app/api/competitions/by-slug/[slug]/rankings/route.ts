import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionRankingsBySlug } from "@/lib/competition-rankings-service";
import { cachedPublic, PUBLIC_CACHE_TTL, publicJsonCacheHeaders } from "@/lib/public-data-cache";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = searchParams.get("season") ?? undefined;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const resolvedLimit = Number.isFinite(limit) ? limit : undefined;

    const data = await cachedPublic(
      `competition-rankings-v32:${slug}:${seasonLabel ?? ""}:${resolvedLimit ?? ""}`,
      PUBLIC_CACHE_TTL.rankingsBoard,
      () =>
        getCompetitionRankingsBySlug(slug, {
          seasonLabel,
          limit: resolvedLimit,
        }),
    );
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data, {
      headers: publicJsonCacheHeaders(PUBLIC_CACHE_TTL.rankingsBoard, PUBLIC_CACHE_TTL.rankingsBoard * 2),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition rankings");
  }
}

export const maxDuration = 26;

