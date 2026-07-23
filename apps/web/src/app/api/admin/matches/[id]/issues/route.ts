import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  applyMatchIssueSuggestion,
  getMatchIssuesReport,
  mergeMatchDuplicate,
} from "@/lib/match-issues-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const useAi = searchParams.get("ai") === "1";
    const report = await getMatchIssuesReport(id, { useAi });
    if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(report);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match issues");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "verify") {
      const report = await getMatchIssuesReport(id, { useAi: body.useAi !== false });
      if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(report);
    }

    if (action === "apply") {
      const field = body.field === "refereeId" ? "refereeId" : "venueId";
      const value = String(body.value ?? "");
      if (!value) return NextResponse.json({ error: "value required" }, { status: 400 });
      const report = await applyMatchIssueSuggestion(id, {
        field,
        value,
        source: (body.source as "home_venue") ?? "text_resolve",
        displayName: String(body.displayName ?? value),
      });
      return NextResponse.json(report);
    }

    if (action === "merge_duplicate") {
      const otherFixtureId = String(body.otherFixtureId ?? "");
      if (!otherFixtureId) {
        return NextResponse.json({ error: "otherFixtureId required" }, { status: 400 });
      }
      const keep =
        body.keep === "this" || body.keep === "other" || body.keep === "recommended"
          ? body.keep
          : "recommended";
      const result = await mergeMatchDuplicate(id, otherFixtureId, { keep });
      if (result.keeperId !== id) {
        return NextResponse.json({
          ...result,
          redirectedTo: `/admin/matches/${result.keeperId}/edit#issues`,
        });
      }
      const report = await getMatchIssuesReport(id);
      return NextResponse.json({ ...result, report });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update match issues";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
