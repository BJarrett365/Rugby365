import { NextResponse } from "next/server";
import { getTeamLegends } from "@/lib/legend-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const era = searchParams.get("era") ?? undefined;
    const legends = await getTeamLegends(id, era);
    return NextResponse.json({ legends });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load team legends");
  }
}
