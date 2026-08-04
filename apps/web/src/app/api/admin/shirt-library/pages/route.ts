import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getOrCreateCompetitionShirtPage,
  setCompetitionShirtPageStatus,
  syncCompetitionShirtPageTeams,
  type ShirtLibraryPageStatus,
} from "@/lib/shirt-library-public-service";

const STATUSES = new Set<ShirtLibraryPageStatus>([
  "DRAFT",
  "READY_FOR_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
]);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const competitionId = searchParams.get("competitionId");
    const seasonId = searchParams.get("seasonId");
    if (!competitionId || !seasonId) {
      return NextResponse.json(
        { error: "competitionId and seasonId are required" },
        { status: 400 },
      );
    }
    const page = await getOrCreateCompetitionShirtPage(competitionId, seasonId);
    await syncCompetitionShirtPageTeams(page.id);
    return NextResponse.json({ ok: true, page });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load shirt library page");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      competitionId?: string;
      seasonId?: string;
      status?: ShirtLibraryPageStatus;
    };

    if (!body.competitionId || !body.seasonId) {
      return NextResponse.json(
        { error: "competitionId and seasonId are required" },
        { status: 400 },
      );
    }

    if (body.action === "sync") {
      const page = await getOrCreateCompetitionShirtPage(body.competitionId, body.seasonId);
      const result = await syncCompetitionShirtPageTeams(page.id);
      return NextResponse.json({ ok: true, page, ...result });
    }

    if (body.action === "set-status") {
      if (!body.status || !STATUSES.has(body.status)) {
        return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
      }
      const page = await setCompetitionShirtPageStatus(
        body.competitionId,
        body.seasonId,
        body.status,
      );
      return NextResponse.json({ ok: true, page });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to update shirt library page");
  }
}
