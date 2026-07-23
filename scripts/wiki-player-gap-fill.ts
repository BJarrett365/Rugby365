#!/usr/bin/env npx tsx
/**
 * Audit + fill-missing player bio/social fields from Wikipedia / Wikidata.
 *
 * Never creates players. Never overwrites existing values. Never replaces careers.
 *
 * Usage:
 *   npx tsx scripts/wiki-player-gap-fill.ts --audit
 *   npx tsx scripts/wiki-player-gap-fill.ts --limit=25
 *   npx tsx scripts/wiki-player-gap-fill.ts --limit=100 --all-unlinked
 */
import { createDb, players } from "@rugby365/db";

process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

// Avoid apps/web "server-only" gate for scripts by mocking module resolution through service paths
// that pull getDb — use a thin local runner importing the gap service after aliasing.
async function main() {
  const auditOnly = process.argv.includes("--audit");
  const allUnlinked = process.argv.includes("--all-unlinked");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : auditOnly ? undefined : 50;

  // Dynamic import of path that uses getDb — patches createDb identity via env.
  // Use the gap helpers by re-implementing a script-safe thin path if server-only blocks.
  try {
    const gap = await import("../apps/web/src/lib/player-wikipedia-gap-service");
    const audit = await gap.auditPlayerWikipediaGaps({ sampleSize: 30, limit });
    console.log("=== Wikipedia player gap audit ===");
    console.log(JSON.stringify({
      totalPlayers: audit.totalPlayers,
      playersWithGaps: audit.playersWithGaps,
      byField: audit.byField,
      withWikipediaUrl: audit.withWikipediaUrl,
      withWikidataId: audit.withWikidataId,
      sample: audit.sample.slice(0, 15).map((r) => ({
        name: r.name,
        missing: r.missingFields,
        wikipediaUrl: r.wikipediaUrl,
      })),
    }, null, 2));

    if (auditOnly) return;

    console.log("\n=== Fill missing only (no overwrite / no create) ===");
    const summary = await gap.fillPlayerWikipediaMissingFields({
      limit: limit ?? 50,
      preferLinked: !allUnlinked,
      delayMs: 450,
      onProgress: ({ index, total, playerName, result }) => {
        const fields = result.fieldsUpdated?.join(",") || result.reason || "skip";
        console.log(`[${index}/${total}] ${playerName} — ${fields}`);
      },
    });
    console.log("\nDone:", JSON.stringify({
      totalWithGaps: summary.totalWithGaps,
      processed: summary.processed,
      filled: summary.filled,
      unchanged: summary.unchanged,
      unmatched: summary.unmatched,
      failed: summary.failed,
      fieldsFilled: summary.fieldsFilled,
    }, null, 2));
  } catch (error) {
    if (error instanceof Error && error.message.includes("server-only")) {
      console.error(
        "server-only blocked script import. Falling back to API: POST /api/admin/players/wiki-gap-fill",
      );
      // Direct SQL summary via createDb as fallback audit
      const db = createDb();
      const rows = await db.select({ id: players.id }).from(players).limit(1);
      console.log("DB reachable, players probe:", rows.length);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
