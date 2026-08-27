/**
 * Enrich Nov 2025 Springboks EOY internationals for Sacha (and attach source URLs).
 * Uses Planet Rugby / SDMS match IDs + the springboks.rugby / Six Nations links provided.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-sa-nov2025-internationals.ts
 */
import { and, eq, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, playerMatchPerformanceStats, players } from "@rugby365/db";
import { fetchSdmsMatchDetail, fetchSdmsMatchPlayerStats, parseMatchPlayerPerformance } from "@rugby365/import-sdk";
import { getDb } from "../apps/web/src/lib/db";
import { updateFixtureSources } from "../apps/web/src/lib/fixture-admin-service";
import { upsertMatchPerformanceStat } from "../apps/web/src/lib/player-season-stats-service";
import { calculateAndPersistPlayerRating } from "../apps/web/src/lib/player-bio-packet-service";
import { ensureMissingFixturePlayerMatchRatings } from "../apps/web/src/lib/match-rating-service";

const SACHA_ID = "6ffbe0ac-79ab-4838-a778-25b010c9ffb3";
const SA_TEAM_ID = "b0000000-0000-4000-8000-000000000001";

const MATCHES: Array<{
  label: string;
  sdmsMatchId: string;
  date: string;
  sport365Url: string | null;
  highlightsUrl: string | null;
  sixNationsReportUrl: string | null;
}> = [
  {
    label: "South Africa v Japan",
    sdmsMatchId: "7jq34416",
    date: "2025-11-01",
    sport365Url:
      "https://springboks.rugby/match-centre/match/castle-lager-outgoing-tour/japan-v-springboks/5fb5c488-446c-4937-916a-d81c30cb1909",
    highlightsUrl: null,
    sixNationsReportUrl: null,
  },
  {
    label: "France v South Africa",
    sdmsMatchId: "d9rx2o19",
    date: "2025-11-08",
    sport365Url: null,
    highlightsUrl:
      "https://springboks.rugby/video-hub/highlights-springboks-vs-france-in-paris",
    sixNationsReportUrl: null,
  },
  {
    label: "Ireland v South Africa",
    sdmsMatchId: "56elpdv9",
    date: "2025-11-22",
    sport365Url:
      "https://springboks.rugby/match-centre/match/castle-lager-outgoing-tour/ireland-v-springboks/996bdf0c-c663-4a0b-b2a4-78d9e2f54334",
    highlightsUrl: null,
    sixNationsReportUrl: null,
  },
  {
    label: "Wales v South Africa",
    sdmsMatchId: "16oqrxvj",
    date: "2025-11-29",
    sport365Url: null,
    highlightsUrl: null,
    sixNationsReportUrl:
      "https://www.sixnationsrugby.com/en/autumn-nations-series/fixtures/202500/wales-v-south-africa-29112025-1510/report",
  },
];

