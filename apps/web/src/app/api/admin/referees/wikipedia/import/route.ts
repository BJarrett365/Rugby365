import { NextResponse } from "next/server";
import { importRefereeFromWikipedia } from "@/lib/referee-wikipedia-import-service";
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

    const defaultCountryName =
      typeof body.defaultCountryName === "string" && body.defaultCountryName.trim()
        ? body.defaultCountryName.trim()
        : undefined;

    const result = await importRefereeFromWikipedia({
      articleTitleOrUrl: articleTitleOrUrl.trim(),
      defaultCountryName,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to import referee from Wikipedia");
  }
}
