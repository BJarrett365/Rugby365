import { NextResponse } from "next/server";
import {
  importBmbetsListing,
  listRecentBmbetsOddsSnapshots,
  previewBmbets,
} from "@/lib/bmbets-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const snapshots = await listRecentBmbetsOddsSnapshots(40);
    return NextResponse.json({ snapshots });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list BMbets odds snapshots");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      html?: string;
      action?: "preview" | "import";
    };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    if (body.action === "preview") {
      const preview = await previewBmbets(body.url.trim(), {
        html: body.html?.trim() || undefined,
      });
      return NextResponse.json({ ok: true, preview });
    }

    const result = await importBmbetsListing({
      sourceUrl: body.url.trim(),
      html: body.html?.trim() || undefined,
    });
    return NextResponse.json({
      ok: true,
      imported: result.imported,
      skippedNoFixture: result.skippedNoFixture,
      rejectedLeague: result.rejectedLeague,
      preview: result.preview,
    });
  } catch (e) {
    return apiErrorResponse(e, "BMbets import failed");
  }
}
