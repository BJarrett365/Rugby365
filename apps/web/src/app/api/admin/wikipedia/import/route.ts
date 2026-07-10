import { NextResponse } from "next/server";
import { WikipediaEntityTypeSchema } from "@rugby365/import-sdk";
import { importWikipediaArchive } from "@/lib/wikipedia-import-service";
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

    const entityTypeRaw = body.entityType ?? "auto";
    const entityType = WikipediaEntityTypeSchema.safeParse(entityTypeRaw);
    if (!entityType.success) {
      return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
    }

    const linkEntityId =
      typeof body.linkEntityId === "string" && body.linkEntityId.trim()
        ? body.linkEntityId.trim()
        : undefined;

    const result = await importWikipediaArchive({
      articleTitleOrUrl,
      entityType: entityType.data,
      linkEntityId,
    });

    return NextResponse.json({
      ok: true,
      entityType: result.entityType,
      entityId: result.entityId,
      slug: result.slug,
      created: result.created,
      careerStints: "careerStints" in result ? result.careerStints : undefined,
      wikipediaUrl: result.archive.wikipediaUrl,
      source: result.archive.source,
    });
  } catch (e) {
    return apiErrorResponse(e, "Wikipedia import failed");
  }
}
