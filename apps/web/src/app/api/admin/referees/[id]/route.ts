import { NextResponse } from "next/server";
import { deleteReferee, updateReferee } from "@/lib/entity-admin-service";
import { getRefereeDetail, linkRefereeNameOnlyFixtures } from "@/lib/referee-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getRefereeDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load referee");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "enrich-wikipedia") {
      const { enrichRefereeFromWikipedia } = await import("@/lib/referee-wikipedia-import-service");
      const result = await enrichRefereeFromWikipedia(id);
      const detail = await getRefereeDetail(id);
      return NextResponse.json({ ok: true, ...result, ...detail });
    }

    if (body.action === "link-name-only-fixtures") {
      const result = await linkRefereeNameOnlyFixtures(id);
      const detail = await getRefereeDetail(id);
      return NextResponse.json({ ok: true, ...result, ...detail });
    }

    const socialAccounts =
      body.socialAccounts !== undefined &&
      body.socialAccounts !== null &&
      typeof body.socialAccounts === "object"
        ? (body.socialAccounts as Record<string, unknown>)
        : null;
    const referee = await updateReferee(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.countryName !== undefined ? { countryName: String(body.countryName) } : {}),
      ...(body.nationality !== undefined
        ? { nationality: body.nationality ? String(body.nationality) : null }
        : {}),
      ...(body.birthDate !== undefined ? { birthDate: body.birthDate ? String(body.birthDate) : null } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl ? String(body.imageUrl) : null } : {}),
      ...(body.bioSummary !== undefined ? { bioSummary: body.bioSummary ? String(body.bioSummary) : null } : {}),
      ...(body.wikipediaUrl !== undefined
        ? { wikipediaUrl: body.wikipediaUrl ? String(body.wikipediaUrl) : null }
        : {}),
      ...(body.wikidataId !== undefined ? { wikidataId: body.wikidataId ? String(body.wikidataId) : null } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
      ...(socialAccounts
        ? {
            socialAccounts: {
              twitter:
                "twitter" in socialAccounts && socialAccounts.twitter
                  ? String(socialAccounts.twitter)
                  : null,
              instagram:
                "instagram" in socialAccounts && socialAccounts.instagram
                  ? String(socialAccounts.instagram)
                  : null,
              linkedin:
                "linkedin" in socialAccounts && socialAccounts.linkedin
                  ? String(socialAccounts.linkedin)
                  : null,
              website:
                "website" in socialAccounts && socialAccounts.website
                  ? String(socialAccounts.website)
                  : null,
            },
          }
        : {}),
      ...(body.externalProviderId !== undefined
        ? { externalProviderId: String(body.externalProviderId) }
        : {}),
    });
    return NextResponse.json({ referee });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update referee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteReferee(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete referee";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
