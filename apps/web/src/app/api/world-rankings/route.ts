import { NextResponse } from "next/server";
import type { WorldRugbyRankingCategory } from "@rugby365/import-sdk";
import { getWorldRankingFeed } from "@/lib/world-rugby-rankings-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") ?? "mru") as WorldRugbyRankingCategory;

    if (category !== "mru" && category !== "wru") {
      return NextResponse.json({ error: "category must be mru or wru" }, { status: 400 });
    }

    const feed = await getWorldRankingFeed(category);
    if (!feed) {
      return NextResponse.json({ error: "Rankings not synced yet" }, { status: 404 });
    }

    return NextResponse.json(feed);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load World Rugby rankings");
  }
}
