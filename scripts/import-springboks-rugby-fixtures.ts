/**
 * Import Springboks fixtures from https://springboks.rugby and repair stale live rows.
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/import-springboks-rugby-fixtures.ts
 */
import { sql } from "drizzle-orm";
import { getDb } from "../apps/web/src/lib/db";
import { importSpringboksRugbyFixtures } from "../apps/web/src/lib/springboks-rugby-import-service";
import { getPlayerNextMatch } from "../apps/web/src/lib/player-next-match-service";

async function main() {
  const db = getDb();

  // Close ancient "live" fixtures so they cannot block Next Match.
  const repaired = await db.execute(sql`
    update fixtures
    set status = 'full_time'
    where lower(status) like '%live%'
      and kickoff_at is not null
      and kickoff_at < now() - interval '1 day'
    returning id, kickoff_at, competition_name
  `);
  console.log("repaired stale live fixtures", (repaired.rows ?? repaired).length);

  const result = await importSpringboksRugbyFixtures({ seniorMensOnly: true });
  console.log(JSON.stringify(result, null, 2));

  const playerRes = await db.execute(sql`
      select id, club_team_id, international_team_id
      from players
      where slug = 'sacha-feinberg-mngomezulu'
      limit 1
    `);
  const playerRows = (playerRes.rows ?? playerRes) as Array<{
    id: string;
    club_team_id: string | null;
    international_team_id: string | null;
  }>;
  const player = playerRows[0];

  if (player) {
    const next = await getPlayerNextMatch({
      playerId: player.id,
      clubTeamId: player.club_team_id,
      internationalTeamId: player.international_team_id,
    });
    console.log("Sacha next match:", {
      source: next.card.source,
      kickoffAt: next.card.kickoffAt,
      home: next.card.homeTeamName,
      away: next.card.awayTeamName,
      competition: next.card.competitionName,
      venue: next.card.venueName,
      reason: next.card.reason,
    });
  } else {
    console.log("Sacha player row not found for next-match check");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
