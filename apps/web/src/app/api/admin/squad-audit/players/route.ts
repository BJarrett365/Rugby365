import { NextResponse } from "next/server";
import type { SquadAuditGroupType, SquadConflictType, SquadMatchConfidence } from "@/lib/club-squad-compare-service";
import { listSquadAuditPlayers } from "@/lib/premiership-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });

    const result = await listSquadAuditPlayers({
      teamId,
      jobId: searchParams.get("jobId") ?? undefined,
      page: Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      pageSize: Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20,
      groupType: (searchParams.get("groupType") as SquadAuditGroupType | null) ?? undefined,
      reviewStatus: searchParams.get("reviewStatus") ?? undefined,
      matchConfidence: (searchParams.get("matchConfidence") as SquadMatchConfidence | null) ?? undefined,
      position: searchParams.get("position") ?? undefined,
      conflictType: (searchParams.get("conflictType") as SquadConflictType | null) ?? undefined,
      sourceType: searchParams.get("sourceType") ?? undefined,
      sortBy:
        (searchParams.get("sortBy") as
          | "sourcePlayerName"
          | "matchedPlayerName"
          | "matchConfidence"
          | "groupType"
          | null) ?? undefined,
      sortDir: searchParams.get("sortDir") === "desc" ? "desc" : "asc",
    });

    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to list squad audit players");
  }
}
