import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  getCompetitionSeasonCoverage,
  getCoachDataHealth,
  getSouthAfricaBackfillSnapshot,
  getTeamDataHealth,
  SOUTH_AFRICA_TEAM_ID,
} from "@/lib/entity-data-health-service";
import {
  cascadeFixtureDataChange,
  getRecalcQueueSummary,
  processRecalcQueue,
  type RecalcEntityType,
} from "@/lib/data-change-event-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "sa";

    if (view === "queue") {
      const summary = await getRecalcQueueSummary();
      return NextResponse.json({ ok: true, summary });
    }

    if (view === "team") {
      const teamId = url.searchParams.get("teamId") ?? SOUTH_AFRICA_TEAM_ID;
      const health = await getTeamDataHealth(teamId);
      return NextResponse.json({ ok: true, health });
    }

    if (view === "coach") {
      const coachId = url.searchParams.get("coachId");
      if (!coachId) return NextResponse.json({ error: "coachId required" }, { status: 400 });
      const health = await getCoachDataHealth(coachId);
      return NextResponse.json({ ok: true, health });
    }

    if (view === "season") {
      const competitionId = url.searchParams.get("competitionId");
      const seasonId = url.searchParams.get("seasonId");
      if (!competitionId || !seasonId) {
        return NextResponse.json({ error: "competitionId and seasonId required" }, { status: 400 });
      }
      const coverage = await getCompetitionSeasonCoverage({ competitionId, seasonId });
      return NextResponse.json({ ok: true, coverage });
    }

    const snapshot = await getSouthAfricaBackfillSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load backfill dashboard");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      fixtureId?: string;
      limit?: number;
      entityTypes?: RecalcEntityType[];
    };

    if (body.action === "process-queue") {
      const result = await processRecalcQueue({
        limit: body.limit ?? 25,
        entityTypes: body.entityTypes,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "cascade-fixture") {
      if (!body.fixtureId) {
        return NextResponse.json({ error: "fixtureId required" }, { status: 400 });
      }
      const result = await cascadeFixtureDataChange({
        fixtureId: body.fixtureId,
        eventType: "HISTORIC_MATCH_BACKFILLED",
        source: "admin",
        importMethod: "BACKFILL_JOB",
        processNow: false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return apiErrorResponse(e, "Backfill action failed");
  }
}
