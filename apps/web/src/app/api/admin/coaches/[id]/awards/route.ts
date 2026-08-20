import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createCoachAward,
  deleteCoachAward,
  listCoachAwards,
} from "@/lib/coach-history-cms-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await listCoachAwards(id);
    return NextResponse.json({ awards: rows });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load awards");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.awardName || !String(body.awardName).trim()) {
      return NextResponse.json({ error: "awardName is required" }, { status: 400 });
    }
    const row = await createCoachAward(id, {
      awardName: String(body.awardName),
      awardingBody: body.awardingBody ? String(body.awardingBody) : null,
      year: body.year as number | string | null | undefined,
      category: body.category ? String(body.category) : null,
      result: body.result ? String(body.result) : undefined,
      teamIdAtTime: body.teamIdAtTime ? String(body.teamIdAtTime) : null,
      isMajor: body.isMajor !== undefined ? Boolean(body.isMajor) : undefined,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      showOnOverview: body.showOnOverview !== undefined ? Boolean(body.showOnOverview) : undefined,
      visibility: body.visibility ? String(body.visibility) : undefined,
      sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
    });
    return NextResponse.json({ award: row });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create award");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const awardId = url.searchParams.get("id");
    if (!awardId) {
      return NextResponse.json({ error: "Missing award id" }, { status: 400 });
    }
    const ok = await deleteCoachAward(awardId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to delete award");
  }
}
