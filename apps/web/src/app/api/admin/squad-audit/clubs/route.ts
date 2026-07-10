import { NextResponse } from "next/server";
import { listSquadAuditClubSummaries, syncPremiershipAuditClubs } from "@/lib/premiership-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    await syncPremiershipAuditClubs();
    const clubs = await listSquadAuditClubSummaries();
    return NextResponse.json({ clubs });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list squad audit clubs");
  }
}
