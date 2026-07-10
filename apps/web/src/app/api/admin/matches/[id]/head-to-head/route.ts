import { NextResponse } from "next/server";
import { compareFixtureHeadToHead } from "@/lib/head-to-head-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const comparison = await compareFixtureHeadToHead(id);
    return NextResponse.json(comparison);
  } catch (e) {
    return apiErrorResponse(e, "Failed to compare head-to-head data");
  }
}
