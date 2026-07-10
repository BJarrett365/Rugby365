import { NextResponse } from "next/server";
import {
  importCoachesFromWikipediaCategory,
  importInternationalCoachCategories,
  previewCoachWikipediaCategory,
} from "@/lib/coach-wikipedia-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? searchParams.get("url") ?? "";
    if (!category.trim()) {
      return NextResponse.json({ error: "category or url is required" }, { status: 400 });
    }
    const preview = await previewCoachWikipediaCategory(category.trim());
    return NextResponse.json(preview);
  } catch (e) {
    return apiErrorResponse(e, "Failed to preview Wikipedia coach category");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.importAll === true) {
      const result = await importInternationalCoachCategories();
      return NextResponse.json({ ok: true, ...result });
    }

    const categoryTitleOrUrl =
      typeof body.categoryTitleOrUrl === "string"
        ? body.categoryTitleOrUrl
        : typeof body.url === "string"
          ? body.url
          : "";
    if (!categoryTitleOrUrl.trim()) {
      return NextResponse.json({ error: "categoryTitleOrUrl is required" }, { status: 400 });
    }

    const linkTeamId =
      typeof body.linkTeamId === "string" && body.linkTeamId.trim() ? body.linkTeamId.trim() : undefined;
    const countryName =
      typeof body.countryName === "string" && body.countryName.trim() ? body.countryName.trim() : undefined;

    const result = await importCoachesFromWikipediaCategory({
      categoryTitleOrUrl: categoryTitleOrUrl.trim(),
      linkTeamId,
      countryName,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to import coaches from Wikipedia category");
  }
}
