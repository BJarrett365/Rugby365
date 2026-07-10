import { NextResponse } from "next/server";
import {
  importRefereesFromWikipediaCategory,
  previewRefereeWikipediaCategory,
} from "@/lib/referee-wikipedia-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? searchParams.get("url") ?? "";
    if (!category.trim()) {
      return NextResponse.json({ error: "category or url is required" }, { status: 400 });
    }
    const preview = await previewRefereeWikipediaCategory(category.trim());
    return NextResponse.json(preview);
  } catch (e) {
    return apiErrorResponse(e, "Failed to preview Wikipedia referee category");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const categoryTitleOrUrl =
      typeof body.categoryTitleOrUrl === "string"
        ? body.categoryTitleOrUrl
        : typeof body.url === "string"
          ? body.url
          : "";
    if (!categoryTitleOrUrl.trim()) {
      return NextResponse.json({ error: "categoryTitleOrUrl is required" }, { status: 400 });
    }

    const defaultCountryName =
      typeof body.defaultCountryName === "string" && body.defaultCountryName.trim()
        ? body.defaultCountryName.trim()
        : undefined;

    const result = await importRefereesFromWikipediaCategory({
      categoryTitleOrUrl: categoryTitleOrUrl.trim(),
      defaultCountryName,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "Failed to import referees from Wikipedia category");
  }
}
