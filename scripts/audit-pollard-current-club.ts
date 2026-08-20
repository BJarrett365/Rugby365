/**
 * Audit Pollard current club evidence for V2 correction pass.
 */
import { createDb, players, playerTeamMemberships, teams } from "@rugby365/db";
import { eq, sql } from "drizzle-orm";

const POLLARD = "bfb4dbe1-4c5c-4ceb-8895-3d3d104fff26";
const db = createDb();

async function main() {
  const [p] = await db
    .select({
      name: players.name,
      club: players.clubName,
      clubId: players.clubTeamId,
      intl: players.internationalTeamId,
    })
    .from(players)
    .where(eq(players.id, POLLARD));

  const mem = await db
    .select({
      type: playerTeamMemberships.membershipType,
      teamId: playerTeamMemberships.teamId,
      current: playerTeamMemberships.isCurrent,
      start: playerTeamMemberships.startYear,
      end: playerTeamMemberships.endYear,
      status: playerTeamMemberships.status,
      src: playerTeamMemberships.sourceProvider,
      verifiedAt: playerTeamMemberships.verifiedAt,
    })
    .from(playerTeamMemberships)
    .where(eq(playerTeamMemberships.playerId, POLLARD));

  const teamIds = [...new Set(mem.map((m) => m.teamId).filter(Boolean))];
  const teamRows =
    teamIds.length > 0
      ? await db.select({ id: teams.id, name: teams.name }).from(teams).where(sql`${teams.id} in ${teamIds}`)
      : [];
  const teamName = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

  const recentRp = await db.execute(sql`
    SELECT team_name, competition_name, kickoff_at::text AS d
    FROM player_external_matches
    WHERE player_id = ${POLLARD} AND kickoff_at >= '2025-07-01'
    ORDER BY kickoff_at DESC
    LIMIT 20
  `);

  const recentFx = await db.execute(sql`
    SELECT t.name AS team, f.competition_name, f.kickoff_at::date::text AS d
    FROM fixture_players fp
    JOIN fixtures f ON f.id = fp.fixture_id
    JOIN teams t ON t.id = fp.team_id
    WHERE fp.player_id = ${POLLARD} AND f.kickoff_at >= '2025-01-01'
    ORDER BY f.kickoff_at DESC
    LIMIT 20
  `);

  const rpRows = "rows" in recentRp && Array.isArray(recentRp.rows) ? recentRp.rows : recentRp;
  const fxRows = "rows" in recentFx && Array.isArray(recentFx.rows) ? recentFx.rows : recentFx;

  console.log(
    JSON.stringify(
      {
        player: p,
        memberships: mem.map((m) => ({ ...m, team: teamName[m.teamId] ?? m.teamId })),
        recentRugbyPass: rpRows,
        recentFixtures: fxRows,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
