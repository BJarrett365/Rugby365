import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { importAllVenueCapacitiesFromWikipediaList } from "@/lib/venue-capacity-list-import-service";

export async function POST() {
  try {
    const summary = await importAllVenueCapacitiesFromWikipediaList();
    return NextResponse.json(summary);
  } catch (e) {
    return apiErrorResponse(e, "Failed to import venue capacities from Wikipedia list");
  }
}
