import { NextResponse } from "next/server";
import { getFixtureById } from "@/lib/fixture-admin-service";
import { getFixtureTeamMatchStats } from "@/lib/team-match-stats-service";
import {
  buildTeamStatPairRows,
  saveFixturePlayerStatsBatch,
  upsertTeamStatPair,
} from "@/lib/match-cms-data-service";
import { getFixturePlayerMatchStats } from "@/lib/player-season-stats-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const fixture = await getFixtureById(id);
    if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [teamStats, playerStats] = await Promise.all([
      getFixtureTeamMatchStats(id),
      getFixturePlayerMatchStats(id),
    ]);
    const home = teamStats.find((r) => r.side === "home");
    const away = teamStats.find((r) => r.side === "away");

    return NextResponse.json({
      fixture: {
        id: fixture.id,
        slug: fixture.slug,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        homeTeamName: fixture.homeTeam?.name ?? null,
        awayTeamName: fixture.awayTeam?.name ?? null,
        kickoffAt: fixture.kickoffAt,
        status: fixture.status,
        externalMatchId: fixture.externalMatchId,
      },
      teamStats,
      playerStats,
      pairRows: buildTeamStatPairRows(home, away),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match stats");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const mode = typeof body.mode === "string" ? body.mode : "team_pair";

    if (mode === "player_batch") {
      const drafts = Array.isArray(body.drafts) ? body.drafts : [];
      const playerStats = await saveFixturePlayerStatsBatch(
        id,
        drafts.map((d) => {
          const row = d as Record<string, unknown>;
          return {
            playerId: String(row.playerId ?? ""),
            teamId: String(row.teamId ?? ""),
            minutesPlayed: row.minutesPlayed !== undefined ? Number(row.minutesPlayed) : undefined,
            points: row.points !== undefined ? Number(row.points) : undefined,
            tries: row.tries !== undefined ? Number(row.tries) : undefined,
            carries: row.carries !== undefined ? Number(row.carries) : undefined,
            metresCarried: row.metresCarried !== undefined ? Number(row.metresCarried) : undefined,
            lineBreaks: row.lineBreaks !== undefined ? Number(row.lineBreaks) : undefined,
            defendersBeaten: row.defendersBeaten !== undefined ? Number(row.defendersBeaten) : undefined,
            tacklesMade: row.tacklesMade !== undefined ? Number(row.tacklesMade) : undefined,
            tacklesCompleted:
              row.tacklesCompleted !== undefined ? Number(row.tacklesCompleted) : undefined,
            turnoversWon: row.turnoversWon !== undefined ? Number(row.turnoversWon) : undefined,
            tryAssists: row.tryAssists !== undefined ? Number(row.tryAssists) : undefined,
          };
        }),
      );
      return NextResponse.json({ ok: true, playerStats });
    }

    const result = await upsertTeamStatPair(id, {
      type: String(body.type ?? ""),
      scope: body.scope ? String(body.scope) : "Total",
      home: Number(body.home ?? 0),
      away: Number(body.away ?? 0),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save match stats";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
