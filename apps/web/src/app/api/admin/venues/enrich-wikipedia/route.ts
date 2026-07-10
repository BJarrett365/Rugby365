import { NextResponse } from "next/server";
import { enrichAllVenuesFromWikipedia } from "@/lib/venue-wikipedia-enrich";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST() {
  try {
    const summary = await enrichAllVenuesFromWikipedia();
    return NextResponse.json(summary);
  } catch (e) {
    return apiErrorResponse(e, "Failed to enrich venues from Wikipedia");
  }
}
