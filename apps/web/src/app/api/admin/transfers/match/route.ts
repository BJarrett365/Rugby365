import { NextResponse } from "next/server";
import { players, teams } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { matchPlayers, matchTeamName } from "@/lib/transfer-match-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      playerName?: string;
      teamName?: string;
      birthDate?: string;
      nationality?: string;
      currentTeamId?: string;
      positionName?: string;
    };

    const db = getDb();
    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(teams);

    const playerMatches = body.playerName
      ? matchPlayers({
          name: body.playerName,
          birthDate: body.birthDate,
          nationality: body.nationality,
          currentTeamId: body.currentTeamId,
          positionName: body.positionName,
          candidates: allPlayers,
          teams: allTeams,
        })
      : [];

    const teamMatch = body.teamName ? matchTeamName(body.teamName, allTeams, { createAlias: true }) : null;

    return NextResponse.json({ playerMatches, teamMatch });
  } catch (e) {
    return apiErrorResponse(e, "Failed to match transfer entities");
  }
}
