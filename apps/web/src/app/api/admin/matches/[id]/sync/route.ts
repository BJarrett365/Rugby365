import { NextResponse } from "next/server";
import { syncFixtureFromSport365 } from "@/lib/sport365-import-service";
import { getFixtureAdminDetail } from "@/lib/fixture-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = (await req.json().catch(() => ({}))) as { importEvents?: boolean };
    const result = await syncFixtureFromSport365(id, { importEvents: body.importEvents });
    const detail = await getFixtureAdminDetail(id);
    return NextResponse.json({ ...result, detail });
  } catch (e) {
    return apiErrorResponse(e, "Sync failed");
  }
}
