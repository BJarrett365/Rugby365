import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { fixturePlayers, fixtures, players, teams } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, id)).limit(1);
    if (!fixture) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await db
      .select({
        playerId: fixturePlayers.playerId,
        teamId: fixturePlayers.teamId,
        jerseyNumber: fixturePlayers.jerseyNumber,
        squadRole: fixturePlayers.squadRole,
        positionName: fixturePlayers.positionName,
        clubName: fixturePlayers.clubName,
        playerName: players.name,
      })
      .from(fixturePlayers)
      .innerJoin(players, eq(fixturePlayers.playerId, players.id))
      .where(eq(fixturePlayers.fixtureId, id));

    const teamRows = await db.select().from(teams);
    const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

    const squad = rows.map((r) => ({
      playerId: r.playerId,
      teamId: r.teamId,
      teamName: teamById[r.teamId] ?? "",
      name: r.playerName,
      jerseyNumber: r.jerseyNumber,
      squadRole: r.squadRole,
      positionName: r.positionName,
      clubName: r.clubName,
      side:
        r.teamId === fixture.homeTeamId
          ? ("home" as const)
          : r.teamId === fixture.awayTeamId
            ? ("away" as const)
            : null,
    }));

    const snap = (fixture.providerSnapshot ?? {}) as {
      lineups?: {
        home: { starting: LineupPlayer[]; substitutes: LineupPlayer[] };
        away: { starting: LineupPlayer[]; substitutes: LineupPlayer[] };
      };
    };

    const snapshotPlayers: Array<{
      name: string;
      jerseyNumber: number;
      positionName?: string;
      clubName?: string;
      side: "home" | "away";
    }> = [];

    if (snap.lineups) {
      for (const side of ["home", "away"] as const) {
        const team = snap.lineups[side];
        for (const p of [...team.starting, ...team.substitutes]) {
          snapshotPlayers.push({
            name: p.name,
            jerseyNumber: p.jerseyNumber,
            positionName: p.positionName,
            clubName: p.clubName,
            side,
          });
        }
      }
    }

    return NextResponse.json({
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      squad,
      snapshotPlayers,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load squad");
  }
}

type LineupPlayer = {
  name: string;
  jerseyNumber: number;
  positionName?: string;
  clubName?: string;
};
