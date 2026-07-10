import { NextResponse } from "next/server";
import { normalizeInjuryStatus } from "@/lib/availability-types";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  createInjury,
  deleteInjury,
  getInjuryById,
  listInjuries,
  updateInjury,
} from "@/lib/injury-admin-service";
import {
  queueAvailabilityBioRefresh,
  resolveAvailabilityBioTrigger,
} from "@/lib/player-availability-bio-triggers";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const injuries = await listInjuries({
      playerId: searchParams.get("playerId") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      seasonId: searchParams.get("seasonId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });
    return NextResponse.json({ injuries });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list injuries");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const row = await createInjury({
      playerId: String(body.playerId ?? ""),
      teamId: body.teamId ? String(body.teamId) : null,
      seasonId: body.seasonId ? String(body.seasonId) : null,
      injuryType: body.injuryType ? String(body.injuryType) : null,
      bodyArea: body.bodyArea ? String(body.bodyArea) : null,
      injuryDate: body.injuryDate ? String(body.injuryDate) : null,
      dateReported: body.dateReported ? String(body.dateReported) : null,
      expectedReturnDate: body.expectedReturnDate ? String(body.expectedReturnDate) : null,
      actualReturnDate: body.actualReturnDate ? String(body.actualReturnDate) : null,
      status: normalizeInjuryStatus(body.status ? String(body.status) : undefined),
      matchesMissed: body.matchesMissed != null ? Number(body.matchesMissed) : undefined,
      source: body.source ? String(body.source) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      notes: body.notes ? String(body.notes) : null,
      lastVerifiedDate: body.lastVerifiedDate ? String(body.lastVerifiedDate) : null,
    });

    const trigger = resolveAvailabilityBioTrigger({
      kind: "injury",
      nextStatus: row.status,
    });
    if (trigger) {
      await queueAvailabilityBioRefresh({ playerId: row.playerId, trigger });
    }

    return NextResponse.json({ injury: row }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create injury";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const previous = await getInjuryById(id);
    const row = await updateInjury(id, {
      teamId: body.teamId !== undefined ? (body.teamId ? String(body.teamId) : null) : undefined,
      seasonId: body.seasonId !== undefined ? (body.seasonId ? String(body.seasonId) : null) : undefined,
      injuryType: body.injuryType !== undefined ? String(body.injuryType) : undefined,
      bodyArea: body.bodyArea !== undefined ? String(body.bodyArea) : undefined,
      injuryDate: body.injuryDate !== undefined ? String(body.injuryDate) : undefined,
      dateReported: body.dateReported !== undefined ? String(body.dateReported) : undefined,
      expectedReturnDate:
        body.expectedReturnDate !== undefined ? String(body.expectedReturnDate) : undefined,
      actualReturnDate:
        body.actualReturnDate !== undefined ? String(body.actualReturnDate) : undefined,
      status:
        body.status !== undefined
          ? normalizeInjuryStatus(String(body.status))
          : undefined,
      matchesMissed: body.matchesMissed !== undefined ? Number(body.matchesMissed) : undefined,
      source: body.source !== undefined ? String(body.source) : undefined,
      sourceUrl: body.sourceUrl !== undefined ? String(body.sourceUrl) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      lastVerifiedDate:
        body.lastVerifiedDate !== undefined ? String(body.lastVerifiedDate) : undefined,
    });

    const trigger = resolveAvailabilityBioTrigger({
      kind: "injury",
      previousStatus: previous?.status,
      nextStatus: row.status,
      expectedReturnDateChanged:
        previous?.expectedReturnDate !== row.expectedReturnDate,
    });
    if (trigger) {
      await queueAvailabilityBioRefresh({ playerId: row.playerId, trigger });
    }

    return NextResponse.json({ injury: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update injury";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteInjury(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete injury";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
