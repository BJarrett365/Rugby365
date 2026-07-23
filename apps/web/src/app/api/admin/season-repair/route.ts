import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  applySeasonRepairSafe,
  listSeasonRepairCompetitionStats,
  previewSeasonRepair,
} from "@/lib/season-repair-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("stats") === "1") {
      const competitions = await listSeasonRepairCompetitionStats();
      return NextResponse.json({ competitions });
    }

    const competitionId = url.searchParams.get("competitionId")?.trim();
    if (!competitionId) {
      return NextResponse.json(
        { error: "competitionId is required for season repair preview" },
        { status: 400 },
      );
    }

    const preview = await previewSeasonRepair({
      competitionId,
      fromDate: url.searchParams.get("from"),
      toDate: url.searchParams.get("to"),
      onlyProblems: url.searchParams.get("onlyProblems") !== "0",
      limit: url.searchParams.get("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined,
    });
    return NextResponse.json(preview);
  } catch (e) {
    return apiErrorResponse(e, "Failed to preview season repair");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      competitionId?: string;
      fromDate?: string | null;
      toDate?: string | null;
      fixtureIds?: string[];
      dryRun?: boolean;
      userLabel?: string;
      confirmApply?: boolean;
    };

    const competitionId = body.competitionId?.trim();
    if (!competitionId) {
      return NextResponse.json({ error: "competitionId is required" }, { status: 400 });
    }

    const dryRun = body.dryRun !== false && body.confirmApply !== true;
    if (!dryRun && body.confirmApply !== true) {
      return NextResponse.json(
        { error: "Set confirmApply: true to apply safe season repairs" },
        { status: 400 },
      );
    }

    const result = await applySeasonRepairSafe({
      competitionId,
      fromDate: body.fromDate,
      toDate: body.toDate,
      fixtureIds: body.fixtureIds,
      userLabel: body.userLabel,
      dryRun,
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to apply season repair");
  }
}
