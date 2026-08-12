import { NextResponse } from "next/server";
import { listWorldRankingFeeds } from "@/lib/world-rugby-rankings-service";
import {
  listWorldRankingLeaderSpans,
  listWorldRankingSnapshotMeta,
} from "@/lib/world-ranking-wikipedia-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const feeds = await listWorldRankingFeeds();
    const [mruHistory, mruLeaders, wruHistory, wruLeaders] = await Promise.all([
      listWorldRankingSnapshotMeta("mru", 12),
      listWorldRankingLeaderSpans("mru"),
      listWorldRankingSnapshotMeta("wru", 12),
      listWorldRankingLeaderSpans("wru"),
    ]);
    return NextResponse.json({
      feeds,
      summary: {
        mru: {
          snapshotCount: mruHistory.length,
          leaderSpanCount: mruLeaders.length,
          latestSnapshots: mruHistory.slice(0, 5),
        },
        wru: {
          snapshotCount: wruHistory.length,
          leaderSpanCount: wruLeaders.length,
          latestSnapshots: wruHistory.slice(0, 5),
        },
      },
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load World Rugby rankings");
  }
}
