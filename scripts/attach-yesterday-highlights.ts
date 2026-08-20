/**
 * Attach YouTube match highlights for games played ~yesterday (2026-08-08).
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/attach-yesterday-highlights.ts
 */
import { and, gte, lte, eq, desc } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "../apps/web/src/lib/db";
import { fixtureTeamsLikelyMatch } from "../apps/web/src/lib/rugbypass-fixture-match";
import { updateFixture } from "../apps/web/src/lib/fixture-admin-service";

type HighlightSpec = {
  label: string;
  homeHints: string[];
  awayHints: string[];
  youtubeUrl: string;
  competitionHints?: string[];
};

const SPECS: HighlightSpec[] = [
  {
    label: "Auckland v Wellington",
    homeHints: ["Auckland"],
    awayHints: ["Wellington"],
    youtubeUrl: "https://www.youtube.com/watch?v=AlUk8jS8GlE",
    competitionHints: ["npc", "hilux"],
  },
  {
    label: "Bay of Plenty v Northland",
    homeHints: ["Bay of Plenty", "BoP"],
    awayHints: ["Northland"],
    youtubeUrl: "https://www.youtube.com/watch?v=nqOMpVjMWXQ",
    competitionHints: ["npc", "hilux"],
  },
  {
    label: "Hawke's Bay v Tasman",
    homeHints: ["Hawke's Bay", "Hawkes Bay", "Hawke"],
    awayHints: ["Tasman"],
    youtubeUrl: "https://www.youtube.com/watch?v=e6NXVH7_SCs",
    competitionHints: ["npc", "hilux"],
  },
  {
    label: "Wallabies v Japan",
    homeHints: ["Australia", "Wallabies"],
    awayHints: ["Japan"],
    youtubeUrl: "https://www.youtube.com/watch?v=YR2pUSjBkRA",
  },
  {
    label: "Argentina vs South Africa",
    homeHints: ["Argentina", "Los Pumas", "Pumas"],
    awayHints: ["South Africa", "Springboks"],
    youtubeUrl: "https://www.youtube.com/watch?v=N_QcPmKH0f8",
  },
  {
    label: "Griquas vs Lions",
    homeHints: ["Griquas", "Suzuki Griquas"],
    awayHints: ["Lions", "Fidelity ADT Lions", "Golden Lions"],
    youtubeUrl: "https://www.youtube.com/watch?v=DLFL-scwbbE",
    competitionHints: ["currie"],
  },
  {
    label: "Sharks XV v Boland Kavaliers",
    homeHints: ["Sharks XV", "Sharks"],
    awayHints: ["Boland", "Kavaliers", "Cavaliers"],
    youtubeUrl: "https://www.youtube.com/watch?v=bk_zDkgqbJ8",
    competitionHints: ["currie"],
  },
];

function sideMatches(teamName: string | null, hints: string[]): boolean {
  if (!teamName) return false;
  return hints.some((h) => fixtureTeamsLikelyMatch(teamName, h) || teamName.toLowerCase().includes(h.toLowerCase()));
}

function pairMatches(
  home: string | null,
  away: string | null,
  spec: HighlightSpec,
): boolean {
  const forward = sideMatches(home, spec.homeHints) && sideMatches(away, spec.awayHints);
  const reverse = sideMatches(home, spec.awayHints) && sideMatches(away, spec.homeHints);
  return forward || reverse;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = getDb();
  const homeTeam = alias(teams, "hl_home");
  const awayTeam = alias(teams, "hl_away");

  // Yesterday relative to Sun 9 Aug 2026 → Sat 8 Aug; widen ±1 day for TZ.
  const from = new Date("2026-08-07T00:00:00.000Z");
  const to = new Date("2026-08-09T23:59:59.999Z");

  const rows = await db
    .select({
      id: fixtures.id,
      slug: fixtures.slug,
      kickoffAt: fixtures.kickoffAt,
      competitionName: fixtures.competitionName,
      status: fixtures.status,
      highlightsYoutubeUrl: fixtures.highlightsYoutubeUrl,
      homeName: homeTeam.name,
      awayName: awayTeam.name,
    })
    .from(fixtures)
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .where(and(gte(fixtures.kickoffAt, from), lte(fixtures.kickoffAt, to)))
    .orderBy(desc(fixtures.kickoffAt));

  console.log(`Fixtures ${from.toISOString().slice(0, 10)} → ${to.toISOString().slice(0, 10)}: ${rows.length}`);

  const results: Array<{
    label: string;
    matched: boolean;
    fixtureId?: string;
    fixture?: string;
    previous?: string | null;
    action?: string;
  }> = [];

  for (const spec of SPECS) {
    const candidates = rows.filter((r) => pairMatches(r.homeName, r.awayName, spec));
    let best = candidates[0] ?? null;

    if (candidates.length > 1 && spec.competitionHints?.length) {
      const preferred = candidates.find((c) =>
        spec.competitionHints!.some((h) =>
          (c.competitionName || "").toLowerCase().includes(h.toLowerCase()),
        ),
      );
      if (preferred) best = preferred;
    }

    if (!best) {
      // Fallback: search a wider window (±7 days) if not in weekend window
      const wideFrom = new Date("2026-08-01T00:00:00.000Z");
      const wideTo = new Date("2026-08-12T23:59:59.999Z");
      const wide = await db
        .select({
          id: fixtures.id,
          slug: fixtures.slug,
          kickoffAt: fixtures.kickoffAt,
          competitionName: fixtures.competitionName,
          status: fixtures.status,
          highlightsYoutubeUrl: fixtures.highlightsYoutubeUrl,
          homeName: homeTeam.name,
          awayName: awayTeam.name,
        })
        .from(fixtures)
        .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
        .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
        .where(and(gte(fixtures.kickoffAt, wideFrom), lte(fixtures.kickoffAt, wideTo)))
        .orderBy(desc(fixtures.kickoffAt));

      const wideCandidates = wide.filter((r) => pairMatches(r.homeName, r.awayName, spec));
      best = wideCandidates[0] ?? null;
      if (wideCandidates.length > 1 && spec.competitionHints?.length) {
        const preferred = wideCandidates.find((c) =>
          spec.competitionHints!.some((h) =>
            (c.competitionName || "").toLowerCase().includes(h.toLowerCase()),
          ),
        );
        if (preferred) best = preferred;
      }
    }

    if (!best) {
      results.push({ label: spec.label, matched: false });
      continue;
    }

    const already = best.highlightsYoutubeUrl?.trim();
    if (already === spec.youtubeUrl) {
      results.push({
        label: spec.label,
        matched: true,
        fixtureId: best.id,
        fixture: `${best.homeName} v ${best.awayName} (${best.kickoffAt?.toISOString()})`,
        previous: already,
        action: "unchanged",
      });
      continue;
    }

    if (!dryRun) {
      await updateFixture(best.id, { highlightsYoutubeUrl: spec.youtubeUrl });
    }

    results.push({
      label: spec.label,
      matched: true,
      fixtureId: best.id,
      fixture: `${best.homeName} v ${best.awayName} · ${best.competitionName ?? "—"} · ${best.kickoffAt?.toISOString()}`,
      previous: already ?? null,
      action: dryRun ? "would-set" : already ? "replaced" : "set",
    });
  }

  console.log(JSON.stringify(results, null, 2));
  const missing = results.filter((r) => !r.matched);
  if (missing.length) {
    console.error(`\nUnmatched (${missing.length}): ${missing.map((m) => m.label).join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} highlights attached${dryRun ? " (dry-run)" : ""}.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
