import { NextResponse } from "next/server";
import { batchCalculateAllPlayerRatings } from "@/lib/player-ratings-batch-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      onlyMissing?: boolean;
      limit?: number;
    };

    const summary = await batchCalculateAllPlayerRatings({
      onlyMissing: body.onlyMissing ?? true,
      onlyWithSquads: true,
      limit: body.limit,
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    return apiErrorResponse(e, "Failed to calculate player ratings");
  }
}
