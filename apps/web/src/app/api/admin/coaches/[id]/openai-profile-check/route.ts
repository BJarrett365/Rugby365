import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getCoachOpenAiProfileCheck,
  listCoachOpenAiProfileChecks,
  runCoachOpenAiProfileCheck,
  type CoachProfileCheckScope,
} from "@/lib/coach-openai-profile-check-service";

const SCOPES = new Set<CoachProfileCheckScope>([
  "full",
  "career",
  "honours",
  "bio",
  "images",
  "stats",
]);

/**
 * GET — list prior OpenAI profile checks (history).
 * POST — run a new check { scope?: 'full'|... }
 * Nothing auto-publishes.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await listCoachOpenAiProfileChecks(id, 15);
    return NextResponse.json({
      ok: true,
      history: history.map((h) => ({
        id: h.id,
        model: h.model,
        checkedAt: h.createdAt?.toISOString?.() ?? null,
        confidenceScore: h.confidenceScore,
        status: h.status,
        report: h.report,
      })),
      lastChecked: history[0]?.createdAt?.toISOString?.() ?? null,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load OpenAI profile checks");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      scope?: string;
      reportId?: string;
    };

    if (body.reportId) {
      const row = await getCoachOpenAiProfileCheck(body.reportId);
      if (!row || row.entityId !== id) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        reportId: row.id,
        report: row.report,
        snapshot: row.sourceSnapshot,
      });
    }

    const scope = (body.scope ?? "full") as CoachProfileCheckScope;
    if (!SCOPES.has(scope)) {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const result = await runCoachOpenAiProfileCheck(id, { scope });
    return NextResponse.json({
      ok: true,
      ...result,
      note: "OpenAI Profile Check complete. Nothing was published automatically.",
    });
  } catch (e) {
    return apiErrorResponse(e, "OpenAI profile check failed");
  }
}
