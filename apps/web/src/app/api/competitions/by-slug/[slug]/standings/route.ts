import { NextResponse } from "next/server";
import { getCompetitionStandingsBySlug } from "@/lib/competition-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const seasonLabel = searchParams.get("season") ?? undefined;
    const view = (searchParams.get("view") ?? "overall") as "overall" | "home" | "away";

    const data = await getCompetitionStandingsBySlug(slug, { seasonLabel, view });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load standings");
  }
}
