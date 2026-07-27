import { NextResponse } from "next/server";
import {
  createFixtureEventAdmin,
  deleteFixtureEventAdmin,
  listFixtureEventsAdmin,
  updateFixtureEventAdmin,
} from "@/lib/match-cms-data-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const events = await listFixtureEventsAdmin(id);
    return NextResponse.json({ events });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match events");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const event = await createFixtureEventAdmin(id, {
      eventType: String(body.eventType ?? ""),
      minute: Number(body.minute ?? 0),
      second: body.second !== undefined ? Number(body.second) : 0,
      teamId: body.teamId ? String(body.teamId) : null,
      playerId: body.playerId ? String(body.playerId) : null,
      payload:
        body.payload && typeof body.payload === "object"
          ? (body.payload as Record<string, unknown>)
          : {
              ...(body.playerName ? { playerName: String(body.playerName) } : {}),
              ...(body.assistPlayerName ? { assistPlayerName: String(body.assistPlayerName) } : {}),
              ...(body.playerOutName ? { playerOutName: String(body.playerOutName) } : {}),
              ...(body.playerInName ? { playerInName: String(body.playerInName) } : {}),
              ...(body.note ? { note: String(body.note) } : {}),
              ...(body.jerseyNumber !== undefined && body.jerseyNumber !== null && body.jerseyNumber !== ""
                ? { jerseyNumber: Number(body.jerseyNumber) }
                : {}),
            },
    });
    const events = await listFixtureEventsAdmin(id);
    return NextResponse.json({ event, events }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create event";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params;
    const body = (await req.json()) as Record<string, unknown>;
    const eventId = String(body.eventId ?? body.id ?? "");
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
    const event = await updateFixtureEventAdmin(eventId, {
      ...(body.eventType !== undefined ? { eventType: String(body.eventType) } : {}),
      ...(body.minute !== undefined ? { minute: Number(body.minute) } : {}),
      ...(body.second !== undefined ? { second: Number(body.second) } : {}),
      ...(body.teamId !== undefined ? { teamId: body.teamId ? String(body.teamId) : null } : {}),
      ...(body.playerId !== undefined
        ? { playerId: body.playerId ? String(body.playerId) : null }
        : {}),
      ...(body.payload !== undefined && typeof body.payload === "object"
        ? { payload: body.payload as Record<string, unknown> }
        : {}),
    });
    return NextResponse.json({ event });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update event";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: fixtureId } = await params;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });
    await deleteFixtureEventAdmin(eventId);
    const events = await listFixtureEventsAdmin(fixtureId);
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete event";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
