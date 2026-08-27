import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCompareLitePayload } from "@/lib/player-compare-lite-service";

/** Fast head-to-head payload from persisted DB rows (no full profile rebuild). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const a = searchParams.get("a")?.trim() ?? "";
    const b = searchParams.get("b")?.trim() ?? "";

    if (!a || !b) {
      return NextResponse.json({ error: "Pick two players (a and b)." }, { status: 400 });
    }
    if (a === b) {
      return NextResponse.json({ error: "Pick two different players." }, { status: 400 });
    }

    const payload = await getCompareLitePayload(a, b);
    if (!payload) {
      return NextResponse.json({ error: "One or both players were not found." }, { status: 404 });
    }

    return NextResponse.json(payload);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load player comparison");
  }
}
