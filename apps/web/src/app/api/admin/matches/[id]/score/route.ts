import { NextResponse } from "next/server";
import { updateFixtureScoreStatus } from "@/lib/fixture-score-update-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    const homeScore =
      body.homeScore !== undefined && body.homeScore !== null && body.homeScore !== ""
        ? Number(body.homeScore)
        : undefined;
    const awayScore =
      body.awayScore !== undefined && body.awayScore !== null && body.awayScore !== ""
        ? Number(body.awayScore)
        : undefined;
    const status = typeof body.status === "string" ? body.status : undefined;
    const lockAfterSave = body.lockAfterSave !== false;
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    const result = await updateFixtureScoreStatus(id, {
      homeScore,
      awayScore,
      status,
      lockAfterSave,
      reason,
      userLabel: typeof body.userLabel === "string" ? body.userLabel : "admin",
    });

    return NextResponse.json({
      ok: true,
      fixture: {
        id: result.fixture.id,
        homeScore: result.fixture.homeScore,
        awayScore: result.fixture.awayScore,
        status: result.fixture.status,
      },
      changed: result.changed,
      lockedFields: result.lockedFields,
      skippedLocked: result.skippedLocked,
      message:
        result.changed.length === 0
          ? "No changes"
          : `Updated ${result.changed.map((c) => c.field).join(", ")} and saved to the database.`,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update score");
  }
}
