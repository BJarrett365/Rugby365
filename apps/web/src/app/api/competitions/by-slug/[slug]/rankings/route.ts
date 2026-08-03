import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompetitionRankingsBySlug } from "@/lib/competition-rankings-service";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = searchParams.get("season") ?? undefined;
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

    const data = await getCompetitionRankingsBySlug(slug, {
      seasonLabel,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition rankings");
  }
}