function countPlayerScores(
  detail: Awaited<ReturnType<typeof fetchSdmsMatchDetail>>,
  playerId: string,
) {
  let tries = 0;
  let conversions = 0;
  let penalties = 0;
  let dropGoals = 0;
  const d = detail?.detail as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") {
    return { tries, conversions, penalties, dropGoals, points: 0 };
  }
  const buckets: Array<[string, "tries" | "conversions" | "penalties" | "dropGoals"]> = [
    ["home_tries", "tries"],
    ["away_tries", "tries"],
    ["home_conversions", "conversions"],
    ["away_conversions", "conversions"],
    ["home_penalties", "penalties"],
    ["away_penalties", "penalties"],
    ["home_drop_goals", "dropGoals"],
    ["away_drop_goals", "dropGoals"],
  ];
  for (const [key, kind] of buckets) {
    const list = d[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const row = item as { player_id?: string; player_name?: string };
      if (String(row.player_id ?? "") !== playerId) continue;
      const mins = [...String(row.player_name ?? "").matchAll(/(\d+)'/g)];
      const n = Math.max(1, mins.length || 1);
      if (kind === "tries") tries += n;
      else if (kind === "conversions") conversions += n;
      else if (kind === "penalties") penalties += n;
      else dropGoals += n;
    }
  }
  return {
    tries,
    conversions,
    penalties,
    dropGoals,
    points: tries * 5 + conversions * 2 + penalties * 3 + dropGoals * 3,
  };
}

async function main() {
  const db = getDb();
  const [sacha] = await db
    .select({
      id: players.id,
      externalProviderId: players.externalProviderId,
    })
    .from(players)
    .where(eq(players.id, SACHA_ID))
    .limit(1);
  if (!sacha?.externalProviderId) throw new Error("Sacha SDMS id missing");

  const results: Array<Record<string, unknown>> = [];

  for (const match of MATCHES) {
    const [fx] = await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.externalMatchId, match.sdmsMatchId))
      .limit(1);
    if (!fx?.homeTeamId || !fx.awayTeamId) {
      results.push({ label: match.label, error: "fixture missing" });
      continue;
    }
    console.log(`\n→ ${match.label}`);

    let [fp] = await db
      .select()
      .from(fixturePlayers)
      .where(and(eq(fixturePlayers.fixtureId, fx.id), eq(fixturePlayers.playerId, SACHA_ID)))
      .limit(1);
    if (!fp) {
      const teamId = fx.homeTeamId === SA_TEAM_ID ? fx.homeTeamId : fx.awayTeamId;
      await db.insert(fixturePlayers).values({
        fixtureId: fx.id,
        playerId: SACHA_ID,
        teamId,
        squadRole: "starting",
        jerseyNumber: 10,
        tries: 0,
        conversions: 0,
        penalties: 0,
        dropGoals: 0,
        points: 0,
      });
      [fp] = await db
        .select()
        .from(fixturePlayers)
        .where(and(eq(fixturePlayers.fixtureId, fx.id), eq(fixturePlayers.playerId, SACHA_ID)))
        .limit(1);
    }

    const [detail, playerStats] = await Promise.all([
      fetchSdmsMatchDetail(match.sdmsMatchId, { timeoutMs: 20_000 }),
      fetchSdmsMatchPlayerStats(match.sdmsMatchId, { timeoutMs: 25_000 }),
    ]);
    const scoring = countPlayerScores(detail, sacha.externalProviderId);
    const parsed = parseMatchPlayerPerformance(playerStats).find((row) => {
      const name = row.playerName.toLowerCase();
      return (
        row.externalPlayerId === sacha.externalProviderId ||
        name.includes("feinberg") ||
        name.includes("mngomezulu")
      );
    });
    if (!parsed || !fp) {
      results.push({ label: match.label, error: "no SDMS player stats" });
      continue;
    }

    await db
      .update(fixturePlayers)
      .set({
        tries: scoring.tries,
        conversions: scoring.conversions,
        penalties: scoring.penalties,
        dropGoals: scoring.dropGoals,
        points: scoring.points,
        squadRole: fp.squadRole ?? "starting",
        jerseyNumber: fp.jerseyNumber ?? 10,
      })
      .where(and(eq(fixturePlayers.fixtureId, fx.id), eq(fixturePlayers.playerId, SACHA_ID)));

    const teamId = parsed.side === "home" ? fx.homeTeamId : fx.awayTeamId;
    await upsertMatchPerformanceStat({
      fixtureId: fx.id,
      playerId: SACHA_ID,
      teamId,
      seasonId: fx.seasonId,
      competitionId: fx.competitionId,
      externalMatchId: match.sdmsMatchId,
      externalPlayerId: parsed.externalPlayerId,
      stats: {
        ...parsed,
        tries: scoring.tries,
        points: scoring.points,
      },
    });

    if (match.sport365Url) {
      await updateFixtureSources(fx.id, { sport365Url: match.sport365Url });
    }
    const base =
      fx.providerSnapshot && typeof fx.providerSnapshot === "object"
        ? (fx.providerSnapshot as Record<string, unknown>)
        : {};
    await db
      .update(fixtures)
      .set({
        status: "full_time",
        ...(match.highlightsUrl ? { highlightsYoutubeUrl: match.highlightsUrl } : {}),
        providerSnapshot: {
          ...base,
          springboksMatchUrl: match.sport365Url,
          sixNationsReportUrl: match.sixNationsReportUrl,
          highlightsUrl: match.highlightsUrl,
          enrichedFrom: "sa-nov2025-internationals",
          enrichedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(fixtures.id, fx.id));

    const wikiDupes = await db.execute<{ id: string }>(sql`
      SELECT f.id
      FROM fixtures f
      JOIN fixture_players fp ON fp.fixture_id = f.id AND fp.player_id = ${SACHA_ID}::uuid
      WHERE f.kickoff_at::date = ${match.date}::date
        AND f.id <> ${fx.id}::uuid
        AND f.external_match_id LIKE 'wikipedia:%'
    `);
    const wikiIds = wikiDupes.rows ?? (wikiDupes as unknown as Array<{ id: string }>);
    for (const row of wikiIds) {
      await db
        .delete(fixturePlayers)
        .where(and(eq(fixturePlayers.fixtureId, row.id), eq(fixturePlayers.playerId, SACHA_ID)));
    }

    try {
      await ensureMissingFixturePlayerMatchRatings(fx.id, {
        matchId: match.sdmsMatchId,
        allowSdmsEnrich: false,
      });
    } catch (error) {
      console.warn("  ratings", error instanceof Error ? error.message : error);
    }

    const [perf] = await db
      .select({
        minutes: playerMatchPerformanceStats.minutesPlayed,
        metres: playerMatchPerformanceStats.metresCarried,
        points: playerMatchPerformanceStats.points,
      })
      .from(playerMatchPerformanceStats)
      .where(
        and(
          eq(playerMatchPerformanceStats.fixtureId, fx.id),
          eq(playerMatchPerformanceStats.playerId, SACHA_ID),
        ),
      )
      .limit(1);

    results.push({
      label: match.label,
      fixtureId: fx.id,
      scoring,
      perf,
      wikiDupesCleared: wikiIds.length,
    });
    console.log("  ok", { scoring, minutes: perf?.minutes, metres: perf?.metres });
  }

  await calculateAndPersistPlayerRating(SACHA_ID);
  console.log("\nDone:", JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
