import { NextResponse } from "next/server";
import {
  assignFixturesToVenues,
  previewFixtureVenueAssignments,
} from "@/lib/assign-fixtures-to-venues-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fixtureId = searchParams.get("fixtureId") ?? undefined;
    const limit = Number(searchParams.get("limit") ?? 200);
    const previews = await previewFixtureVenueAssignments({ fixtureId, limit });
    const unmapped = previews.length;
    const mappable = previews.filter((row) => row.suggestedVenueId).length;
    return NextResponse.json({
      previews,
      summary: { unmapped, mappable, unresolved: unmapped - mappable },
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to preview fixture venue assignments");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const fixtureId =
      typeof body.fixtureId === "string" && body.fixtureId.trim() ? body.fixtureId.trim() : undefined;
    const venueId =
      typeof body.venueId === "string" && body.venueId.trim() ? body.venueId.trim() : undefined;
    const dryRun = body.dryRun === true;

    const result = await assignFixturesToVenues({ fixtureId, venueId, dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to assign fixtures to venues");
  }
}
