/**
 * Backfill playerInName / playerOutName onto paired Sub On + Sub Off CMS rows.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/backfill-substitution-pairs.ts
 */
import { and, eq } from "drizzle-orm";
import { createDb, matchEvents } from "@rugby365/db";
import { isSubOffType, isSubOnType } from "../apps/web/src/lib/match-key-events";

async function main() {
  const db = createDb();
  const rows = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.eventType, "substitution"));

  type Row = (typeof rows)[number];
  const byKey = new Map<string, Row[]>();
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const team =
      row.teamId ??
      (typeof payload.team_provider_id === "string" ? payload.team_provider_id : "no-team");
    const key = `${row.fixtureId}:${row.minute}:${row.second}:${team}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  let updated = 0;
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    let onRow: Row | null = null;
    let offRow: Row | null = null;
    for (const row of group) {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const t = typeof payload.type === "string" ? payload.type : row.eventType;
      if (isSubOnType(t)) onRow = row;
      else if (isSubOffType(t)) offRow = row;
    }
    if (!onRow || !offRow) continue;

    const onPayload = (onRow.payload ?? {}) as Record<string, unknown>;
    const offPayload = (offRow.payload ?? {}) as Record<string, unknown>;
    const onName =
      (typeof onPayload.player === "string" && onPayload.player) ||
      (typeof onPayload.playerInName === "string" && onPayload.playerInName) ||
      null;
    const offName =
      (typeof offPayload.player === "string" && offPayload.player) ||
      (typeof offPayload.playerOutName === "string" && offPayload.playerOutName) ||
      null;
    if (!onName || !offName) continue;

    for (const row of [onRow, offRow]) {
      const payload = { ...(row.payload as Record<string, unknown>) };
      if (payload.playerInName === onName && payload.playerOutName === offName) continue;
      payload.playerInName = onName;
      payload.playerOutName = offName;
      await db
        .update(matchEvents)
        .set({ payload })
        .where(and(eq(matchEvents.id, row.id)));
      updated += 1;
    }
  }

  console.log(`Updated ${updated} substitution event payloads across ${byKey.size} groups`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
