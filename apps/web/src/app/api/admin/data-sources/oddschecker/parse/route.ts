import { NextResponse } from "next/server";
import { previewOddschecker } from "@/lib/oddschecker-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

const DEFAULT_URL = "https://www.oddschecker.com/rugby-union";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      html?: string;
    };
    const sourceUrl = (body.url ?? DEFAULT_URL).trim();
    const html = body.html?.trim() || undefined;
    const preview = await previewOddschecker(sourceUrl, { html });
    return NextResponse.json({ preview });
  } catch (e) {
    return apiErrorResponse(e, "Oddschecker preview failed");
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceUrl = (searchParams.get("url") ?? DEFAULT_URL).trim();
  try {
    const preview = await previewOddschecker(sourceUrl);
    return NextResponse.json({ preview });
  } catch (e) {
    return apiErrorResponse(e, "Oddschecker preview failed");
  }
}
