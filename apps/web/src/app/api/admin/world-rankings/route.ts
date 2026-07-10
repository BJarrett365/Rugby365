import { NextResponse } from "next/server";
import { listWorldRankingFeeds } from "@/lib/world-rugby-rankings-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const feeds = await listWorldRankingFeeds();
    return NextResponse.json({ feeds });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load World Rugby rankings");
  }
}
