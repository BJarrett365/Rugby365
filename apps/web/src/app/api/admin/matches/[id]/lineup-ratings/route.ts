import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getAdminFixtureLineupRatings } from "@/lib/match-rating-service";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const bundle = await getAdminFixtureLineupRatings(id);
    return NextResponse.json(bundle);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load lineup ratings");
  }
}
