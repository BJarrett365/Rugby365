/**
 * Audit Coach Intelligence inputs for Rassie's current SA tenure (2024–).
 */
import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerMatchRatings,
  teamMatchStats,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { loadCoachEligibleMatches } from "../apps/web/src/lib/coach-career-record-service";
import { calculateCoachRatingBundle } from "../apps/web/src/lib/coach-rating-service";
import { isFixtureRatingsPublished } from "../apps/web/src/lib/match-rating-math";

const RASSIE = "dbe4562a-7255-42c4-bb70-653153c4da3c";
const SA = "b0000000-0000-4000-8000-000000000001";
const TENURE_START = new Date("2024-02-06T00:00:00.000Z");

function num(sections: unknown, path: string[]): number | null {
  let cur: unknown = sections;
  for (const p of path) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (typeof cur === "number" && Number.isFinite(cur)) return cur;
  if (typeof cur === "string" && cur.trim() && Number.isFinite(Number(cur))) return Number(cur);
  return null;
}

function hasAny(sections: unknown, paths: string[][]): boolean {
  return paths.some((p) => num(sections, p) != null);
}

async function main() {
  const db = getDb();
  const all = await loadCoachEligibleMatches(RASSIE, { primaryOnly: true });
  const current = all
    .filter((m) => m.teamId === SA && m.kickoffAt && m.kickoffAt >= TENURE_START)
    .sort((a, b) => (b.kickoffAt?.getTime() ?? 0) - (a.kickoffAt?.getTime() ?? 0));

  console.log("=== CURRENT TENURE MATCHES ===");
  console.log({ totalEligibleCareer: all.length, currentTenure: current.length });

  const ids = current.map((m) => m.id);
  const recent20 = current.slice(0, 20);
  const recentIds = recent20.map((m) => m.id);

  const stats = recentIds.length
    ? await db
        .select()
        .from(teamMatchStats)
        .where(and(inArray(teamMatchStats.fixtureId, recentIds), eq(teamMatchStats.teamId, SA)))
    : [];

  const byFixture = new Map<string, (typeof stats)[number]>();
  for (const row of stats) {
    const existing = byFixture.get(row.fixtureId);
    if (!existing || (row.sourceProvider === "sdms" && existing.sourceProvider !== "sdms")) {
      byFixture.set(row.fixtureId, row);
    }
  }

  const probes: Record<string, string[][]> = {
    scrum: [
      ["set_piece", "scrum_success_percentage"],
      ["set_piece", "scrums_won"],
      ["set_piece", "scrums_lost"],
      ["cms_metrics", "scrum_success"],
    ],
    lineout: [
      ["set_piece", "lineout_success_percentage"],
      ["set_piece", "lineouts_won"],
      ["set_piece", "lineouts_lost"],
      ["cms_metrics", "lineout_success"],
    ],
    maul: [["set_piece", "mauls_won"], ["set_piece", "maul_success_percentage"]],
    breakdown_turnovers: [
      ["rucks", "turnovers_won"],
      ["attack", "turnovers_won"],
      ["cms_metrics", "turnovers_won"],
    ],
    ruck: [
      ["rucks", "ruck_success_percentage"],
      ["rucks", "rucks_won"],
      ["rucks", "rucks_lost"],
    ],
    kicking_goal: [
      ["kicking", "goal_kick_percentage"],
      ["kicking", "conversions_successful"],
      ["cms_metrics", "goal_kick_pct"],
    ],
    kicking_tact: [
      ["kicking", "metres"],
      ["kicking", "kicks_from_hand"],
      ["kicking", "kick_metres"],
    ],
    discipline_pen: [
      ["discipline", "penalties_conceded"],
      ["cms_metrics", "penalties_conceded"],
      ["set_piece", "scrum_penalties_conceded"],
    ],
    cards: [
      ["discipline", "yellow_cards"],
      ["discipline", "red_cards"],
      ["cms_metrics", "yellow_cards"],
      ["cms_metrics", "red_cards"],
    ],
    attack_metres: [["attack", "metres"], ["cms_metrics", "metres"]],
    attack_breaks: [
      ["attack", "line_breaks"],
      ["attack", "clean_breaks"],
      ["cms_metrics", "line_breaks"],
    ],
    defence_tackle: [
      ["defence", "tackle_success_percentage"],
      ["defence", "tackles_made"],
      ["cms_metrics", "tackle_success"],
    ],
    possession: [["possession", "overall_percentage"]],
    territory: [["territory", "overall_percentage"]],
  };

  const coverage: Record<string, { have: number; of: number; sampleKeys: string[] }> = {};
  for (const [name, paths] of Object.entries(probes)) {
    let have = 0;
    const sampleKeys = new Set<string>();
    for (const id of recentIds) {
      const row = byFixture.get(id);
      if (!row) continue;
      if (hasAny(row.sections, paths) || (name === "breakdown_turnovers" && (row.turnoversWon ?? 0) > 0)) {
        have += 1;
      }
      if (row.sections && typeof row.sections === "object") {
        for (const [sec, vals] of Object.entries(row.sections as Record<string, unknown>)) {
          if (vals && typeof vals === "object") {
            for (const k of Object.keys(vals as object)) sampleKeys.add(`${sec}.${k}`);
          }
        }
      }
    }
    coverage[name] = { have, of: recentIds.length, sampleKeys: [...sampleKeys].slice(0, 40) };
  }

  // Collect all section keys across recent SA stats
  const allKeys = new Set<string>();
  for (const row of byFixture.values()) {
    if (!row.sections || typeof row.sections !== "object") continue;
    for (const [sec, vals] of Object.entries(row.sections as Record<string, unknown>)) {
      if (vals && typeof vals === "object") {
        for (const k of Object.keys(vals as object)) allKeys.add(`${sec}.${k}`);
      }
    }
  }

  console.log("\n=== RECENT 20 SA TEAM STAT SECTION KEYS ===");
  console.log([...allKeys].sort().join("\n"));

  console.log("\n=== INPUT COVERAGE (last 20 current-tenure matches) ===");
  for (const [k, v] of Object.entries(coverage)) {
    console.log(`${k}: ${v.have}/${v.of} (${v.of ? Math.round((100 * v.have) / v.of) : 0}%)`);
  }

  // Lineups / ratings
  let lineupHave = 0;
  let ratingHave = 0;
  if (recentIds.length) {
    const [lu] = await db
      .select({ n: sql<number>`count(distinct ${fixturePlayers.fixtureId})::int` })
      .from(fixturePlayers)
      .where(inArray(fixturePlayers.fixtureId, recentIds));
    lineupHave = lu?.n ?? 0;
    const [pr] = await db
      .select({ n: sql<number>`count(distinct ${playerMatchRatings.fixtureId})::int` })
      .from(playerMatchRatings)
      .where(
        and(inArray(playerMatchRatings.fixtureId, recentIds), eq(playerMatchRatings.teamId, SA)),
      );
    ratingHave = pr?.n ?? 0;
  }
  console.log(`lineups: ${lineupHave}/${recentIds.length}`);
  console.log(`player_ratings: ${ratingHave}/${recentIds.length}`);
  console.log(`team_stats_rows: ${byFixture.size}/${recentIds.length}`);

  // Sample one rich row
  const rich = [...byFixture.values()].find((r) => {
    const s = r.sections as Record<string, unknown> | null;
    return s && Object.keys(s).length > 3;
  });
  if (rich) {
    console.log("\n=== SAMPLE SECTIONS (one match) ===");
    console.log(JSON.stringify({ fixtureId: rich.fixtureId, provider: rich.sourceProvider, sections: rich.sections, tries: rich.tries, metres: rich.metres, tackles: rich.tackles, turnoversWon: rich.turnoversWon }, null, 2).slice(0, 4000));
  }

  const bundle = await calculateCoachRatingBundle(RASSIE);
  console.log("\n=== CURRENT SCORES (legacy engine) ===");
  for (const m of bundle.metrics) {
    console.log(`${m.key}: score=${m.score ?? "—"} note=${m.raw ?? ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
