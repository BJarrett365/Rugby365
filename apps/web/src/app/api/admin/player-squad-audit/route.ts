import { NextResponse } from "next/server";
import { runFullSquadAudit } from "@/lib/player-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId") ?? undefined;
    const seasonId = searchParams.get("seasonId") ?? undefined;
    const rebuildMemberships = searchParams.get("rebuild") === "1";

    const report = await runFullSquadAudit({
      competitionId,
      seasonId,
      rebuildMemberships,
    });
    return NextResponse.json(report);
  } catch (e) {
    return apiErrorResponse(e, "Failed to run squad audit");
  }
}
