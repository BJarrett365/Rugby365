/**
 * Seed Planet Rugby Legends: resolve-or-create player profiles, then attach legend membership.
 * Never creates a duplicate profile when name / wiki / RugbyPass identity already exists.
 */

import { and, eq } from "drizzle-orm";
import { playerLegends, players } from "@rugby365/db";
import { getDb } from "./db";
import { resolvePlayer } from "./entity-resolve-service";
import { createLegend, getPlayerLegends } from "./legend-admin-service";
import {
  addPlayerToLegendCollection,
  ensureLegendCollectionsSeeded,
} from "./legend-collections-service";
import { recalculatePlayerLegendScore } from "./legend-score-service";
import {
  mergeLegendCatalogByName,
  PLANET_RUGBY_LEGENDS_CATALOG,
  type LegendCollectionSlug,
  type LegendEraSlug,
} from "./legends-catalog";
import { enrichPlayerFromWikipediaAndWait } from "./player-wikipedia-enrich";

export type LegendSeedOptions = {
  /** Max players to process in this run */
  limit?: number;
  dryRun?: boolean;
  /** Await Wikipedia enrich (slower; respects delayMs) */
  enrichWikipedia?: boolean;
  delayMs?: number;
  /** Only process names matching this substring */
  search?: string;
};

export type LegendSeedItemResult = {
  name: string;
  playerId: string | null;
  playerSlug: string | null;
  action: "linked" | "created" | "membership_added" | "skipped" | "failed";
  eras: LegendEraSlug[];
  collections: LegendCollectionSlug[];
  legendId?: string | null;
  message?: string;
};

