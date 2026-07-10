import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listTableLabSeasons } from "@/lib/table-lab/table-calculation-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get("competitionId") ?? undefined;
    const seasons = await listTableLabSeasons(competitionId);
    return NextResponse.json({ seasons });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list table lab seasons");
  }
}
