import { NextResponse } from "next/server";
import {
  getPublicTransferFilterOptions,
  groupTransfersByTeam,
  listPublicTransfers,
} from "@/lib/public-transfers-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");

    if (mode === "filters") {
      const options = await getPublicTransferFilterOptions({
        competitionId: searchParams.get("competitionId"),
        seasonId: searchParams.get("seasonId"),
      });
      return NextResponse.json(options);
    }

    const result = await listPublicTransfers({
      seasonId: searchParams.has("seasonId") ? searchParams.get("seasonId") : undefined,
      competitionId: searchParams.has("competitionId")
        ? searchParams.get("competitionId")
        : undefined,
      teamId: searchParams.get("teamId"),
      teamQuery: searchParams.get("team"),
      movementType: searchParams.get("movementType"),
      search: searchParams.get("search"),
      sortDir: searchParams.get("sortDir") === "asc" ? "asc" : "desc",
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 200,
    });

    const view = searchParams.get("view") === "teams" ? "teams" : "date";
    return NextResponse.json({
      ...result,
      view,
      groups:
        view === "teams"
          ? groupTransfersByTeam(result.transfers, {
              teamId: searchParams.get("teamId"),
              teamQuery: searchParams.get("team"),
              search: searchParams.get("search"),
            })
          : undefined,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load transfers");
  }
}
