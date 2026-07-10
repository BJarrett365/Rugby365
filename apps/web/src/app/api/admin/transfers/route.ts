import { NextResponse } from "next/server";
import {
  bulkDeleteTransfers,
  createTransferRecord,
  deleteTransferRecord,
  listTransfersFiltered,
} from "@/lib/transfer-admin-service";
import { parseTransferListFilters } from "@/lib/transfer-filters";
import type { TransferMovementType } from "@/lib/transfer-types";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await listTransfersFiltered(parseTransferListFilters(searchParams));
    return NextResponse.json(result);
  } catch (e) {
    return apiErrorResponse(e, "Failed to list transfers");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await createTransferRecord({
      playerId: String(body.playerId ?? ""),
      fromTeamId: body.fromTeamId ? String(body.fromTeamId) : undefined,
      toTeamId: body.toTeamId ? String(body.toTeamId) : undefined,
      fromClub: body.fromClub ? String(body.fromClub) : undefined,
      toClub: body.toClub ? String(body.toClub) : undefined,
      transferType: body.transferType === "international" ? "international" : "club",
      movementType: body.movementType ? String(body.movementType) as TransferMovementType : "permanent",
      seasonId: body.seasonId ? String(body.seasonId) : undefined,
      competitionId: body.competitionId ? String(body.competitionId) : undefined,
      positionName: body.positionName ? String(body.positionName) : undefined,
      effectiveDate: body.effectiveDate ? String(body.effectiveDate) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create transfer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await deleteTransferRecord(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete transfer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
