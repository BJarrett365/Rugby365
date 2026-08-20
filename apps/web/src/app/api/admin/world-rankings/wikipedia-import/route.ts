import { NextResponse } from "next/server";
import type { WorldRugbyRankingCategory } from "@rugby365/import-sdk";
import { importWikipediaWorldRankings } from "@/lib/world-ranking-wikipedia-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

type Body = {
  category?: WorldRugbyRankingCategory;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const category = body.category ?? "mru";
    if (category !== "mru" && category !== "wru") {
      return NextResponse.json({ error: "category must be mru or wru" }, { status: 400 });
    }
    const result = await importWikipediaWorldRankings(category);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to import Wikipedia world rankings");
  }
}
