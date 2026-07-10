import { NextResponse } from "next/server";
import { assignCoachesToCmsTeams, relinkMisassignedCoachTeams } from "@/lib/assign-coaches-to-cms-teams-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const coachId =
      typeof body.coachId === "string" && body.coachId.trim() ? body.coachId.trim() : undefined;

    if (body.relinkOnly === true) {
      const result = await relinkMisassignedCoachTeams();
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await assignCoachesToCmsTeams({ coachId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to assign coaches to CMS teams");
  }
}
