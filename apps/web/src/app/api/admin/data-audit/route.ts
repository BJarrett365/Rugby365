import { NextResponse } from "next/server";
import { runDataHealthAudit } from "@/lib/data-audit-service";
import { reportDuplicateCompetitionSeasons } from "@/lib/competition-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");

    if (competitionId && searchParams.get("duplicateSeasons") === "1") {
      const duplicates = await reportDuplicateCompetitionSeasons(competitionId);
      return NextResponse.json({ duplicates });
    }

    const report = await runDataHealthAudit();
    return NextResponse.json(report);
  } catch (e) {
    return apiErrorResponse(e, "Failed to run data audit");
  }
}
