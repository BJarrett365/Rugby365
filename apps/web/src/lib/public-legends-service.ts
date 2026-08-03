/**
 * Public Planet Rugby Legends hub — active legend memberships → player profiles.
 */

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  legendCollectionMembers,
  legendCollections,
  playerLegendScores,
  playerLegends,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  LEGEND_COLLECTIONS,
  LEGEND_ERAS,
  legendCollectionMeta,
  legendEraLabel,
  type LegendCollectionSlug,
  type LegendEraSlug,
} from "./legends-catalog";
import { legendLevelLabel, normalizeLegendLevel } from "./legend-types";
import { countPublicCollectionMembers } from "./legend-collections-service";

export type PublicLegendCard = {
  legendId: string;
  playerId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  badgeImageUrl: string | null;
  positionName: string | null;
  countryName: string | null;
  era: string | null;
  eraSlug: string | null;
  legendLevel: string;
  legendLevelLabel: string;
  reason: string | null;
  collections: string[];
  legendScore: number | null;
  allTimeRank: number | null;
  hallOfFameStatus: string | null;
};

function parseCollections(notableStats: unknown): string[] {
  if (!notableStats || typeof notableStats !== "object" || Array.isArray(notableStats)) return [];
  const raw = (notableStats as { collections?: unknown }).collections;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function primaryEraSlug(era: string | null, notableStats: unknown): string | null {
  if (notableStats && typeof notableStats === "object" && !Array.isArray(notableStats)) {
    const primary = (notableStats as { primaryEra?: unknown }).primaryEra;
    if (typeof primary === "string" && LEGEND_ERAS.some((e) => e.slug === primary)) {
      return primary;
    }
    const catalogEras = (notableStats as { catalogEras?: unknown }).catalogEras;
    if (Array.isArray(catalogEras)) {
      const last = [...catalogEras].reverse().find(
        (x): x is string => typeof x === "string" && LEGEND_ERAS.some((e) => e.slug === x),
      );
      if (last) return last;
    }
  }
  if (!era) return null;
  const hit = LEGEND_ERAS.find((e) => era.includes(e.label) || era.includes(e.slug));
  return hit?.slug ?? null;
}

export async function listPublicLegends(filters?: {
  era?: string | null;
  collection?: string | null;
  search?: string | null;
  limit?: number;
}): Promise<PublicLegendCard[]> {
  const db = getDb();
  const conditions = [
    eq(playerLegends.legendStatus, "active"),
    eq(players.isPublic, true),
    eq(players.publishStatus, "published"),
  ];

  if (filters?.era?.trim()) {
    const era = filters.era.trim();
    conditions.push(
      or(
        ilike(playerLegends.era, `%${era}%`),
        sql`coalesce(${playerLegends.notableStats}->>'primaryEra','') = ${era}`,
      )!,
    );
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim();
    conditions.push(
      or(ilike(players.name, `%${q}%`), ilike(playerLegends.countryName, `%${q}%`))!,
    );
  }

  const rows = await db
    .select({
      legendId: playerLegends.id,
      playerId: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      badgeImageUrl: players.badgeImageUrl,
      positionName: players.positionName,
      countryName: playerLegends.countryName,
      playerCountry: players.countryName,
      era: playerLegends.era,
      legendLevel: playerLegends.legendLevel,
      reason: playerLegends.reason,
      notableStats: playerLegends.notableStats,
      updatedAt: playerLegends.updatedAt,
      overallScore: playerLegendScores.overallScore,
      allTimeRank: playerLegendScores.allTimeRank,
      hallOfFameStatus: playerLegendScores.hallOfFameStatus,
    })
    .from(playerLegends)
    .innerJoin(players, eq(playerLegends.playerId, players.id))
    .leftJoin(playerLegendScores, eq(playerLegendScores.playerId, players.id))
    .where(and(...conditions))
    .orderBy(
      sql`${playerLegendScores.overallScore} desc nulls last`,
      desc(playerLegends.updatedAt),
    );

  const collectionFilter = filters?.collection?.trim() as LegendCollectionSlug | undefined;

  // Batch formal collection memberships
  const playerIds = [...new Set(rows.map((r) => r.playerId))];
  const collectionsByPlayer = new Map<string, string[]>();
  if (playerIds.length > 0) {
    try {
      const memberRows = await db
        .select({
          playerId: legendCollectionMembers.playerId,
          slug: legendCollections.slug,
        })
        .from(legendCollectionMembers)
        .innerJoin(
          legendCollections,
          eq(legendCollectionMembers.collectionId, legendCollections.id),
        )
        .where(inArray(legendCollectionMembers.playerId, playerIds));
      for (const m of memberRows) {
        if (!m.playerId) continue;
        const list = collectionsByPlayer.get(m.playerId) ?? [];
        list.push(m.slug);
        collectionsByPlayer.set(m.playerId, list);
      }
    } catch {
      // tables may not exist yet mid-migrate
    }
  }

  let cards: PublicLegendCard[] = [];
  for (const row of rows) {
    const level = normalizeLegendLevel(row.legendLevel);
    const fromStats = parseCollections(row.notableStats);
    const formal = collectionsByPlayer.get(row.playerId) ?? [];
    const collections = [...new Set([...formal, ...fromStats])];
    const eraSlug = primaryEraSlug(row.era, row.notableStats);
    cards.push({
      legendId: row.legendId,
      playerId: row.playerId,
      name: row.name,
      slug: row.slug,
      imageUrl: row.imageUrl,
      badgeImageUrl: row.badgeImageUrl,
      positionName: row.positionName,
      countryName: row.countryName ?? row.playerCountry,
      era: row.era,
      eraSlug,
      legendLevel: level,
      legendLevelLabel: legendLevelLabel(level),
      reason: row.reason,
      collections,
      legendScore: row.overallScore ?? null,
      allTimeRank: row.allTimeRank ?? null,
      hallOfFameStatus: row.hallOfFameStatus ?? null,
    });
  }

  // Deduplicate by player — keep highest score / most recently updated
  const seen = new Set<string>();
  cards = cards.filter((c) => {
    if (seen.has(c.playerId)) return false;
    seen.add(c.playerId);
    return true;
  });

  if (collectionFilter) {
    cards = cards.filter((c) => c.collections.includes(collectionFilter));
  }

  if (filters?.era?.trim()) {
    const era = filters.era.trim();
    cards = cards.filter(
      (c) =>
        c.eraSlug === era ||
        c.era?.includes(era) ||
        (c.era?.toLowerCase().includes(era.toLowerCase()) ?? false),
    );
  }

  if (filters?.limit && filters.limit > 0) {
    cards = cards.slice(0, filters.limit);
  }

  return cards;
}

export async function getPublicLegendsHub() {
  const legends = await listPublicLegends();
  const byEra = LEGEND_ERAS.map((era) => ({
    ...era,
    count: legends.filter((l) => l.eraSlug === era.slug || l.era?.includes(era.label)).length,
  }));

  let memberCounts: Array<{ slug: string; entityKind: string; count: number }> = [];
  try {
    memberCounts = await countPublicCollectionMembers();
  } catch {
    memberCounts = [];
  }

  const byCollection = LEGEND_COLLECTIONS.map((col) => {
    const formal = memberCounts.find((c) => c.slug === col.slug);
    const fallback =
      col.entityKind === "player"
        ? legends.filter((l) => l.collections.includes(col.slug)).length
        : 0;
    return {
      ...col,
      count: formal?.count ?? fallback,
    };
  });

  return {
    total: legends.length,
    legends,
    eras: byEra,
    collections: byCollection,
  };
}

export function resolveLegendEraParam(raw: string): { slug: LegendEraSlug; label: string } | null {
  const decoded = decodeURIComponent(raw).trim();
  const hit =
    LEGEND_ERAS.find((e) => e.slug === decoded) ??
    LEGEND_ERAS.find((e) => e.label === decoded) ??
    LEGEND_ERAS.find((e) => e.slug === decoded.replace(/–/g, "-"));
  return hit ? { slug: hit.slug, label: hit.label } : null;
}

export function resolveLegendCollectionParam(raw: string) {
  const decoded = decodeURIComponent(raw).trim();
  return legendCollectionMeta(decoded);
}

export { legendEraLabel };
