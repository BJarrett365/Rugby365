import { NextResponse } from "next/server";
import { createVenue, listVenues } from "@/lib/venue-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const venues = await listVenues();
    return NextResponse.json({ venues });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list venues");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const venue = await createVenue({
      name: String(body.name ?? ""),
      slug: body.slug ? String(body.slug) : undefined,
      city: body.city ? String(body.city) : undefined,
      countryName: body.countryName ? String(body.countryName) : undefined,
      capacity: body.capacity !== undefined ? Number(body.capacity) : undefined,
      teamId: body.teamId ? String(body.teamId) : undefined,
    });
    return NextResponse.json({ venue }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create venue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
