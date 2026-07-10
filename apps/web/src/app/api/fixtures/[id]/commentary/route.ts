import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { fixtures, matchCommentary, teams } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { publishPendingCommentaryForFixture } from "@/lib/publish-commentary-service";
import { publishManualCommentary } from "@/lib/manual-commentary-service";
import {
  buildCommentaryBody,
  type MatchAction,
  type MatchPhase,
} from "@/lib/commentary-entry";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
  if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let lines = await db
    .select()
    .from(matchCommentary)
    .where(eq(matchCommentary.fixtureId, id))
    .orderBy(asc(matchCommentary.minute), asc(matchCommentary.publishedAt));

  if (lines.length === 0 && (fixture.status === "full_time" || fixture.status === "live")) {
    await publishPendingCommentaryForFixture(id);
    lines = await db
      .select()
      .from(matchCommentary)
      .where(eq(matchCommentary.fixtureId, id))
      .orderBy(asc(matchCommentary.minute), asc(matchCommentary.publishedAt));
  }

  return NextResponse.json({ lines });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
    if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const minute = Number(body.minute ?? 0);
    if (!Number.isFinite(minute) || minute < 0 || minute > 120) {
      return NextResponse.json({ error: "Minute must be between 0 and 120" }, { status: 400 });
    }

    const phase = String(body.phase ?? "match_event") as MatchPhase;
    const action = body.action ? (String(body.action) as MatchAction) : undefined;
    const teamSide =
      body.teamSide === "home" || body.teamSide === "away" ? body.teamSide : undefined;

    const teamRows = await db.select().from(teams);
    const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));
    const homeName = fixture.homeTeamId ? (teamById[fixture.homeTeamId] ?? "Home") : "Home";
    const awayName = fixture.awayTeamId ? (teamById[fixture.awayTeamId] ?? "Away") : "Away";

    const playerName = typeof body.playerName === "string" ? body.playerName : undefined;
    const playerRole = typeof body.playerRole === "string" ? body.playerRole : undefined;

    const built = buildCommentaryBody({
      minute,
      phase,
      action,
      teamSide,
      homeName,
      awayName,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      venueName: fixture.venueName ?? undefined,
      playerName,
      playerRole,
    });

    const team = teamSide === "home" ? homeName : teamSide === "away" ? awayName : undefined;
    const line = await publishManualCommentary(id, {
      minute,
      second: typeof body.second === "number" ? body.second : 0,
      body: built.body,
      outputType: built.outputType,
      facts: {
        minute,
        phase,
        action,
        team,
        teamSide,
        player: playerName,
        player_role: playerRole,
        event_type: built.eventType,
        home_team: homeName,
        away_team: awayName,
        home_score: fixture.homeScore,
        away_score: fixture.awayScore,
        source: "manual_entry",
      },
    });

    return NextResponse.json({ line }, { status: 201 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to publish commentary");
  }
}
