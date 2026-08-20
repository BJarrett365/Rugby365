import { NextResponse } from "next/server";
import {
  deleteCoach,
  getCoachDetail,
  updateCoach,
} from "@/lib/coach-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

function optStr(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return String(value);
}

function optInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function optBool(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return Boolean(value);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await getCoachDetail(id);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load coach");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "enrich-wikipedia") {
      const { enrichCoachFromWikipedia } = await import("@/lib/coach-wikipedia-import-service");
      const result = await enrichCoachFromWikipedia(id, {
        ...(body.sourceUrl ? { sourceUrl: String(body.sourceUrl) } : {}),
      });
      const detail = await getCoachDetail(id);
      if (!result.enriched && result.reason && result.reason !== "matched_no_new_data") {
        return NextResponse.json(
          { ok: false, ...result, detail },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true, ...result, detail });
    }

    if (body.action === "enrich-rugbypass") {
      const { enrichCoachFromRugbyPass } = await import("@/lib/rugbypass-coach-import-service");
      const result = await enrichCoachFromRugbyPass(
        id,
        body.sourceUrl ? String(body.sourceUrl) : undefined,
      );
      const detail = await getCoachDetail(id);
      if (!result.enriched) {
        return NextResponse.json({ ok: false, ...result, detail }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ...result, detail });
    }

    if (body.action === "recalculate-ratings") {
      const { persistCoachRatingSnapshot } = await import("@/lib/coach-rating-service");
      const ratings = await persistCoachRatingSnapshot(id);
      return NextResponse.json({ ok: true, ratings });
    }

    if (body.action === "coach-intelligence") {
      const { calculateCoachRatingBundle } = await import("@/lib/coach-rating-service");
      const ratings = await calculateCoachRatingBundle(id);
      return NextResponse.json({
        ok: true,
        intelligence: ratings.intelligence,
        intelligenceModelVersion: ratings.intelligenceModelVersion,
        metrics: ratings.metrics,
        overallRating: ratings.overallRating,
        powerIndex: ratings.powerIndex,
        ratings,
      });
    }

    if (body.action === "refresh-match-links") {
      const { refreshCoachMatchLinks } = await import("@/lib/coach-match-link-service");
      const links = await refreshCoachMatchLinks(id, { overwrite: true });
      return NextResponse.json({ ok: true, links });
    }

    if (body.action === "recalculate-all" || body.action === "backfill-coach-data") {
      const { recalculateCoach } = await import("@/lib/coach-recalc-service");
      const result = await recalculateCoach(id, {
        refreshLinks: true,
        persistRatings: true,
        overwriteLinks: true,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "data-coverage") {
      const { getCoachDataCoverage } = await import("@/lib/coach-recalc-service");
      const coverage = await getCoachDataCoverage(id);
      return NextResponse.json({ ok: true, coverage });
    }

    if (body.action === "recalculate-impact") {
      const { getCoachImpact } = await import("@/lib/coach-career-record-service");
      const impact = await getCoachImpact(id);
      return NextResponse.json({ ok: true, impact });
    }

    if (body.action === "career-record") {
      const { getCoachCareerRecord } = await import("@/lib/coach-career-record-service");
      const careerRecord = await getCoachCareerRecord(id);
      return NextResponse.json({ ok: true, careerRecord });
    }

    if (body.action === "verify") {
      const coach = await updateCoach(id, { verify: true });
      return NextResponse.json({ coach });
    }

    const coach = await updateCoach(id, {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.slug !== undefined ? { slug: String(body.slug) } : {}),
      ...(body.knownAs !== undefined ? { knownAs: optStr(body.knownAs) } : {}),
      ...(body.fullName !== undefined ? { fullName: optStr(body.fullName) } : {}),
      ...(body.birthDate !== undefined ? { birthDate: optStr(body.birthDate) } : {}),
      ...(body.placeOfBirth !== undefined ? { placeOfBirth: optStr(body.placeOfBirth) } : {}),
      ...(body.countryOfBirth !== undefined ? { countryOfBirth: optStr(body.countryOfBirth) } : {}),
      ...(body.nationality !== undefined ? { nationality: optStr(body.nationality) } : {}),
      ...(body.secondNationality !== undefined
        ? { secondNationality: optStr(body.secondNationality) }
        : {}),
      ...(body.heightCm !== undefined ? { heightCm: optInt(body.heightCm) } : {}),
      ...(body.formerPlayingPositions !== undefined
        ? { formerPlayingPositions: optStr(body.formerPlayingPositions) }
        : {}),
      ...(body.playingCareerStatus !== undefined
        ? { playingCareerStatus: optStr(body.playingCareerStatus) }
        : {}),
      ...(body.coachingCareerStartYear !== undefined
        ? { coachingCareerStartYear: optInt(body.coachingCareerStartYear) }
        : {}),
      ...(body.appointedOn !== undefined ? { appointedOn: optStr(body.appointedOn) } : {}),
      ...(body.contractExpiresOn !== undefined
        ? { contractExpiresOn: optStr(body.contractExpiresOn) }
        : {}),
      ...(body.preferredSystem !== undefined ? { preferredSystem: optStr(body.preferredSystem) } : {}),
      ...(body.coachingStyle !== undefined ? { coachingStyle: optStr(body.coachingStyle) } : {}),
      ...(body.preferredSystemProvenance !== undefined
        ? { preferredSystemProvenance: String(body.preferredSystemProvenance) }
        : {}),
      ...(body.coachingStyleProvenance !== undefined
        ? { coachingStyleProvenance: String(body.coachingStyleProvenance) }
        : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: optStr(body.imageUrl) } : {}),
      ...(body.bioSummary !== undefined ? { bioSummary: optStr(body.bioSummary) } : {}),
      ...(body.wikipediaUrl !== undefined ? { wikipediaUrl: optStr(body.wikipediaUrl) } : {}),
      ...(body.wikidataId !== undefined ? { wikidataId: optStr(body.wikidataId) } : {}),
      ...(body.sourceUrl !== undefined ? { sourceUrl: optStr(body.sourceUrl) } : {}),
      ...(body.notes !== undefined ? { notes: optStr(body.notes) } : {}),
      ...(body.isPublic !== undefined ? { isPublic: Boolean(body.isPublic) } : {}),
      ...(body.publishStatus !== undefined
        ? { publishStatus: String(body.publishStatus || "published") }
        : {}),
      ...(body.seoTitle !== undefined ? { seoTitle: optStr(body.seoTitle) } : {}),
      ...(body.seoDescription !== undefined ? { seoDescription: optStr(body.seoDescription) } : {}),
      ...(body.ogImageUrl !== undefined ? { ogImageUrl: optStr(body.ogImageUrl) } : {}),
      ...(body.careerRecordPartial !== undefined
        ? { careerRecordPartial: Boolean(body.careerRecordPartial) }
        : {}),
      ...(body.careerRecordNotes !== undefined
        ? { careerRecordNotes: optStr(body.careerRecordNotes) }
        : {}),
      ...(body.lastVerifiedAt !== undefined
        ? { lastVerifiedAt: body.lastVerifiedAt ? String(body.lastVerifiedAt) : null }
        : {}),
      ...(optBool(body.verify) === true ? { verify: true } : {}),
      ...(body.socialAccounts !== undefined && typeof body.socialAccounts === "object"
        ? { socialAccounts: body.socialAccounts as Record<string, string | null> }
        : {}),
    });
    return NextResponse.json({ coach });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update coach";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteCoach(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete coach";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
