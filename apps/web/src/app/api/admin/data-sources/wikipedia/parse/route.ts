import { NextResponse } from "next/server";
import { WikipediaEntityTypeSchema } from "@rugby365/import-sdk";
import { previewWikipediaArchive } from "@/lib/wikipedia-import-service";
import { getWikimediaEnterprisePublicConfig } from "@/lib/integration-settings-service";
import { apiErrorResponse } from "@/lib/api-errors";

const DEFAULT_URL = "https://en.wikipedia.org/wiki/Blair_Kinghorn";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const article = searchParams.get("url") ?? searchParams.get("article") ?? DEFAULT_URL;
  const entityTypeRaw = searchParams.get("entityType") ?? "auto";

  const entityType = WikipediaEntityTypeSchema.safeParse(entityTypeRaw);
  if (!entityType.success) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }

  try {
    const [preview, credentials] = await Promise.all([
      previewWikipediaArchive({
        articleTitleOrUrl: article,
        entityType: entityType.data,
      }),
      getWikimediaEnterprisePublicConfig(),
    ]);

    return NextResponse.json({
      ...preview,
      credentialsConfigured: credentials.configured,
      usingEnterpriseApi: preview.source === "wikimedia_enterprise",
    });
  } catch (e) {
    return apiErrorResponse(e, "Wikipedia parse failed");
  }
}
