import { NextResponse } from "next/server";
import { importRugbyPassPlayerByUrl } from "@/lib/rugbypass-player-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sourceUrl = String(body.sourceUrl ?? "").trim();
    if (!sourceUrl) {
      return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
    }

    const linkPlayerId = body.linkPlayerId ? String(body.linkPlayerId) : undefined;
    const result = await importRugbyPassPlayerByUrl(sourceUrl, linkPlayerId);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e, "RugbyPass player import failed");
  }
}
