import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getCoachDetail } from "@/lib/coach-admin-service";
import { listCoachPlayingStints } from "@/lib/coach-history-cms-service";
import { listCoachHonours, listCoachAwards } from "@/lib/coach-history-cms-service";

type CheckMode = "full" | "missing";

/**
 * Identity / profile field check against what we already store.
 * External source enrichment remains on check-career + enrich endpoints.
 * This powers CHECK DATA / FIND MISSING DATA for the CMS workflow header.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { mode?: CheckMode };
    const mode: CheckMode = body.mode === "missing" ? "missing" : "full";

    const detail = await getCoachDetail(id);
    if (!detail) return NextResponse.json({ error: "Coach not found" }, { status: 404 });

    const [playing, honours, awards] = await Promise.all([
      listCoachPlayingStints(id),
      listCoachHonours(id),
      listCoachAwards(id),
    ]);

    const c = detail.coach;
    const current = detail.assignments.find((a) => a.isCurrent);

    const fields: Array<{
      key: string;
      label: string;
      kind: "editorial" | "verified" | "auto";
      currentValue: string | null;
      status: "complete" | "missing" | "partial";
      confidence: string;
      source: string | null;
    }> = [
      {
        key: "name",
        label: "Display name",
        kind: "editorial",
        currentValue: c.name,
        status: c.name?.trim() ? "complete" : "missing",
        confidence: "high",
        source: "cms",
      },
      {
        key: "birthDate",
        label: "Date of birth",
        kind: "verified",
        currentValue: c.birthDate,
        status: c.birthDate ? "complete" : "missing",
        confidence: c.birthDate ? "high" : "low",
        source: c.wikipediaUrl || c.sourceUrl,
      },
      {
        key: "placeOfBirth",
        label: "Birthplace",
        kind: "verified",
        currentValue: c.placeOfBirth,
        status: c.placeOfBirth ? "complete" : "missing",
        confidence: c.placeOfBirth ? "medium" : "low",
        source: c.wikipediaUrl || null,
      },
      {
        key: "heightCm",
        label: "Height",
        kind: "verified",
        currentValue: c.heightCm != null ? String(c.heightCm) : null,
        status: c.heightCm != null ? "complete" : "missing",
        confidence: c.heightCm != null ? "medium" : "low",
        source: c.wikipediaUrl || null,
      },
      {
        key: "imageUrl",
        label: "Profile image",
        kind: "editorial",
        currentValue: c.imageUrl,
        status: c.imageUrl ? "complete" : "missing",
        confidence: c.imageUrl ? "high" : "low",
        source: "cms",
      },
      {
        key: "contractExpiresOn",
        label: "Contract",
        kind: "verified",
        currentValue: c.contractExpiresOn,
        status: c.contractExpiresOn ? "complete" : "missing",
        confidence: c.contractExpiresOn ? "high" : "low",
        source: "cms",
      },
      {
        key: "currentRole",
        label: "Current role",
        kind: "verified",
        currentValue: current ? `${current.roleLabel} · ${current.teamName}` : null,
        status: current ? "complete" : "missing",
        confidence: current ? "high" : "low",
        source: current?.sourceUrl || null,
      },
      {
        key: "playingCareer",
        label: "Playing career",
        kind: "verified",
        currentValue: `${playing.length} stints`,
        status: playing.length === 0 ? "missing" : playing.length < 3 ? "partial" : "complete",
        confidence: playing.length ? "high" : "low",
        source: "cms",
      },
      {
        key: "coachingCareer",
        label: "Coaching career",
        kind: "verified",
        currentValue: `${detail.assignments.length} assignments`,
        status:
          detail.assignments.length === 0
            ? "missing"
            : detail.assignments.length < 4
              ? "partial"
              : "complete",
        confidence: detail.assignments.length ? "high" : "low",
        source: "cms",
      },
      {
        key: "honours",
        label: "Honours",
        kind: "verified",
        currentValue: `${honours.length} honours`,
        status: honours.length === 0 ? "missing" : "complete",
        confidence: honours.length ? "high" : "low",
        source: "cms",
      },
      {
        key: "awards",
        label: "Awards",
        kind: "verified",
        currentValue: `${awards.length} awards`,
        status: awards.length === 0 ? "missing" : "complete",
        confidence: awards.length ? "high" : "low",
        source: "cms",
      },
      {
        key: "preferredSystem",
        label: "Preferred system",
        kind: "editorial",
        currentValue: c.preferredSystem,
        status: c.preferredSystem ? "complete" : "missing",
        confidence: "medium",
        source: "cms",
      },
      {
        key: "coachingStyle",
        label: "Coaching style",
        kind: "editorial",
        currentValue: c.coachingStyle,
        status: c.coachingStyle ? "complete" : "missing",
        confidence: "medium",
        source: "cms",
      },
    ];

    const rows =
      mode === "missing"
        ? fields.filter((f) => f.status === "missing" || f.status === "partial")
        : fields;

    const complete = fields.filter((f) => f.status === "complete").length;
    const missing = fields.filter((f) => f.status === "missing").length;
    const partial = fields.filter((f) => f.status === "partial").length;

    return NextResponse.json({
      ok: true,
      mode,
      checkedAt: new Date().toISOString(),
      summary: {
        complete,
        missing,
        partial,
        total: fields.length,
      },
      rows: rows.map((r) => ({
        kind: r.key,
        label: r.label,
        fieldKind: r.kind,
        status: r.status,
        confidence: r.confidence,
        source: r.source,
        rugby365Value: { value: r.currentValue },
        foundValue: null,
        action: r.status === "complete" ? "ignore" : "review",
      })),
      note:
        mode === "missing"
          ? "Only incomplete fields listed. Use Check career / Wikipedia for external research."
          : "Profile inventory vs Rugby365 store. Use Check career for Wikipedia diffs.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to run profile check");
  }
}
