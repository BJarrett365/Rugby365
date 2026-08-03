import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getCompetitionCatalogAdminView,
  syncCatalogTaxonomyToPopulatedCompetitions,
} from "@/lib/competition-catalog-sync-service";

export async function GET() {
  try {
    const view = await getCompetitionCatalogAdminView();
    return NextResponse.json({ ok: true, ...view });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load competition catalog");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action === "sync-taxonomy") {
      const result = await syncCatalogTaxonomyToPopulatedCompetitions();
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to sync competition catalog");
  }
}
