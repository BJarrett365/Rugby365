import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getCompareLitePlayer,
  toCompareLiteCard,
} from "@/lib/player-compare-lite-service";

/** Lightweight compare card from persisted DB rows. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.trim() ?? "";
    if (!slug) {
      return NextResponse.json({ error: "Missing slug." }, { status: 400 });
    }

    const player = await getCompareLitePlayer(slug);
    if (!player) {
      return NextResponse.json({ error: "Player not found." }, { status: 404 });
    }

    return NextResponse.json({ card: toCompareLiteCard(player) });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load compare card");
  }
}
