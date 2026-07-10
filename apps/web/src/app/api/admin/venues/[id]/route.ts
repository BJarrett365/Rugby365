import { NextResponse } from "next/server";
import { deleteVenue, getVenueDetail, updateVenue } from "@/lib/venue-admin-service";
import { enrichVenueFromWikipediaAndWait } from "@/lib/venue-wikipedia-enrich";
import { ensureVenueCapacityInDatabase } from "@/lib/venue-capacity-sync-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getVenueDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load venue");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "enrich-wikipedia") {
      const result = await enrichVenueFromWikipediaAndWait(id);
      if (!result.enriched) {
        return NextResponse.json({ error: result.reason ?? "Wikipedia enrich failed", result }, { status: 404 });
      }
      const detail = await getVenueDetail(id);
      return NextResponse.json({ result, venue: detail?.venue });
    }

    if (body.action === "sync-capacity") {
      const capacity =
        body.capacity != null && body.capacity !== "" ? Number(body.capacity) : undefined;
      const result = await ensureVenueCapacityInDatabase(id, {
        capacity: Number.isFinite(capacity) ? capacity : undefined,
        sourceProvider: typeof body.sourceProvider === "string" ? body.sourceProvider : undefined,
      });
      const detail = await getVenueDetail(id);
      return NextResponse.json({ result, venue: detail?.venue });
    }

    const venue = await updateVenue(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.city !== undefined ? { city: String(body.city) } : {}),
      ...(body.countryName !== undefined ? { countryName: String(body.countryName) } : {}),
      ...(body.capacity !== undefined
        ? { capacity: body.capacity === null ? null : Number(body.capacity) }
        : {}),
      ...(body.teamId !== undefined ? { teamId: body.teamId ? String(body.teamId) : null } : {}),
    });
    return NextResponse.json({ venue });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update venue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteVenue(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete venue";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
