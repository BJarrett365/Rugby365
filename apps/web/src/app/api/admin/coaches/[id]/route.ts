import { NextResponse } from "next/server";
import {
  deleteCoach,
  getCoachDetail,
  updateCoach,
} from "@/lib/coach-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getCoachDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load coach");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "enrich-wikipedia") {
      const { enrichCoachFromWikipedia } = await import("@/lib/coach-wikipedia-import-service");
      const result = await enrichCoachFromWikipedia(id);
      const detail = await getCoachDetail(id);
      return NextResponse.json({ ok: true, ...result, detail });
    }

    const coach = await updateCoach(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate ? String(body.birthDate) : null } : {}),
      ...(body.nationality !== undefined ? { nationality: body.nationality ? String(body.nationality) : null } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl ? String(body.imageUrl) : null } : {}),
      ...(body.bioSummary !== undefined ? { bioSummary: body.bioSummary ? String(body.bioSummary) : null } : {}),
      ...(body.wikipediaUrl !== undefined ? { wikipediaUrl: body.wikipediaUrl ? String(body.wikipediaUrl) : null } : {}),
      ...(body.wikidataId !== undefined ? { wikidataId: body.wikidataId ? String(body.wikidataId) : null } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      ...(body.socialAccounts !== undefined && typeof body.socialAccounts === "object"
        ? { socialAccounts: body.socialAccounts as Record<string, string | null> }
        : {}),
    });
    return NextResponse.json({ coach });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update coach";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCoach(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete coach";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
