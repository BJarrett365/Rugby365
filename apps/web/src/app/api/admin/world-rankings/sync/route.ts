import { NextResponse } from "next/server";
import type { WorldRugbyRankingCategory } from "@rugby365/import-sdk";
import {
  syncAllWorldRugbyRankings,
  syncWorldRugbyRankings,
} from "@/lib/world-rugby-rankings-service";
import { apiErrorResponse } from "@/lib/api-errors";

type SyncBody = {
  category?: WorldRugbyRankingCategory | "all";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SyncBody;
    const category = body.category ?? "all";

    if (category === "all") {
      const results = await syncAllWorldRugbyRankings();
      return NextResponse.json({ ok: true, results });
    }

    if (category !== "mru" && category !== "wru") {
      return NextResponse.json({ error: "category must be mru, wru, or all" }, { status: 400 });
    }

    const result = await syncWorldRugbyRankings(category);
    return NextResponse.json({ ok: true, category, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to sync World Rugby rankings");
  }
}
