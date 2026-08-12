import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "@/lib/db";
import {
  COACH_TREND_FILTERS,
  getCoachRatingTrends,
  type CoachTrendFilter,
} from "@/lib/coach-rating-trends-service";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const filterParam = url.searchParams.get("filter") ?? "last_24";
  const filter = COACH_TREND_FILTERS.includes(filterParam as CoachTrendFilter)
    ? (filterParam as CoachTrendFilter)
    : "last_24";

  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.slug, slug)).limit(1);
  if (!coach) {
    return NextResponse.json({ error: "Coach not found" }, { status: 404 });
  }

  const bundle = await getCoachRatingTrends(coach.id, filter);
  return NextResponse.json(bundle);
}