export type LegendSeedResult = {
  total: number;
  processed: number;
  linked: number;
  created: number;
  membershipAdded: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  items: LegendSeedItemResult[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function primaryEra(eras: LegendEraSlug[]): LegendEraSlug {
  // Prefer the latest era when a player spans multiple decades
  const order = [
    "1880s-1890s",
    "1900s",
    "1910s",
    "1920s",
    "1930s",
    "1940s",
    "1950s",
    "1960s",
    "1970s",
    "1980s",
    "1990s",
    "2000s",
    "2010s",
    "2020s",
  ] as const;
  let best: LegendEraSlug = eras[0]!;
  let bestIdx = -1;
  for (const era of eras) {
    const idx = order.indexOf(era);
    if (idx >= bestIdx) {
      bestIdx = idx;
      best = era;
    }
  }
  return best;
}

function eraLabel(eras: LegendEraSlug[]): string {
  if (eras.length === 1) return eras[0]!;
  return eras.join(" · ");
}

/**
 * Ensure each catalog legend has a player profile + active player_legends membership.
 */
export async function seedPlanetRugbyLegends(
  options: LegendSeedOptions = {},
): Promise<LegendSeedResult> {
  const dryRun = Boolean(options.dryRun);
  const enrichWikipedia = options.enrichWikipedia !== false;
  const delayMs = options.delayMs ?? 600;
  const search = options.search?.trim().toLowerCase();

  if (!dryRun) {
    await ensureLegendCollectionsSeeded();
  }

  let catalog = mergeLegendCatalogByName();
  if (search) {
    catalog = catalog.filter((row) => row.name.toLowerCase().includes(search));
  }
  const batch = options.limit ? catalog.slice(0, options.limit) : catalog;

  const result: LegendSeedResult = {
    total: catalog.length,
    processed: 0,
    linked: 0,
    created: 0,
    membershipAdded: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    items: [],
  };

  const db = getDb();

  for (const entry of batch) {
    result.processed += 1;
    try {
      const existingBefore = await resolvePlayer({
        name: entry.name,
        countryName: entry.countryName,
        createIfMissing: false,
        skipArchiveEnrich: true,
        sourceProvider: "legends_seed",
      });

      if (dryRun) {
        const action = existingBefore ? "linked" : "created";
        if (existingBefore) result.linked += 1;
        else result.created += 1;
        result.items.push({
          name: entry.name,
          playerId: existingBefore?.id ?? null,
          playerSlug: existingBefore?.slug ?? null,
          action,
          eras: entry.eras,
          collections: entry.collections,
          message: existingBefore
            ? `Would link existing profile /players/${existingBefore.slug}`
            : "Would create profile + legend membership",
        });
        continue;
      }

      const player = await resolvePlayer({
        name: entry.name,
        countryName: entry.countryName,
        createIfMissing: true,
        skipArchiveEnrich: !enrichWikipedia,
        sourceProvider: "legends_seed",
      });

      if (!player) {
        result.failed += 1;
        result.items.push({
          name: entry.name,
          playerId: null,
          playerSlug: null,
          action: "failed",
          eras: entry.eras,
          collections: entry.collections,
          message: "Could not resolve or create player",
        });
        continue;
      }

      const wasCreated = !existingBefore;
      if (wasCreated) result.created += 1;
      else result.linked += 1;

      // Ensure publishable for public Legends hub
      if (!player.isPublic || player.publishStatus !== "published") {
        await db
          .update(players)
          .set({
            isPublic: true,
            publishStatus: "published",
            countryName: player.countryName ?? entry.countryName ?? null,
            careerStatus: "legend",
          })
          .where(eq(players.id, player.id));
      } else if (player.careerStatus !== "legend") {
        await db
          .update(players)
          .set({ careerStatus: "legend" })
          .where(eq(players.id, player.id));
      }

      const era = primaryEra(entry.eras);
      const eraText = eraLabel(entry.eras);
      const existingLegends = await getPlayerLegends(player.id);
      const existingIcon = existingLegends.find(
        (l) =>
          l.legendLevel === "rugby_icon" ||
          l.legendLevel === "hall_of_fame" ||
          l.legendLevel === "international_legend",
      );

      let legendId: string | null = existingIcon?.id ?? null;
      let membershipAdded = false;

      if (existingIcon) {
        // Refresh era / collections metadata without duplicating membership
        await db
          .update(playerLegends)
          .set({
            era: eraText,
            countryName: entry.countryName ?? existingIcon.countryName,
            reason:
              existingIcon.reason ??
              `Planet Rugby Legends — ${eraText}${entry.note ? ` (${entry.note})` : ""}`,
            notableStats: {
              ...existingIcon.notableStats,
              collections: entry.collections,
              catalogEras: entry.eras,
            },
            legendStatus: "active",
            updatedAt: new Date(),
          })
          .where(eq(playerLegends.id, existingIcon.id));
      } else {
        // Avoid unique collisions: check any row for this player at rugby_icon with null team
        const [anyIcon] = await db
          .select({ id: playerLegends.id })
          .from(playerLegends)
          .where(
            and(
              eq(playerLegends.playerId, player.id),
              eq(playerLegends.legendLevel, "rugby_icon"),
            ),
          )
          .limit(1);

        if (anyIcon) {
          legendId = anyIcon.id;
          await db
            .update(playerLegends)
            .set({
              legendStatus: "active",
              era: eraText,
              countryName: entry.countryName ?? null,
              notableStats: {
                collections: entry.collections,
                catalogEras: entry.eras,
              },
              updatedAt: new Date(),
            })
            .where(eq(playerLegends.id, anyIcon.id));
        } else {
          const created = await createLegend({
            playerId: player.id,
            legendLevel: "rugby_icon",
            legendStatus: "active",
            countryName: entry.countryName ?? null,
            era: eraText,
            reason: `Planet Rugby Legends — ${eraText}${entry.note ? ` (${entry.note})` : ""}`,
            careerSummary: entry.note ?? null,
            notableStats: {
              collections: entry.collections,
              catalogEras: entry.eras,
              primaryEra: era,
            },
            sourceUrl: entry.wikipediaTitle
              ? `https://en.wikipedia.org/wiki/${encodeURIComponent(entry.wikipediaTitle.replace(/ /g, "_"))}`
              : null,
          });
          legendId = created?.id ?? null;
          membershipAdded = true;
          result.membershipAdded += 1;
        }
      }

      if (enrichWikipedia) {
        await enrichPlayerFromWikipediaAndWait(player.id, player.name, {
          fillMissingOnly: true,
        });
        if (delayMs > 0) await sleep(delayMs);
      }

      // Formal collection memberships (Phase 2)
      for (const [i, collectionSlug] of entry.collections.entries()) {
        if (collectionSlug === "greatest-coaches") continue;
        await addPlayerToLegendCollection({
          collectionSlug,
          playerId: player.id,
          sortOrder: i,
        });
      }

      // Planet Rugby Legend Score (Phase 3)
      try {
        await recalculatePlayerLegendScore(player.id);
      } catch {
        // Score is best-effort during seed
      }

      result.items.push({
        name: entry.name,
        playerId: player.id,
        playerSlug: player.slug,
        action: wasCreated ? "created" : membershipAdded ? "membership_added" : "linked",
        eras: entry.eras,
        collections: entry.collections,
        legendId,
        message: `/players/${player.slug}`,
      });
    } catch (error) {
      result.failed += 1;
      result.items.push({
        name: entry.name,
        playerId: null,
        playerSlug: null,
        action: "failed",
        eras: entry.eras,
        collections: entry.collections,
        message: error instanceof Error ? error.message : "Seed failed",
      });
    }
  }

  return result;
}

export function getLegendsCatalogSummary() {
  const merged = mergeLegendCatalogByName();
  return {
    uniquePlayers: merged.length,
    rawEntries: PLANET_RUGBY_LEGENDS_CATALOG.length,
    withCollections: merged.filter((m) => m.collections.length > 0).length,
  };
}
