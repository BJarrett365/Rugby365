import { NextResponse } from "next/server";
import { importCoachFromWikipedia } from "@/lib/coach-wikipedia-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const articleTitleOrUrl =
      typeof body.articleTitleOrUrl === "string"
        ? body.articleTitleOrUrl
        : typeof body.url === "string"
          ? body.url
          : "";
    if (!articleTitleOrUrl.trim()) {
      return NextResponse.json({ error: "articleTitleOrUrl is required" }, { status: 400 });
    }

    const linkTeamId =
      typeof body.linkTeamId === "string" && body.linkTeamId.trim() ? body.linkTeamId.trim() : undefined;

    const result = await importCoachFromWikipedia({
      articleTitleOrUrl: articleTitleOrUrl.trim(),
      linkTeamId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to import coach from Wikipedia");
  }
}
