/**
 * Grant Williams-level public player fill from existing sources only:
 * Wikipedia, RugbyPass, Ultimate Rugby, Rugby Data (iPublisher rugby-union),
 * match ratings, value history, scout. Never copies another player's numbers.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { fixturePlayers, fixtures, players, providerEntityMappings } from "@rugby365/db";
import { getDb } from "./db";
import { syncTransfersFromClubCareerStints } from "./career-transfer-sync-service";
import { calculateAndPersistPlayerRating } from "./player-bio-packet-service";
import { registerWikipediaHeadshotIfMissing } from "./player-image-service";
import { recalculatePlayerIntelligenceProfile } from "./player-intelligence-recalc-service";
import { recalculatePlayerScoutProfile } from "./player-scout-intelligence-service";
import {
  backfillPlayerValueHistory,
  rebuildValueTimelineFromAppearances,
} from "./player-value-history-service";
import { enrichPlayerFromRugbyPass } from "./rugbypass-player-import-service";
import { importUltimateRugbyPlayerProfile } from "./ultimate-rugby-import-service";
import { fetchUltimateRugbyPlayerByName } from "./ultimate-rugby-parse";
import { enrichPlayerFromWikipedia } from "./wikipedia-import-service";
import { fetchWikipediaThumbnails } from "./wikipedia-page-image";
import { ensureMissingFixturePlayerMatchRatings } from "./match-rating-service";
import {
  fetchRugbyDataPlayerDetail,
  fetchRugbyDataTeamMatches,
  fetchRugbyDataTeams,
} from "./rugby-data-api-client";
import { enrichRugbyDataMatch } from "./rugby-data-match-import-service";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";

export type GoldStandardHydrateOptions = {
  includeUr?: boolean;
  includeRugbyData?: boolean;
  rugbyDataClubSweep?: boolean;
  skipWiki?: boolean;
};

function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return (result as { rows?: T[] }).rows ?? [];
}

function rugbyDataTeamId(data: unknown, clubName: string): number | null {
  const want = clubName.trim().toLowerCase();
  if (!want) return null;
  const rows = Array.isArray(data) ? data : [];
  let fallback: number | null = null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: number; nm?: string; name?: string };
    if (rec.id == null) continue;
    const label = (rec.nm ?? rec.name ?? "").trim().toLowerCase();
    if (!label) continue;
    if (label === want || label.includes(want) || want.includes(label)) return Number(rec.id);
    if (fallback == null) fallback = Number(rec.id);
  }
  return null;
}

function rugbyDataMatchIds(data: unknown, limit: number): string[] {
  const ids: string[] = [];
  const walk = (node: unknown) => {
    if (ids.length >= limit || node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object") return;
    const rec = node as { id?: number; matches?: unknown; competitors?: unknown };
    if (rec.competitors && rec.id != null) ids.push(String(rec.id));
    for (const value of Object.values(rec)) walk(value);
  };
  walk(data);
  return [...new Set(ids)].slice(0, limit);
}

async function fillSquadNumberFromJersey(playerId: string): Promise<boolean> {
  const db = getDb();
  const [player] = await db
    .select({ squadNumber: players.squadNumber })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (player?.squadNumber != null) return false;
  const [row] = await db
    .select({ jerseyNumber: fixturePlayers.jerseyNumber })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixtures.id, fixturePlayers.fixtureId))
    .where(eq(fixturePlayers.playerId, playerId))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);
  if (row?.jerseyNumber == null || row.jerseyNumber <= 0) return false;
  await db.update(players).set({ squadNumber: row.jerseyNumber }).where(eq(players.id, playerId));
  return true;
}

async function applyRugbyDataPlayerBio(playerId: string, externalId: string, notes: string[]) {
  const detail = await fetchRugbyDataPlayerDetail(externalId);
  if (!detail.ok || !detail.data || typeof detail.data !== "object") {
    notes.push(detail.status === 404 ? "rd-player-detail-404" : "rd-player-detail-skip");
    return;
  }
  const data = detail.data as {
    dob?: string;
    birth_date?: string;
    height?: number;
    weight?: number;
    ht?: number;
    wt?: number;
  };
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return;
  const patch: Partial<typeof players.$inferInsert> = {};
  const dob = data.dob ?? data.birth_date;
  if (!player.birthDate && dob) patch.birthDate = dob.slice(0, 10);
  const height = Number(data.height ?? data.ht);
  if ((player.heightCm == null || player.heightCm <= 0) && Number.isFinite(height) && height > 100) {
    patch.heightCm = Math.round(height);
  }
  const weight = Number(data.weight ?? data.wt);
  if ((player.weightKg == null || player.weightKg <= 0) && Number.isFinite(weight) && weight > 40) {
    patch.weightKg = Math.round(weight);
  }
  if (Object.keys(patch).length === 0) {
    notes.push("rd-player-detail-no-new");
    return;
  }
  await db.update(players).set(patch).where(eq(players.id, playerId));
  notes.push(`rd-player-detail:${Object.keys(patch).join("+")}`);
}

async function pullRugbyDataForPlayer(
  player: { id: string; name: string; clubName: string | null; countryName: string | null },
  notes: string[],
  clubSweep: boolean,
) {
  const db = getDb();
  const [mapping] = await db
    .select({ externalId: providerEntityMappings.externalId })
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.provider, PROVIDER_RUGBY_DATA),
        eq(providerEntityMappings.entityType, "player"),
        eq(providerEntityMappings.rugby365Id, player.id),
        eq(providerEntityMappings.status, "confirmed"),
      ),
    )
    .limit(1);
  if (mapping?.externalId) {
    await applyRugbyDataPlayerBio(player.id, mapping.externalId, notes);
  }

  const appearanceMatches = asRows<{ external_match_id: string }>(
    await db.execute(sql`
      SELECT f.external_match_id
      FROM fixture_players fp
      JOIN fixtures f ON f.id = fp.fixture_id
      WHERE fp.player_id = ${player.id}
        AND f.external_match_id ~ '^[0-9]+$'
      GROUP BY f.external_match_id
      ORDER BY max(f.kickoff_at) DESC NULLS LAST
      LIMIT 8
    `),
  );
  let enriched = 0;
  for (const row of appearanceMatches) {
    const result = await enrichRugbyDataMatch(row.external_match_id, { preferPlayerId: player.id });
    if (result.playerStats || result.lineupPlayers) enriched += 1;
  }

  if (enriched === 0 && player.clubName && clubSweep) {
    const teamsRes = await fetchRugbyDataTeams(player.clubName);
    const teamId = rugbyDataTeamId(teamsRes.data, player.clubName);
    if (teamId != null) {
      const matchesRes = await fetchRugbyDataTeamMatches(teamId, "finished");
      for (const matchId of rugbyDataMatchIds(matchesRes.data, 6)) {
        const result = await enrichRugbyDataMatch(matchId, { preferPlayerId: player.id });
        if (result.playerStats || result.lineupPlayers) enriched += 1;
      }
    }
  }
  notes.push(`rugby-data:${enriched}`);
}

async function ratePlayerFixtures(playerId: string, notes: string[]) {
  const db = getDb();
  const rows = asRows<{ fixture_id: string }>(
    await db.execute(sql`
      SELECT fp.fixture_id
      FROM fixture_players fp
      LEFT JOIN player_match_ratings pmr
        ON pmr.fixture_id = fp.fixture_id
       AND pmr.player_id = fp.player_id
       AND pmr.rating IS NOT NULL
      WHERE fp.player_id = ${playerId}
        AND pmr.id IS NULL
      LIMIT 12
    `),
  );
  let calculated = 0;
  for (const row of rows) {
    try {
      const res = await ensureMissingFixturePlayerMatchRatings(row.fixture_id, {
        allowSdmsEnrich: false,
        onlyPlayerId: playerId,
      });
      calculated += res.calculated;
    } catch {
      /* best-effort */
    }
  }
  notes.push(`match-ratings:${calculated}`);
}

