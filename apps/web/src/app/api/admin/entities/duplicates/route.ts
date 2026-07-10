import { NextResponse } from "next/server";
import {
  duplicateEntityCounts,
  findDuplicatePlayers,
  findDuplicateTeams,
} from "@/lib/entity-dedup-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const detail = searchParams.get("detail") === "1";

    if (detail) {
      const [players, teams] = await Promise.all([findDuplicatePlayers(), findDuplicateTeams()]);
      return NextResponse.json({ players, teams });
    }

    const counts = await duplicateEntityCounts();
    return NextResponse.json(counts);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load duplicate entities");
  }
}
