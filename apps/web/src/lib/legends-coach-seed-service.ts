/**
 * Seed Greatest Coaches collection — resolve-or-create coach profiles (not players).
 */

import { eq } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "./db";
import { resolveCoach } from "./coach-admin-service";
import { addCoachToLegendCollection, ensureLegendCollectionsSeeded } from "./legend-collections-service";
import { PLANET_RUGBY_LEGEND_COACHES_CATALOG } from "./legends-catalog";
import { normalizeSlug } from "./fixture-admin-service";

export type CoachLegendSeedResult = {
  total: number;
  processed: number;
  linked: number;
  created: number;
  failed: number;
  dryRun: boolean;
  items: Array<{
    name: string;
    coachId: string | null;
    coachSlug: string | null;
    action: "linked" | "created" | "failed";
    message?: string;
  }>;
};

export async function seedPlanetRugbyLegendCoaches(options?: {
  dryRun?: boolean;
  enrichWikipedia?: boolean;
}): Promise<CoachLegendSeedResult> {
  const dryRun = Boolean(options?.dryRun);
  const enrichWikipedia = options?.enrichWikipedia !== false;

  if (!dryRun) {
    await ensureLegendCollectionsSeeded();
  }

  const result: CoachLegendSeedResult = {
    total: PLANET_RUGBY_LEGEND_COACHES_CATALOG.length,
    processed: 0,
    linked: 0,
    created: 0,
    failed: 0,
    dryRun,
    items: [],
  };

  for (const entry of PLANET_RUGBY_LEGEND_COACHES_CATALOG) {
    result.processed += 1;
    try {
      const existing = await resolveCoach({
        name: entry.name,
        nationality: entry.nationality,
        createIfMissing: false,
        sourceProvider: "legends_seed",
      });

      if (dryRun) {
        if (existing) result.linked += 1;
        else result.created += 1;
        result.items.push({
          name: entry.name,
          coachId: existing?.id ?? null,
          coachSlug: existing?.slug ?? null,
          action: existing ? "linked" : "created",
          message: existing
            ? `Would link /coaches/${existing.slug}`
            : "Would create coach profile + collection membership",
        });
        continue;
      }

      let coach = existing;
      if (!coach) {
        try {
          coach = await resolveCoach({
            name: entry.name,
            nationality: entry.nationality,
            createIfMissing: true,
            sourceProvider: "legends_seed",
          });
        } catch {
          // Slug collision: resolve by slug
          const db = getDb();
          const slug = normalizeSlug(entry.name);
          const [bySlug] = await db.select().from(coaches).where(eq(coaches.slug, slug)).limit(1);
          coach = bySlug ?? null;
        }
      }
      if (!coach) {
        // Final fallback: name-only create without nationality filter
        coach = await resolveCoach({
          name: entry.name,
          createIfMissing: true,
          sourceProvider: "legends_seed",
        });
      }
      if (!coach) {
        result.failed += 1;
        result.items.push({
          name: entry.name,
          coachId: null,
          coachSlug: null,
          action: "failed",
          message: "Could not resolve or create coach",
        });
        continue;
      }

      const wasCreated = !existing;
      if (wasCreated) result.created += 1;
      else result.linked += 1;

      await addCoachToLegendCollection({
        collectionSlug: "greatest-coaches",
        coachId: coach.id,
        notes: "Planet Rugby Legends — Greatest Coaches",
      });

      if (enrichWikipedia && (wasCreated || !coach.wikipediaUrl)) {
        try {
          const { importCoachFromWikipedia } = await import("./coach-wikipedia-import-service");
          const title = entry.wikipediaTitle ?? entry.name;
          await importCoachFromWikipedia({ articleTitleOrUrl: title });
        } catch {
          // best-effort
        }
      }

      result.items.push({
        name: entry.name,
        coachId: coach.id,
        coachSlug: coach.slug,
        action: wasCreated ? "created" : "linked",
        message: `/coaches/${coach.slug}`,
      });
    } catch (error) {
      result.failed += 1;
      result.items.push({
        name: entry.name,
        coachId: null,
        coachSlug: null,
        action: "failed",
        message: error instanceof Error ? error.message : "Seed failed",
      });
    }
  }

  return result;
}
