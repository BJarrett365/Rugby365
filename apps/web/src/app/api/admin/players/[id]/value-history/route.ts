import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  bulkPreviewPlayerValueHistoryBackfill,
  getValueHistoryQualitySummary,
  previewPlayerValueHistoryBackfill,
  runPlayerValueHistoryBackfill,
  type ValueBackfillRangeOption,
} from "@/lib/player-value-backfill-service";

function parseRange(raw: unknown): ValueBackfillRangeOption {
  if (raw === "career") return "career";
  const n = Number(raw);
  if (n === 12) return 12;
  if (n === 24) return 24;
  return 6;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "quality";
    const range = parseRange(url.searchParams.get("range") ?? 6);

    if (view === "preview") {
      const preview = await previewPlayerValueHistoryBackfill(id, range);
      return NextResponse.json({ preview });
    }

    const quality = await getValueHistoryQualitySummary(id);
    return NextResponse.json({ quality });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load value history backfill");
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: "preview" | "run" | "bulk-stub";
      range?: ValueBackfillRangeOption | number | string;
      playerIds?: string[];
      position?: string | null;
      competitionId?: string | null;
      limit?: number;
    };

    const action = body.action ?? "preview";
    const range = parseRange(body.range ?? 6);

    if (action === "bulk-stub") {
      const stub = await bulkPreviewPlayerValueHistoryBackfill({
        playerIds: body.playerIds,
        range,
        position: body.position,
        competitionId: body.competitionId,
        limit: body.limit,
      });
      return NextResponse.json(stub);
    }

    if (action === "run") {
      const result = await runPlayerValueHistoryBackfill(id, range);
      return NextResponse.json({ result });
    }

    const preview = await previewPlayerValueHistoryBackfill(id, range);
    return NextResponse.json({ preview });
  } catch (e) {
    return apiErrorResponse(e, "Failed to run value history backfill");
  }
}
