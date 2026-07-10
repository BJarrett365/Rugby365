import { NextResponse } from "next/server";
import {
  calculateAndPersistFixtureMatchRatings,
  listMatchRatingsForFixture,
  listRatingLabRows,
} from "@/lib/match-rating-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get("fixtureId");
  if (fixtureId) {
    const bundle = await listMatchRatingsForFixture(fixtureId);
    return NextResponse.json(bundle);
  }
  const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
  const rows = await listRatingLabRows(Number.isFinite(limit) ? limit : 100);
  return NextResponse.json({ rows });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { fixtureId?: string };
  if (!body.fixtureId) {
    return NextResponse.json({ error: "fixtureId required" }, { status: 400 });
  }
  const result = await calculateAndPersistFixtureMatchRatings(body.fixtureId);
  const bundle = await listMatchRatingsForFixture(body.fixtureId);
  return NextResponse.json({ ...result, bundle });
}
