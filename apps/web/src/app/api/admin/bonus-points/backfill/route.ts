import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { backfillFixtureBonusPoints } from "@/lib/fixture-bonus-points-service";

/** Recompute and store try / losing bonus points on completed fixtures. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      force?: boolean;
    };
    const result = await backfillFixtureBonusPoints({
      limit: body.limit,
      force: body.force === true,
    });
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to backfill fixture bonus points");
  }
}
