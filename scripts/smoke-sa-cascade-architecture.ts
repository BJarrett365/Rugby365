/**
 * SA-first smoke test for live+backfill cascade architecture.
 */
import { desc, eq, or } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  cascadeFixtureDataChange,
  getRecalcQueueSummary,
  processRecalcQueue,
} from "../apps/web/src/lib/data-change-event-service";
import {
  getCoachDataHealth,
  getSouthAfricaBackfillSnapshot,
  SOUTH_AFRICA_TEAM_ID,
} from "../apps/web/src/lib/entity-data-health-service";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  const db = getDb();
  const [fx] = await db
    .select({ id: fixtures.id, slug: fixtures.slug, status: fixtures.status })
    .from(fixtures)
    .where(
      or(eq(fixtures.homeTeamId, SOUTH_AFRICA_TEAM_ID), eq(fixtures.awayTeamId, SOUTH_AFRICA_TEAM_ID)),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);

  if (!fx) throw new Error("No South Africa fixtures found");

  console.log("Cascading", fx.slug, fx.status);
  const cascade = await cascadeFixtureDataChange({
    fixtureId: fx.id,
    eventType: "HISTORIC_MATCH_BACKFILLED",
    source: "script",
    importMethod: "BACKFILL_JOB",
    processNow: false,
  });
  console.log(
    "Affected",
    cascade.affected.length,
    "queued",
    cascade.queued,
    "by type",
    cascade.affected.reduce(
      (acc, a) => {
        acc[a.entityType] = (acc[a.entityType] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  );

  const queueBefore = await getRecalcQueueSummary();
  console.log("Queue before process", queueBefore);

  // Process coaches first (bounded) as the proven path
  const processed = await processRecalcQueue({
    limit: 5,
    entityTypes: ["coach"],
  });
  console.log("Processed coaches", processed);

  const rassie = await getCoachDataHealth(RASSIE);
  console.log("Rassie health", {
    pct: rassie.profileHealthPct,
    layers: rassie.layers.map((l) => `${l.label} ${l.have}/${l.of}`),
  });

  const snap = await getSouthAfricaBackfillSnapshot();
  console.log("SA team health", snap.team.profileHealthPct, snap.team.layers.map((l) => `${l.key} ${l.have}/${l.of}`));
  console.log("Queue summary", snap.queue);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
