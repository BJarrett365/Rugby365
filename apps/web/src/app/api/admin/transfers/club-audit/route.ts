import { NextResponse } from "next/server";
import { auditClubTransfers } from "@/lib/transfer-club-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    const seasonId = searchParams.get("seasonId");
    if (!teamId || !seasonId) {
      return NextResponse.json({ error: "teamId and seasonId are required" }, { status: 400 });
    }

    const report = await auditClubTransfers({ teamId, seasonId });
    if (!report) {
      return NextResponse.json({ error: "Team or season not found" }, { status: 404 });
    }

    return NextResponse.json({ report });
  } catch (e) {
    return apiErrorResponse(e, "Failed to audit club transfers");
  }
}
