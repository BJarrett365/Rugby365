import { NextResponse } from "next/server";
import { previewRugbyPassPlayer } from "@/lib/rugbypass-player-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

const DEFAULT_URL = "https://www.rugbypass.com/players/pierre-schoeman/";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceUrl = searchParams.get("url")?.trim() || DEFAULT_URL;
    const preview = await previewRugbyPassPlayer(sourceUrl);
    return NextResponse.json({ kind: "player", ...preview });
  } catch (e) {
    return apiErrorResponse(e, "Failed to parse RugbyPass player");
  }
}
