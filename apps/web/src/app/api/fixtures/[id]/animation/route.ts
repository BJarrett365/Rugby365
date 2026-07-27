import { NextResponse } from "next/server";
import { getMatchDetailForPage } from "@/lib/match-detail-service";
import { buildMatchAnimationPublicPayload } from "@/lib/match-animation-public-service";

/**
 * Public Match Animation state for a fixture (SDMS match id or CMS fixture id via detail lookup).
 * Exposes only published presentation data — never CMS drafts or operator controls.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatchDetailForPage(id);
  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  const payload = await buildMatchAnimationPublicPayload(data);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
