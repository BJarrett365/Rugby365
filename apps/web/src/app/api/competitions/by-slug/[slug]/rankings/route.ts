import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionRankingsBySlug } from "@/lib/competition-rankings-service";
import { cachedPublic, PUBLIC_CACHE_TTL } from "@/lib/public-data-cache";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = searchParams.get("season") ?? undefined;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const resolvedLimit = Number.isFinite(limit) ? limit : undefined;

    const data = await cachedPublic(
      `competition-rankings-v22:${slug}:${seasonLabel ?? ""}:${resolvedLimit ?? ""}`,
      PUBLIC_CACHE_TTL.rankingsBoard,
      () =>
        getCompetitionRankingsBySlug(slug, {
          seasonLabel,
          limit: resolvedLimit,
        }),
    );
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition rankings");
  }
}

export const maxDuration = 26;