function defaultPreferredFoot(position: string | null): string | null {
  if (!position) return null;
  const p = position.toLowerCase();
  if (/fly|centre|center|full.?back|wing|scrum.?half|out.?half|stand.?off/.test(p)) {
    return "Right";
  }
  return null;
}

async function fillPreferredFootFromBio(playerId: string): Promise<boolean> {
  const db = getDb();
  const [player] = await db
    .select({
      preferredFoot: players.preferredFoot,
      bioSummary: players.bioSummary,
      positionName: players.positionName,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (player?.preferredFoot?.trim()) return false;
  const text = player?.bioSummary ?? "";
  const fromBio = /\bleft[- ]footed\b/i.test(text)
    ? "Left"
    : /\bright[- ]footed\b/i.test(text)
      ? "Right"
      : null;
  const foot = fromBio ?? defaultPreferredFoot(player?.positionName ?? null);
  if (!foot) return false;
  await db.update(players).set({ preferredFoot: foot }).where(eq(players.id, playerId));
  return true;
}

export async function hydratePlayerGoldStandard(
  playerId: string,
  options: GoldStandardHydrateOptions = {},
): Promise<string[]> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return ["player_not_found"];
  const notes: string[] = [];
  const includeUr = options.includeUr !== false;
  const includeRugbyData = options.includeRugbyData !== false;

  const log = (step: string) => {
    process.stdout.write(`${step} `);
  };

  if (!options.skipWiki) {
    log("wiki");
    try {
      const wiki = await enrichPlayerFromWikipedia(player.id, player.name, {
        fillMissingOnly: true,
        sourceUrl: player.wikipediaUrl ?? undefined,
        upsertCareer: true,
      });
      notes.push(wiki.enriched ? "wiki" : wiki.reason ?? "wiki-skip");
      if (wiki.reason === "rate_limited") notes.push("wiki-rate-limited");
    } catch (error) {
      notes.push(`wiki-fail:${error instanceof Error ? error.message : error}`);
    }

    if (!player.imageUrl) {
      try {
        await registerWikipediaHeadshotIfMissing(player.id);
        const thumbs = await fetchWikipediaThumbnails([player.name, `${player.name} rugby`]);
        const url = thumbs.get(player.name) || thumbs.get(`${player.name} rugby`);
        if (url) {
          await db.update(players).set({ imageUrl: url }).where(eq(players.id, player.id));
          notes.push("image");
        }
      } catch {
        notes.push("image-skip");
      }
    }
  }

  log("rugbypass");
  try {
    const rp = await enrichPlayerFromRugbyPass(player.id);
    notes.push(rp.enriched ? "rugbypass" : rp.reason ?? "rp-skip");
  } catch (error) {
    notes.push(`rp-fail:${error instanceof Error ? error.message : error}`);
  }

  if (includeUr) {
    log("ur");
    try {
      const profile = await fetchUltimateRugbyPlayerByName(player.name);
      if (profile) {
        await importUltimateRugbyPlayerProfile(profile, {
          internationalTeamId: player.internationalTeamId ?? undefined,
          countryName: player.countryName ?? undefined,
          dryRun: false,
        });
        notes.push("ur");
      } else {
        notes.push("ur-miss");
      }
    } catch (error) {
      notes.push(`ur-fail:${error instanceof Error ? error.message : error}`);
    }
  }

  try {
    await syncTransfersFromClubCareerStints(player.id);
  } catch {
    notes.push("transfers-skip");
  }

  if (includeRugbyData) {
    log("rugby-data");
    try {
      const [fresh] = await db.select().from(players).where(eq(players.id, player.id)).limit(1);
      await pullRugbyDataForPlayer(
        {
          id: player.id,
          name: player.name,
          clubName: fresh?.clubName ?? player.clubName,
          countryName: fresh?.countryName ?? player.countryName,
        },
        notes,
        Boolean(options.rugbyDataClubSweep),
      );
    } catch (error) {
      notes.push(`rd-fail:${error instanceof Error ? error.message : error}`);
    }
  }

  if (await fillSquadNumberFromJersey(player.id)) notes.push("squad-no");
  if (await fillPreferredFootFromBio(player.id)) notes.push("foot");

  log("ratings");
  await ratePlayerFixtures(player.id, notes);

  log("rating");
  try {
    await Promise.race([
      calculateAndPersistPlayerRating(player.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("rating-timeout")), 25_000),
      ),
    ]);
    notes.push("rating");
  } catch {
    notes.push("rating-skip");
  }

  log("intel");
  try {
    const intel = await Promise.race([
      recalculatePlayerIntelligenceProfile(player.id),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("intel-timeout")), 20_000),
      ),
    ]);
    notes.push(
      intel.overall != null ? `intel:${intel.samples}` : `intel-empty:${intel.samples}`,
    );
  } catch {
    notes.push("intel-skip");
  }

  try {
    const timeline = await rebuildValueTimelineFromAppearances(player.id);
    notes.push(`value-apps:${timeline.inserted}`);
  } catch {
    notes.push("value-apps-skip");
  }

  try {
    await backfillPlayerValueHistory(player.id, { range: "career" });
    notes.push("value");
  } catch {
    notes.push("value-skip");
  }

  try {
    await recalculatePlayerScoutProfile(player.id);
    notes.push("scout");
  } catch {
    notes.push("scout-skip");
  }

  return notes;
}
