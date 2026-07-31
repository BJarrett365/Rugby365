import { NextResponse } from "next/server";
import { previewBmbets } from "@/lib/bmbets-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url?.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const preview = await previewBmbets(url.trim());
    return NextResponse.json({ preview });
  } catch (e) {
    return apiErrorResponse(e, "BMbets parse failed");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string; html?: string };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const preview = await previewBmbets(body.url.trim(), {
      html: body.html?.trim() || undefined,
    });
    return NextResponse.json({ preview });
  } catch (e) {
    return apiErrorResponse(e, "BMbets parse failed");
  }
}
