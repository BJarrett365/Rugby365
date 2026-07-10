import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { calculateRugbyTable } from "@/lib/table-lab/table-calculation-service";
import { enrichNationsChampionshipResult } from "@/lib/table-lab/table-hemisphere-service";
import type { RugbyTableBuildContext } from "@/lib/table-lab/table-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      tableId: string;
      context?: RugbyTableBuildContext;
    };
    if (!body.tableId) {
      return NextResponse.json({ error: "tableId is required" }, { status: 400 });
    }
    const result = await calculateRugbyTable(body.tableId, body.context ?? {});
    const enriched = await enrichNationsChampionshipResult(result, body.context?.competitionId);
    return NextResponse.json(enriched);
  } catch (e) {
    return apiErrorResponse(e, "Failed to calculate rugby table");
  }
}
