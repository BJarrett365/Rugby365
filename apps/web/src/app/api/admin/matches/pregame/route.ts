import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listPregameReadiness } from "@/lib/match-pregame-readiness-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const hoursAhead = Number(searchParams.get("hoursAhead") ?? "72");
    const gapsOnly = searchParams.get("gapsOnly") !== "0";
    const competitionId = searchParams.get("competitionId");
    const report = await listPregameReadiness({
      hoursAhead: Number.isFinite(hoursAhead) ? hoursAhead : 72,
      gapsOnly,
      competitionId,
      limit: Number(searchParams.get("limit") ?? "80"),
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load pre-game readiness");
  }
}
