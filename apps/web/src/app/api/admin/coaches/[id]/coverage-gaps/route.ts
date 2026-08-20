import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  listCoachCoverageGaps,
  setCoverageGapAction,
  type CoverageDataType,
  type CoverageGapAction,
} from "@/lib/coach-coverage-gaps-service";
import { onFixtureDataChanged } from "@/lib/coach-recalc-service";
import { syncWorldRugbyRankingsForDate } from "@/lib/world-rugby-rankings-at-date";
import { calculateAndPersistFixtureMatchRatings } from "@/lib/match-rating-service";

const DATA_TYPES = new Set<CoverageDataType>([
  "matches",
  "lineups",
  "team_stats",
  "player_ratings",
  "historical_rankings",
]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const dataType = new URL(req.url).searchParams.get("dataType") as CoverageDataType | null;
    if (!dataType || !DATA_TYPES.has(dataType)) {
      return NextResponse.json({ error: "dataType required" }, { status: 400 });
    }
    const gaps = await listCoachCoverageGaps(id, dataType);
    return NextResponse.json({ ok: true, gaps });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load coverage gaps");
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: coachId } = await params;
    const body = (await req.json()) as {
      dataType?: CoverageDataType;
      fixtureId?: string;
      action?: string;
      note?: string | null;
      date?: string | null;
    };

    const dataType = body.dataType;
    const fixtureId = body.fixtureId;
    const action = body.action;
    if (!dataType || !DATA_TYPES.has(dataType) || !fixtureId || !action) {
      return NextResponse.json(
        { error: "dataType, fixtureId, and action required" },
        { status: 400 },
      );
    }

    if (action === "ignore" || action === "unavailable") {
      const result = await setCoverageGapAction({
        coachId,
        dataType,
        fixtureId,
        action: action as CoverageGapAction,
        note: body.note ?? null,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "clear") {
      const result = await setCoverageGapAction({
        coachId,
        dataType,
        fixtureId,
        action: "clear",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "check_source") {
      const gaps = await listCoachCoverageGaps(coachId, dataType);
      const row = gaps.find((g) => g.fixtureId === fixtureId) ?? null;
      return NextResponse.json({
        ok: true,
        source: row?.availableSource ?? null,
        gap: row,
        message: row
          ? `Available source: ${row.availableSource}`
          : "No gap row — data may already be present.",
      });
    }

    if (action === "backfill") {
      if (dataType === "player_ratings") {
        const result = await calculateAndPersistFixtureMatchRatings(fixtureId);
        await onFixtureDataChanged(fixtureId, { recalculate: false });
        return NextResponse.json({ ok: true, result });
      }
      if (dataType === "historical_rankings") {
        const date = (body.date ?? rowDateFromGaps(coachId, dataType, fixtureId)) as
          | string
          | Promise<string | null>;
        const resolved = typeof date === "string" ? date : await date;
        if (!resolved) {
          return NextResponse.json(
            { error: "Match date required for ranking backfill" },
            { status: 400 },
          );
        }
        const synced = await syncWorldRugbyRankingsForDate("mru", resolved);
        if (!synced.ok) {
          await setCoverageGapAction({
            coachId,
            dataType,
            fixtureId,
            action: "unavailable",
            note: synced.reason ?? "World Rugby API has no snapshot on/before this date",
          });
          return NextResponse.json({
            ok: false,
            unavailable: true,
            ...synced,
          });
        }
        await onFixtureDataChanged(fixtureId, { recalculate: false });
        return NextResponse.json({ ok: true, synced });
      }
      if (dataType === "team_stats") {
        return NextResponse.json({
          ok: false,
          error:
            "Team stats backfill uses RWC/SDMS/Rugby Data import scripts — run sync or CHECK SOURCE.",
        }, { status: 400 });
      }
      return NextResponse.json(
        { error: `Backfill not automated for ${dataType}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Coverage gap action failed");
  }
}

async function rowDateFromGaps(
  coachId: string,
  dataType: CoverageDataType,
  fixtureId: string,
): Promise<string | null> {
  const gaps = await listCoachCoverageGaps(coachId, dataType);
  return gaps.find((g) => g.fixtureId === fixtureId)?.date ?? null;
}
