import { NextResponse } from "next/server";
import { parseSport365Source } from "@/lib/sport365-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

const DEFAULT_MATCH_URL =
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";
const DEFAULT_TOURNAMENT_URL = "https://www.sport365.com/rugby-union/international/men";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceUrl = searchParams.get("url") ?? DEFAULT_MATCH_URL;
  const mode = searchParams.get("mode");

  try {
    const url =
      mode === "tournament" && !searchParams.get("url") ? DEFAULT_TOURNAMENT_URL : sourceUrl;
    const preview = await parseSport365Source(url);
    return NextResponse.json(preview);
  } catch (e) {
    return apiErrorResponse(e, "Sport365 parse failed");
  }
}
