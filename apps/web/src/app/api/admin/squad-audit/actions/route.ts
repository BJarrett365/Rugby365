import { NextResponse } from "next/server";
import {
  approveHighConfidenceMatches,
  importApprovedSquadChanges,
  markSquadAuditClubComplete,
  updateSquadAuditPlayerReview,
} from "@/lib/premiership-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const teamId = String(body.teamId ?? "");
    const jobId = String(body.jobId ?? "");
    const userLabel = body.userLabel ? String(body.userLabel) : "admin";

    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

    switch (action) {
      case "approve_rows": {
        const ids = Array.isArray(body.playerRowIds) ? body.playerRowIds.map(String) : [];
        const result = await updateSquadAuditPlayerReview(ids, "approved", userLabel);
        return NextResponse.json(result);
      }
      case "approve_high_confidence": {
        if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
        const result = await approveHighConfidenceMatches(teamId, jobId, userLabel);
        return NextResponse.json(result);
      }
      case "import_approved": {
        if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
        const job = await importApprovedSquadChanges(teamId, jobId, userLabel);
        return NextResponse.json({ job }, { status: 202 });
      }
      case "mark_complete": {
        const club = await markSquadAuditClubComplete(teamId, userLabel);
        return NextResponse.json({ club });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return apiErrorResponse(e, "Failed squad audit action");
  }
}
