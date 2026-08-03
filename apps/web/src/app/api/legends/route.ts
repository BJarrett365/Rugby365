import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listPublicLegends, getPublicLegendsHub } from "@/lib/public-legends-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("hub") === "1") {
      const hub = await getPublicLegendsHub();
      return NextResponse.json(hub);
    }
    const legends = await listPublicLegends({
      era: searchParams.get("era"),
      collection: searchParams.get("collection"),
      search: searchParams.get("q") ?? searchParams.get("search"),
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return NextResponse.json({ legends, total: legends.length });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load legends");
  }
}
