import { NextResponse } from "next/server";
import {
  importOddscheckerMarket,
  listRecentOddsSnapshots,
} from "@/lib/oddschecker-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const rows = await listRecentOddsSnapshots(40);
    return NextResponse.json({ snapshots: rows });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list odds snapshots");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      html?: string;
      fixtureId?: string | null;
    };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const result = await importOddscheckerMarket({
      sourceUrl: body.url.trim(),
      html: body.html?.trim() || undefined,
      fixtureId: body.fixtureId ?? null,
    });
    return NextResponse.json({
      ok: true,
      snapshotId: result.snapshotId,
      fixtureId: result.fixtureId,
      preview: result.preview,
    });
  } catch (e) {
    return apiErrorResponse(e, "Oddschecker import failed");
  }
}
