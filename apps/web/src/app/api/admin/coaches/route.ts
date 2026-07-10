import { NextResponse } from "next/server";
import { createCoach, listCoaches } from "@/lib/coach-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? undefined;
    const countryTeamId = searchParams.get("countryTeamId") ?? undefined;
    const coaches = await listCoaches({ search, countryTeamId });
    return NextResponse.json({ coaches });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list coaches");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const coach = await createCoach({
      name: String(body.name ?? ""),
      slug: body.slug ? String(body.slug) : undefined,
      birthDate: body.birthDate ? String(body.birthDate) : null,
      nationality: body.nationality ? String(body.nationality) : null,
      imageUrl: body.imageUrl ? String(body.imageUrl) : null,
      bioSummary: body.bioSummary ? String(body.bioSummary) : null,
      wikipediaUrl: body.wikipediaUrl ? String(body.wikipediaUrl) : null,
      wikidataId: body.wikidataId ? String(body.wikidataId) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      notes: body.notes ? String(body.notes) : null,
      externalProviderId: body.externalProviderId ? String(body.externalProviderId) : null,
      socialAccounts:
        body.socialAccounts && typeof body.socialAccounts === "object"
          ? (body.socialAccounts as Record<string, string | null>)
          : undefined,
    });
    return NextResponse.json({ coach }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create coach";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
