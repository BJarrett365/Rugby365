import { NextResponse } from "next/server";
import { listSquadAuditLog } from "@/lib/premiership-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50;
    const entries = await listSquadAuditLog(teamId, limit);
    return NextResponse.json({ entries });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load squad audit log");
  }
}
