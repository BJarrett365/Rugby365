/**
 * Audit Handré Pollard Recent Matches rows (real DB, no invent).
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/audit-pollard-recent-matches.ts
 */
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { getPlayerRecentMatches } from "../apps/web/src/lib/player-recent-matches-service";

async function main() {
  const db = getDb();
  const [row] = await db
    .select({ id: players.id, slug: players.slug, name: players.name })
    .from(players)
    .where(eq(players.slug, "handre-pollard-og9nmd6l"))
    .limit(1);
  if (!row) {
    console.error("Pollard not found");
    process.exit(1);
  }

  const matches = await getPlayerRecentMatches(row.id, { limit: 10 });
  console.log(
    JSON.stringify(
      {
        player: { id: row.id, slug: row.slug, name: row.name },
        count: matches.length,
        rows: matches.map((m) => ({
          date: m.kickoffAt?.slice(0, 10) ?? null,
          match: m.matchLabel,
          competition: m.competitionName,
          rating: m.rating,
          yellow: m.yellowCards,
          red: m.redCards,
          result: m.result,
          role: m.squadRole,
          mins: m.minutesPlayed,
          href: m.href,
        })),
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
