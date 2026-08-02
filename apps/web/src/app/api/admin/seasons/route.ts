import { NextResponse } from "next/server";
import { listAllSeasons } from "@/lib/competition-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const competitionId = new URL(req.url).searchParams.get("competitionId") ?? undefined;
    const result = await listAllSeasons(competitionId);
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to list seasons");
  }
}
