/**
 * Audit Handré Pollard player_value_history rows.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/audit-pollard-value-history.ts
 */
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { auditPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";
import { getPublicPlayerOverviewV2 } from "../apps/web/src/lib/public-player-overview-v2-service";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";

process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

async function main() {
  const slug = "handre-pollard-og9nmd6l";
  const db = getDb();
  const [p] = await db
    .select({ id: players.id, slug: players.slug, name: players.name })
    .from(players)
    .where(eq(players.slug, slug))
    .limit(1);

  if (!p) {
    console.error("Player not found:", slug);
    process.exit(1);
  }

  let audit = await auditPlayerValueHistory(p.id);

  // Seed first LIVE snapshot via value engine if none exist yet (not page load — explicit audit run).
  if (audit.count === 0) {
    await calculateAndPersistPlayerValue(p.id);
    audit = await auditPlayerValueHistory(p.id);
  }

  const overview = await getPublicPlayerOverviewV2(slug, { preview: true });

  console.log(
    JSON.stringify(
      {
        player: { id: p.id, slug: p.slug, name: p.name },
        historyAudit: audit,
        overviewTimeline: overview?.marketValueTimeline24m ?? null,
        change30d: overview?.marketValueChange30d ?? null,
        currentMarketValueGbp: overview?.playerValue?.marketValueGbp ?? null,
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
