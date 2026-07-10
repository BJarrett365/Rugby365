import { NextResponse } from "next/server";
import { bulkAiAssessPlayersAndTeams } from "@/lib/ai-bulk-assessment-service";
import { assignAllPlayerInternationalTeams } from "@/lib/international-team-assign-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const assignInternational = body.assignInternational !== false;
    const runAi = body.runAi !== false;
    const onlyMissing = body.onlyMissing !== false;
    const limit = typeof body.limit === "number" ? body.limit : undefined;

    const result: Record<string, unknown> = {};

    if (assignInternational) {
      result.international = await assignAllPlayerInternationalTeams({
        onlyMissing,
        limit,
      });
    }

    if (runAi) {
      result.ai = await bulkAiAssessPlayersAndTeams({
        entityType: "both",
        onlyMissing,
        autoApply: body.autoApply !== false,
        limit,
        delayMs: 400,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to run bulk international assign / AI assessment");
  }
}
