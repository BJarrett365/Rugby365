import { NextResponse } from "next/server";
import { previewCoachWikipediaHonours } from "@/lib/coach-wikipedia-import-service";
import { createCoachHonour } from "@/lib/coach-history-cms-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await previewCoachWikipediaHonours(id);
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to preview Wikipedia honours");
  }
}

/** Accept a proposed honour into CMS as unverified (never auto-verified). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as {
      competitionName: string;
      year: number;
      achievementType?: string;
      roleType?: string;
      honourLevel?: string;
      shared?: boolean;
      sourceLine?: string;
    };
    const row = await createCoachHonour(id, {
      competitionName: body.competitionName,
      year: body.year,
      achievementType: body.achievementType ?? "winner",
      roleType: body.roleType ?? "coach",
      honourLevel: body.honourLevel ?? "secondary",
      shared: body.shared ?? false,
      sourceUrl: body.sourceLine ? `wikipedia:${body.sourceLine}` : null,
      showOnOverview: false,
    });
    return NextResponse.json({ honour: row });
  } catch (e) {
    return apiErrorResponse(e, "Failed to accept honour");
  }
}
