import { NextResponse } from "next/server";
import { listFixtureSquads } from "@/lib/entity-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const squads = await listFixtureSquads();
    return NextResponse.json({ squads });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list squads");
  }
}
