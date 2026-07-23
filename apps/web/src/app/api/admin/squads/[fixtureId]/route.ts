import { NextResponse } from "next/server";
import {
  addFixtureSquadPlayer,
  getFixtureSquad,
  removeFixtureSquadPlayer,
  syncSquadFromMatchSnapshot,
  updateFixtureSquadPlayer,
} from "@/lib/entity-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ fixtureId: string }> }) {
  try {
    const { fixtureId } = await params;
    const detail = await getFixtureSquad(fixtureId);
    if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load squad");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ fixtureId: string }> }) {
  try {
    const { fixtureId } = await params;
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "sync-from-match") {
      const result = await syncSquadFromMatchSnapshot(fixtureId);
      return NextResponse.json(result);
    }

    const row = await addFixtureSquadPlayer({
      fixtureId,
      playerId: String(body.playerId ?? ""),
      teamId: String(body.teamId ?? ""),
      jerseyNumber: body.jerseyNumber !== undefined ? Number(body.jerseyNumber) : undefined,
      squadRole: String(body.squadRole ?? "starting"),
      positionName: body.positionName ? String(body.positionName) : undefined,
      clubName: body.clubName ? String(body.clubName) : undefined,
    });
    return NextResponse.json({ squadPlayer: row }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update squad";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ fixtureId: string }> }) {
  try {
    await params;
    const body = (await req.json()) as Record<string, unknown>;
    const squadPlayerId = String(body.squadPlayerId ?? body.id ?? "");
    if (!squadPlayerId) {
      return NextResponse.json({ error: "squadPlayerId required" }, { status: 400 });
    }
    const row = await updateFixtureSquadPlayer(squadPlayerId, {
      ...(body.jerseyNumber !== undefined ? { jerseyNumber: Number(body.jerseyNumber) } : {}),
      ...(body.squadRole !== undefined ? { squadRole: String(body.squadRole) } : {}),
      ...(body.positionName !== undefined ? { positionName: String(body.positionName) } : {}),
      ...(body.clubName !== undefined ? { clubName: String(body.clubName) } : {}),
      ...(body.teamId !== undefined ? { teamId: String(body.teamId) } : {}),
    });
    return NextResponse.json({ squadPlayer: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update squad player";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ fixtureId: string }> }) {
  try {
    await params;
    const { searchParams } = new URL(req.url);
    const squadPlayerId = searchParams.get("squadPlayerId");
    if (!squadPlayerId) {
      return NextResponse.json({ error: "squadPlayerId required" }, { status: 400 });
    }
    await removeFixtureSquadPlayer(squadPlayerId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to remove squad player";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
