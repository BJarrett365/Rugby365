import { NextResponse } from "next/server";
import type { WorldRugbyRankingCategory } from "@rugby365/import-sdk";
import {
  getWorldRankingSnapshotDetail,
  listWorldRankingLeaderSpans,
  listWorldRankingMilestones,
  listWorldRankingSnapshotMeta,
} from "@/lib/world-ranking-wikipedia-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = (searchParams.get("category") ?? "mru") as WorldRugbyRankingCategory;
    const view = searchParams.get("view") ?? "history";
    const snapshotId = searchParams.get("snapshotId");

    if (snapshotId) {
      const detail = await getWorldRankingSnapshotDetail(snapshotId);
      if (!detail) {
        return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
      }
      return NextResponse.json({ snapshot: detail });
    }

    if (view === "leaders") {
      const leaders = await listWorldRankingLeaderSpans(category);
      return NextResponse.json({
        leaders: leaders.map((row) => ({
          ...row,
          startDate: String(row.startDate).slice(0, 10),
          endDate: row.endDate ? String(row.endDate).slice(0, 10) : null,
          importedAt: row.importedAt?.toISOString() ?? null,
        })),
      });
    }

    if (view === "milestones") {
      const milestones = await listWorldRankingMilestones(category);
      return NextResponse.json({
        milestones: milestones.map((row) => ({
          ...row,
          achievedOn: row.achievedOn ? String(row.achievedOn).slice(0, 10) : null,
          importedAt: row.importedAt?.toISOString() ?? null,
        })),
      });
    }

    const snapshots = await listWorldRankingSnapshotMeta(category, 80);
    return NextResponse.json({ snapshots });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load world ranking history");
  }
}
