#!/usr/bin/env npx tsx
/**
 * Verify + backfill Premiership fixture season_id and stage.
 *
 * Usage:
 *   npx tsx scripts/backfill-premiership-fixture-season-stage.ts           # dry-run
 *   npx tsx scripts/backfill-premiership-fixture-season-stage.ts --apply
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures } from "@rugby365/db";
import { isPlayoffRound } from "@rugby365/import-sdk";
import { getDb } from "../apps/web/src/lib/db";
import { kickoffInSeason, parseSeasonStartYear } from "../apps/web/src/lib/season-label-utils";

const APPLY = process.argv.includes("--apply");

function stageFromRound(round: string | null | undefined): string {
  if (!round?.trim()) return "regular";
  const value = round.trim().toLowerCase();
  if (/\bfinal\b/.test(value) && !/semi/.test(value) && !/quarter/.test(value)) return "final";
  if (/semi-?final|semi finals?/.test(value)) return "semi_final";
  if (/quarter-?final|\bqf\b/.test(value)) return "quarter_final";
  if (isPlayoffRound(round)) return "playoff";
  return "regular";
}

async function main() {
  const db = getDb();
  const [comp] = await db.select().from(competitions).where(eq(competitions.slug, "premiership")).limit(1);
  if (!comp) {
    console.error("Premiership competition not found");
    process.exit(1);
  }

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(and(eq(competitionSeasons.competitionId, comp.id), eq(competitionSeasons.isDeprecated, false)));

  const seasonsByYear = new Map(
    seasons.map((s) => [s.year ?? parseSeasonStartYear(s.label) ?? 0, s]),
  );

  const allFx = await db.select().from(fixtures).where(eq(fixtures.competitionId, comp.id));

  let seasonLinked = 0;
  let stageSet = 0;
  let playoffCount = 0;
  let unmatchedKickoff = 0;

  const bySeasonStage = new Map<string, number>();

  for (const fx of allFx) {
    let seasonId = fx.seasonId;
    let seasonYear: number | null = null;

    if (!seasonId && fx.kickoffAt) {
      for (const [year, season] of seasonsByYear) {
        if (year > 0 && kickoffInSeason(fx.kickoffAt, year)) {
          seasonId = season.id;
          seasonYear = year;
          break;
        }
      }
      if (!seasonId) unmatchedKickoff += 1;
    } else if (seasonId) {
      const season = seasons.find((s) => s.id === seasonId);
      seasonYear = season?.year ?? null;
    }

    const stage = stageFromRound(fx.round);
    if (stage !== "regular") playoffCount += 1;

    const label = seasonYear != null ? String(seasonYear) : "unmatched";
    const key = `${label}|${stage}`;
    bySeasonStage.set(key, (bySeasonStage.get(key) ?? 0) + 1);

    if (!APPLY) continue;

    const updates: Partial<typeof fixtures.$inferInsert> = {};
    if (!fx.seasonId && seasonId) {
      updates.seasonId = seasonId;
      seasonLinked += 1;
    }
    if (fx.stage !== stage) {
      updates.stage = stage;
      stageSet += 1;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(fixtures).set(updates).where(eq(fixtures.id, fx.id));
    }
  }

  console.log(`\n# Premiership fixture season/stage ${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  console.log(`Total fixtures: ${allFx.length}`);
  console.log(`Playoff-classified (by round): ${playoffCount}`);
  console.log(`Unmatched kickoffs (no season window): ${unmatchedKickoff}`);
  if (APPLY) {
    console.log(`season_id linked: ${seasonLinked}`);
    console.log(`stage updated: ${stageSet}`);
  }

  console.log(`\n## Counts by season year | stage\n`);
  const sorted = [...bySeasonStage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, count] of sorted) {
    if (key.includes("|regular") && count > 20) {
      console.log(`${key}: ${count}`);
    } else if (!key.includes("|regular") || count <= 20) {
      console.log(`${key}: ${count}`);
    }
  }

  // Active season flag check + fix
  const currentYear = 2025; // 2025–26 is current completed/ongoing domestic year for this project state
  const active = seasons.filter((s) => s.isActive);
  console.log(`\n## Active season flags`);
  console.log(
    active.map((s) => `${s.label} deprecated=${s.isDeprecated}`).join(", ") || "(none)",
  );

  if (APPLY) {
    await db
      .update(competitionSeasons)
      .set({ isActive: false })
      .where(eq(competitionSeasons.competitionId, comp.id));
    const current = seasonsByYear.get(currentYear);
    if (current) {
      await db
        .update(competitionSeasons)
        .set({ isActive: true, isDeprecated: false })
        .where(eq(competitionSeasons.id, current.id));
      console.log(`Set active: ${current.label}`);
    }
    // Ensure 2026–27 stay inactive if present
    const future = seasonsByYear.get(2026);
    if (future) {
      await db
        .update(competitionSeasons)
        .set({ isActive: false })
        .where(eq(competitionSeasons.id, future.id));
      console.log(`Cleared active on: ${future.label}`);
    }
  }

  // Null season_id remaining after dry-run analysis
  const nullSeason = allFx.filter((f) => !f.seasonId).length;
  console.log(`\nFixtures with null season_id currently: ${nullSeason}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
