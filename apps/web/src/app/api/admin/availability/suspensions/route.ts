import { NextResponse } from "next/server";
import { normalizeSuspensionStatus } from "@/lib/availability-types";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  queueAvailabilityBioRefresh,
  resolveAvailabilityBioTrigger,
} from "@/lib/player-availability-bio-triggers";
import {
  createSuspension,
  deleteSuspension,
  getSuspensionById,
  listSuspensions,
  updateSuspension,
} from "@/lib/suspension-admin-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const suspensions = await listSuspensions({
      playerId: searchParams.get("playerId") ?? undefined,
      teamId: searchParams.get("teamId") ?? undefined,
      seasonId: searchParams.get("seasonId") ?? undefined,
      competitionId: searchParams.get("competitionId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });
    return NextResponse.json({ suspensions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list suspensions");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const row = await createSuspension({
      playerId: String(body.playerId ?? ""),
      teamId: body.teamId ? String(body.teamId) : null,
      competitionId: body.competitionId ? String(body.competitionId) : null,
      seasonId: body.seasonId ? String(body.seasonId) : null,
      fixtureId: body.fixtureId ? String(body.fixtureId) : null,
      incidentDate: body.incidentDate ? String(body.incidentDate) : null,
      offence: body.offence ? String(body.offence) : null,
      cardType: body.cardType ? String(body.cardType) : null,
      hearingDate: body.hearingDate ? String(body.hearingDate) : null,
      suspensionStart: body.suspensionStart ? String(body.suspensionStart) : null,
      suspensionEnd: body.suspensionEnd ? String(body.suspensionEnd) : null,
      matchesSuspended: body.matchesSuspended != null ? Number(body.matchesSuspended) : null,
      matchesServed: body.matchesServed != null ? Number(body.matchesServed) : undefined,
      matchesRemaining: body.matchesRemaining != null ? Number(body.matchesRemaining) : null,
      status: normalizeSuspensionStatus(body.status ? String(body.status) : undefined),
      source: body.source ? String(body.source) : null,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : null,
      notes: body.notes ? String(body.notes) : null,
      lastVerifiedDate: body.lastVerifiedDate ? String(body.lastVerifiedDate) : null,
    });

    const trigger = resolveAvailabilityBioTrigger({
      kind: "suspension",
      nextStatus: row.status,
    });
    if (trigger) {
      await queueAvailabilityBioRefresh({ playerId: row.playerId, trigger });
    }

    return NextResponse.json({ suspension: row }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create suspension";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const previous = await getSuspensionById(id);
    const row = await updateSuspension(id, {
      teamId: body.teamId !== undefined ? (body.teamId ? String(body.teamId) : null) : undefined,
      competitionId:
        body.competitionId !== undefined
          ? body.competitionId
            ? String(body.competitionId)
            : null
          : undefined,
      seasonId: body.seasonId !== undefined ? (body.seasonId ? String(body.seasonId) : null) : undefined,
      fixtureId: body.fixtureId !== undefined ? (body.fixtureId ? String(body.fixtureId) : null) : undefined,
      incidentDate: body.incidentDate !== undefined ? String(body.incidentDate) : undefined,
      offence: body.offence !== undefined ? String(body.offence) : undefined,
      cardType: body.cardType !== undefined ? String(body.cardType) : undefined,
      hearingDate: body.hearingDate !== undefined ? String(body.hearingDate) : undefined,
      suspensionStart: body.suspensionStart !== undefined ? String(body.suspensionStart) : undefined,
      suspensionEnd: body.suspensionEnd !== undefined ? String(body.suspensionEnd) : undefined,
      matchesSuspended:
        body.matchesSuspended !== undefined ? Number(body.matchesSuspended) : undefined,
      matchesServed: body.matchesServed !== undefined ? Number(body.matchesServed) : undefined,
      matchesRemaining:
        body.matchesRemaining !== undefined ? Number(body.matchesRemaining) : undefined,
      status:
        body.status !== undefined
          ? normalizeSuspensionStatus(String(body.status))
          : undefined,
      source: body.source !== undefined ? String(body.source) : undefined,
      sourceUrl: body.sourceUrl !== undefined ? String(body.sourceUrl) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
      lastVerifiedDate:
        body.lastVerifiedDate !== undefined ? String(body.lastVerifiedDate) : undefined,
    });

    const trigger = resolveAvailabilityBioTrigger({
      kind: "suspension",
      previousStatus: previous?.status,
      nextStatus: row.status,
    });
    if (trigger) {
      await queueAvailabilityBioRefresh({ playerId: row.playerId, trigger });
    }

    return NextResponse.json({ suspension: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update suspension";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteSuspension(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete suspension";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
