import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  auditPlayerWikipediaGaps,
  fillPlayerWikipediaMissingFields,
} from "@/lib/player-wikipedia-gap-service";

/**
 * GET — audit missing DOB / place / height / weight / socials vs wiki fill targets.
 * POST — fill missing fields only from Wikipedia + Wikidata (no create, no overwrite).
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sampleSize = url.searchParams.get("sample")
      ? Number(url.searchParams.get("sample"))
      : 40;
    const audit = await auditPlayerWikipediaGaps({ sampleSize });
    return NextResponse.json(audit);
  } catch (e) {
    return apiErrorResponse(e, "Failed to audit Wikipedia player gaps");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      preferLinked?: boolean;
      delayMs?: number;
      dryRun?: boolean;
    };

    if (body.dryRun) {
      const audit = await auditPlayerWikipediaGaps({
        sampleSize: body.limit ?? 40,
        limit: body.limit,
      });
      return NextResponse.json({ dryRun: true, audit });
    }

    const summary = await fillPlayerWikipediaMissingFields({
      limit: typeof body.limit === "number" ? body.limit : 50,
      preferLinked: body.preferLinked !== false,
      delayMs: typeof body.delayMs === "number" ? body.delayMs : 500,
    });
    return NextResponse.json(summary);
  } catch (e) {
    return apiErrorResponse(e, "Failed to fill Wikipedia player gaps");
  }
}
