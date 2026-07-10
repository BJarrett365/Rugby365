import { NextResponse } from "next/server";
import { createReferee, mapEntitiesFromMatches } from "@/lib/entity-admin-service";
import { listRefereesWithStats } from "@/lib/referee-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const referees = await listRefereesWithStats();
    return NextResponse.json({ referees });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list referees");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (body.action === "map-from-matches") {
      const result = await mapEntitiesFromMatches();
      return NextResponse.json({ ok: true, ...result });
    }

    const referee = await createReferee({
      name: String(body.name ?? ""),
      slug: body.slug ? String(body.slug) : undefined,
      countryName: body.countryName ? String(body.countryName) : undefined,
      externalProviderId: body.externalProviderId ? String(body.externalProviderId) : undefined,
    });
    return NextResponse.json({ referee }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create referee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
