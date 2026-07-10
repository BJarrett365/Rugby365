#!/usr/bin/env npx tsx
import { and, eq } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures, standingRows, teams } from "@rugby365/db";
import { isPlayoffRound } from "@rugby365/import-sdk";
import { kickoffInSeason } from "../apps/web/src/lib/season-label-utils";
import { getDb } from "../apps/web/src/lib/db";

async function main() {
  const db = getDb();
  const [comp] = await db.select().from(competitions).where(eq(competitions.slug, "premiership")).limit(1);
  if (!comp) return;

  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, comp.id));

  const byYear = new Map<number, typeof seasons>();
  for (const s of seasons) {
    const list = byYear.get(s.year) ?? [];
    list.push(s);
    byYear.set(s.year, list);
  }
  const multi = [...byYear.entries()].filter(([, v]) => v.length > 1);
  console.log("Years with multiple records:", multi.length);
  for (const [y, list] of multi) {
    console.log(
      ` ${y}:`,
      list.map((s) => `${s.label}/${s.slug} dep=${s.isDeprecated} active=${s.isActive} id=${s.id.slice(0, 8)}`),
    );
  }

  const allFx = await db
    .select({
      kickoffAt: fixtures.kickoffAt,
      round: fixtures.round,
      status: fixtures.status,
      snapshot: fixtures.providerSnapshot,
    })
    .from(fixtures)
    .where(eq(fixtures.competitionId, comp.id));

  // 2013-14
  const inWindow2013 = allFx.filter((f) => f.kickoffAt && kickoffInSeason(f.kickoffAt, 2013));
  const cal2013 = allFx.filter(
    (f) =>
      f.kickoffAt &&
      (f.kickoffAt.getFullYear() === 2013 || f.kickoffAt.getFullYear() === 2014) &&
      !kickoffInSeason(f.kickoffAt, 2013),
  );
  console.log("\n2013-14 inWindow:", inWindow2013.length, "calendar leak:", cal2013.length);
  if (cal2013[0]?.kickoffAt) {
    console.log("  leak sample dates:", cal2013.slice(0, 5).map((f) => f.kickoffAt?.toISOString().slice(0, 10)));
  }

  // 2020-21 snapshot mismatches
  const s2020 = seasons.find((s) => s.year === 2020 && !s.isDeprecated);
  if (s2020) {
    const fx2020 = allFx.filter((f) => f.kickoffAt && kickoffInSeason(f.kickoffAt, 2020));
    const mismatches = fx2020.filter((f) => {
      const snap = f.snapshot as { livesport?: { seasonId?: string } } | null;
      return snap?.livesport?.seasonId && snap.livesport.seasonId !== s2020.id;
    });
    const wrongSeasonIds = [...new Set(mismatches.map((f) => (f.snapshot as any)?.livesport?.seasonId))];
    console.log("\n2020-21 snapshot mismatches:", mismatches.length, "wrong season IDs:", wrongSeasonIds);
    for (const wrongId of wrongSeasonIds.slice(0, 3)) {
      const wrong = seasons.find((s) => s.id === wrongId);
      console.log(`  points to: ${wrong?.label ?? wrongId}`);
    }
  }

  // Standings source: SDMS vs computed from fixtures for 2024-25
  const s2024 = seasons.find((s) => s.year === 2024 && !s.isDeprecated);
  if (s2024) {
    const standings = await db
      .select({ played: standingRows.played, name: teams.name })
      .from(standingRows)
      .innerJoin(teams, eq(standingRows.teamId, teams.id))
      .where(and(eq(standingRows.seasonId, s2024.id), eq(standingRows.view, "overall")));
    const teamFxCount = new Map<string, number>();
    for (const f of allFx) {
      if (!f.kickoffAt || !kickoffInSeason(f.kickoffAt, 2024)) continue;
      if (isPlayoffRound(f.round) || f.status !== "full_time") continue;
      // can't count per team without home/away ids in this query - skip
    }
    const played17 = standings.filter((s) => s.played === 17);
    const played18 = standings.filter((s) => s.played === 18);
    console.log("\n2024-25 played=17:", played17.map((s) => s.name).join(", "));
    console.log("2024-25 played=18:", played18.map((s) => s.name).join(", "));
  }

  console.log("\nActive season flags:", seasons.filter((s) => s.isActive).map((s) => `${s.label} dep=${s.isDeprecated}`));
}

main();
