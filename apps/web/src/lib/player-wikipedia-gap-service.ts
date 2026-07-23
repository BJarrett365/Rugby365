/**
 * Wikipedia / Wikidata cross-reference audit + fill-missing for player bio/social fields.
 * Never creates players. Never overwrites filled values. Never replaces career tables.
 */

import { and, asc, isNull, or, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "./db";
import { normalizeSocialAccounts } from "./player-profile-utils";
import { enrichPlayerFromWikipedia, type PlayerArchiveEnrichResult } from "./wikipedia-import-service";

export type PlayerWikiGapField =
  | "birthDate"
  | "birthPlace"
  | "heightCm"
  | "weightKg"
  | "twitter"
  | "instagram"
  | "facebook";

export type PlayerWikiGapRow = {
  playerId: string;
  name: string;
  slug: string;
  wikipediaUrl: string | null;
  wikidataId: string | null;
  missingFields: PlayerWikiGapField[];
};

export type PlayerWikiGapAuditSummary = {
  totalPlayers: number;
  playersWithGaps: number;
  byField: Record<PlayerWikiGapField, number>;
  withWikipediaUrl: number;
  withWikidataId: number;
  sample: PlayerWikiGapRow[];
};

function socialMissing(value: string | null | undefined): boolean {
  return !value?.trim();
}

export function listMissingWikiFillFields(player: {
  birthDate?: string | Date | null;
  birthPlace?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  socialAccounts?: unknown;
}): PlayerWikiGapField[] {
  const social = normalizeSocialAccounts(player.socialAccounts);
  const missing: PlayerWikiGapField[] = [];
  if (!player.birthDate) missing.push("birthDate");
  if (!player.birthPlace?.trim()) missing.push("birthPlace");
  if (player.heightCm == null || player.heightCm <= 0) missing.push("heightCm");
  if (player.weightKg == null || player.weightKg <= 0) missing.push("weightKg");
  if (socialMissing(social.twitter)) missing.push("twitter");
  if (socialMissing(social.instagram)) missing.push("instagram");
  if (socialMissing(social.facebook)) missing.push("facebook");
  return missing;
}

export function playerWikiGapWhere() {
  return or(
    isNull(players.birthDate),
    sql`coalesce(trim(${players.birthPlace}), '') = ''`,
    isNull(players.heightCm),
    isNull(players.weightKg),
    sql`coalesce(${players.socialAccounts}->>'twitter', '') = ''`,
    sql`coalesce(${players.socialAccounts}->>'instagram', '') = ''`,
    sql`coalesce(${players.socialAccounts}->>'facebook', '') = ''`,
  );
}

export async function auditPlayerWikipediaGaps(options?: {
  limit?: number;
  sampleSize?: number;
}): Promise<PlayerWikiGapAuditSummary> {
  const db = getDb();
  const [counts] = await db
    .select({
      totalPlayers: sql<number>`count(*)::int`,
      playersWithGaps: sql<number>`count(*) filter (where ${playerWikiGapWhere()})::int`,
      missingBirthDate: sql<number>`count(*) filter (where ${players.birthDate} is null)::int`,
      missingBirthPlace: sql<number>`count(*) filter (where coalesce(trim(${players.birthPlace}), '') = '')::int`,
      missingHeight: sql<number>`count(*) filter (where ${players.heightCm} is null)::int`,
      missingWeight: sql<number>`count(*) filter (where ${players.weightKg} is null)::int`,
      missingTwitter: sql<number>`count(*) filter (where coalesce(${players.socialAccounts}->>'twitter', '') = '')::int`,
      missingInstagram: sql<number>`count(*) filter (where coalesce(${players.socialAccounts}->>'instagram', '') = '')::int`,
      missingFacebook: sql<number>`count(*) filter (where coalesce(${players.socialAccounts}->>'facebook', '') = '')::int`,
      withWikipediaUrl: sql<number>`count(*) filter (where ${players.wikipediaUrl} is not null)::int`,
      withWikidataId: sql<number>`count(*) filter (where ${players.wikidataId} is not null)::int`,
    })
    .from(players);

  const sampleLimit = Math.min(200, Math.max(1, options?.sampleSize ?? 40));
  const gapRows = await db
    .select({
      id: players.id,
      name: players.name,
      slug: players.slug,
      wikipediaUrl: players.wikipediaUrl,
      wikidataId: players.wikidataId,
      birthDate: players.birthDate,
      birthPlace: players.birthPlace,
      heightCm: players.heightCm,
      weightKg: players.weightKg,
      socialAccounts: players.socialAccounts,
    })
    .from(players)
    .where(playerWikiGapWhere())
    .orderBy(asc(players.name))
    .limit(options?.limit ?? sampleLimit);

  return {
    totalPlayers: Number(counts?.totalPlayers ?? 0),
    playersWithGaps: Number(counts?.playersWithGaps ?? 0),
    byField: {
      birthDate: Number(counts?.missingBirthDate ?? 0),
      birthPlace: Number(counts?.missingBirthPlace ?? 0),
      heightCm: Number(counts?.missingHeight ?? 0),
      weightKg: Number(counts?.missingWeight ?? 0),
      twitter: Number(counts?.missingTwitter ?? 0),
      instagram: Number(counts?.missingInstagram ?? 0),
      facebook: Number(counts?.missingFacebook ?? 0),
    },
    withWikipediaUrl: Number(counts?.withWikipediaUrl ?? 0),
    withWikidataId: Number(counts?.withWikidataId ?? 0),
    sample: gapRows.map((row) => ({
      playerId: row.id,
      name: row.name,
      slug: row.slug,
      wikipediaUrl: row.wikipediaUrl,
      wikidataId: row.wikidataId,
      missingFields: listMissingWikiFillFields(row),
    })),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fillPlayerWikipediaMissingFields(options?: {
  limit?: number;
  delayMs?: number;
  /** Prefer players that already have a Wikipedia URL / Wikidata id (safer match). */
  preferLinked?: boolean;
  onProgress?: (progress: {
    index: number;
    total: number;
    playerName: string;
    result: PlayerArchiveEnrichResult;
  }) => void;
}): Promise<{
  totalWithGaps: number;
  processed: number;
  filled: number;
  unchanged: number;
  unmatched: number;
  failed: number;
  fieldsFilled: Record<string, number>;
  results: PlayerArchiveEnrichResult[];
}> {
  const db = getDb();
  const preferLinked = options?.preferLinked !== false;

  const linked = preferLinked
    ? await db
        .select({
          id: players.id,
          name: players.name,
          wikipediaUrl: players.wikipediaUrl,
          wikidataId: players.wikidataId,
        })
        .from(players)
        .where(
          and(
            playerWikiGapWhere(),
            or(sql`${players.wikipediaUrl} is not null`, sql`${players.wikidataId} is not null`),
          ),
        )
        .orderBy(asc(players.name))
    : [];

  const unlinked =
    !options?.limit || linked.length < (options.limit ?? Infinity)
      ? await db
          .select({
            id: players.id,
            name: players.name,
            wikipediaUrl: players.wikipediaUrl,
            wikidataId: players.wikidataId,
          })
          .from(players)
          .where(
            preferLinked
              ? and(
                  playerWikiGapWhere(),
                  isNull(players.wikipediaUrl),
                  isNull(players.wikidataId),
                )
              : playerWikiGapWhere(),
          )
          .orderBy(asc(players.name))
      : [];

  const seen = new Set<string>();
  const queue = [...linked, ...unlinked].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  const totalWithGapsRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(players)
    .where(playerWikiGapWhere());
  const totalWithGaps = Number(totalWithGapsRow[0]?.count ?? queue.length);

  const batch = options?.limit ? queue.slice(0, options.limit) : queue;
  const delayMs = options?.delayMs ?? 500;
  const results: PlayerArchiveEnrichResult[] = [];
  const fieldsFilled: Record<string, number> = {};

  for (let index = 0; index < batch.length; index++) {
    const player = batch[index]!;
    let result: PlayerArchiveEnrichResult;
    try {
      result = await enrichPlayerFromWikipedia(player.id, player.name, { fillMissingOnly: true });
    } catch {
      result = { enriched: false, playerId: player.id, reason: "enrich_failed" };
    }
    results.push(result);
    for (const field of result.fieldsUpdated ?? []) {
      fieldsFilled[field] = (fieldsFilled[field] ?? 0) + 1;
    }
    options?.onProgress?.({
      index: index + 1,
      total: batch.length,
      playerName: player.name,
      result,
    });
    if (index < batch.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    totalWithGaps,
    processed: batch.length,
    filled: results.filter((r) => (r.fieldsUpdated?.length ?? 0) > 0).length,
    unchanged: results.filter((r) => r.reason === "matched_no_new_data" || r.reason === "no_missing_fields_to_fill")
    .length,
    unmatched: results.filter((r) => r.reason === "no_matching_wikipedia_article").length,
    failed: results.filter((r) => r.reason === "enrich_failed").length,
    fieldsFilled,
    results,
  };
}
