import { NextResponse } from "next/server";
import {
  getSquadAuditClub,
  saveSquadAuditClubSource,
} from "@/lib/premiership-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

type RouteContext = { params: Promise<{ teamId: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { teamId } = await context.params;
    const club = await getSquadAuditClub(teamId);
    if (!club) return NextResponse.json({ error: "Club not found" }, { status: 404 });
    return NextResponse.json({ club });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load squad audit club");
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const { teamId } = await context.params;
    const body = (await req.json()) as Record<string, unknown>;
    const club = await saveSquadAuditClubSource(teamId, {
      officialSquadUrl: body.officialSquadUrl === undefined ? undefined : String(body.officialSquadUrl ?? ""),
      sourceType: body.sourceType ? String(body.sourceType) : undefined,
      backupSourceType:
        body.backupSourceType === undefined ? undefined : String(body.backupSourceType ?? "") || null,
      importParser: body.importParser === undefined ? undefined : String(body.importParser ?? "") || null,
      notes: body.notes === undefined ? undefined : String(body.notes ?? "") || null,
      userLabel: body.userLabel ? String(body.userLabel) : "admin",
    });
    return NextResponse.json({ club });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save squad source");
  }
}
