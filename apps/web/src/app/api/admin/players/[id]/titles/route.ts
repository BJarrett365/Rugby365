import { NextResponse } from "next/server";
import {
  createPlayerTitle,
  deletePlayerTitle,
  listPlayerTitles,
} from "@/lib/player-titles-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const titles = await listPlayerTitles(id);
    return NextResponse.json({ titles });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load titles");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    if (!body.title || !String(body.title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const title = await createPlayerTitle({
      playerId: id,
      titleType: body.titleType ? String(body.titleType) : "other",
      title: String(body.title),
      seasonLabel: body.seasonLabel ? String(body.seasonLabel) : null,
      year:
        body.year === null || body.year === undefined || body.year === ""
          ? null
          : Number(body.year),
      count:
        body.count === null || body.count === undefined || body.count === ""
          ? 1
          : Number(body.count),
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      visibility: body.visibility ? String(body.visibility) : "public",
    });
    return NextResponse.json({ title });
  } catch (e) {
    return apiErrorResponse(e, "Failed to create title");
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const titleId = url.searchParams.get("id");
    if (!titleId) {
      return NextResponse.json({ error: "Missing title id" }, { status: 400 });
    }
    const ok = await deletePlayerTitle(titleId, id);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiErrorResponse(e, "Failed to delete title");
  }
}
