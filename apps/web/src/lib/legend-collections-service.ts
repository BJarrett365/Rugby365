/**
 * Formal legend_collections + members (players and coaches).
 */

import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import {
  coaches,
  legendCollectionMembers,
  legendCollections,
  players,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  LEGEND_COLLECTIONS,
  type LegendCollectionSlug,
} from "./legends-catalog";

function now() {
  return new Date();
}

/** Ensure catalog collections exist as DB rows. */
export async function ensureLegendCollectionsSeeded() {
  const db = getDb();
  const ts = now();
  for (const [i, col] of LEGEND_COLLECTIONS.entries()) {
    const [existing] = await db
      .select({ id: legendCollections.id })
      .from(legendCollections)
      .where(eq(legendCollections.slug, col.slug))
      .limit(1);
    if (existing) {
      await db
        .update(legendCollections)
        .set({
          label: col.label,
          description: col.description,
          entityKind: col.entityKind,
          sortOrder: i + 1,
          isPublic: true,
          updatedAt: ts,
        })
        .where(eq(legendCollections.id, existing.id));
      continue;
    }
    await db.insert(legendCollections).values({
      slug: col.slug,
      label: col.label,
      description: col.description,
      entityKind: col.entityKind,
      sortOrder: i + 1,
      isPublic: true,
      createdAt: ts,
      updatedAt: ts,
    });
  }
  return listLegendCollections();
}

export async function listLegendCollections(options?: { entityKind?: string; publicOnly?: boolean }) {
  const db = getDb();
  const conditions = [];
  if (options?.entityKind) conditions.push(eq(legendCollections.entityKind, options.entityKind));
  if (options?.publicOnly !== false) conditions.push(eq(legendCollections.isPublic, true));
  return db
    .select()
    .from(legendCollections)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(legendCollections.sortOrder));
}

export async function getLegendCollectionBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(legendCollections)
    .where(eq(legendCollections.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function addPlayerToLegendCollection(input: {
  collectionSlug: LegendCollectionSlug | string;
  playerId: string;
  sortOrder?: number;
  notes?: string | null;
}) {
  await ensureLegendCollectionsSeeded();
  const collection = await getLegendCollectionBySlug(input.collectionSlug);
  if (!collection) throw new Error(`Unknown collection: ${input.collectionSlug}`);
  if (collection.entityKind !== "player") {
    throw new Error(`Collection ${input.collectionSlug} is not a player collection`);
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: legendCollectionMembers.id })
    .from(legendCollectionMembers)
    .where(
      and(
        eq(legendCollectionMembers.collectionId, collection.id),
        eq(legendCollectionMembers.playerId, input.playerId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(legendCollectionMembers)
      .set({
        sortOrder: input.sortOrder ?? 0,
        notes: input.notes ?? null,
        updatedAt: now(),
      })
      .where(eq(legendCollectionMembers.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(legendCollectionMembers)
    .values({
      collectionId: collection.id,
      playerId: input.playerId,
      coachId: null,
      sortOrder: input.sortOrder ?? 0,
      notes: input.notes ?? null,
    })
    .returning({ id: legendCollectionMembers.id });
  return row!.id;
}

export async function addCoachToLegendCollection(input: {
  collectionSlug: LegendCollectionSlug | string;
  coachId: string;
  sortOrder?: number;
  notes?: string | null;
}) {
  await ensureLegendCollectionsSeeded();
  const collection = await getLegendCollectionBySlug(input.collectionSlug);
  if (!collection) throw new Error(`Unknown collection: ${input.collectionSlug}`);
  if (collection.entityKind !== "coach") {
    throw new Error(`Collection ${input.collectionSlug} is not a coach collection`);
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: legendCollectionMembers.id })
    .from(legendCollectionMembers)
    .where(
      and(
        eq(legendCollectionMembers.collectionId, collection.id),
        eq(legendCollectionMembers.coachId, input.coachId),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(legendCollectionMembers)
      .set({
        sortOrder: input.sortOrder ?? 0,
        notes: input.notes ?? null,
        updatedAt: now(),
      })
      .where(eq(legendCollectionMembers.id, existing.id));
    return existing.id;
  }

  const [row] = await db
    .insert(legendCollectionMembers)
    .values({
      collectionId: collection.id,
      playerId: null,
      coachId: input.coachId,
      sortOrder: input.sortOrder ?? 0,
      notes: input.notes ?? null,
    })
    .returning({ id: legendCollectionMembers.id });
  return row!.id;
}

export async function listPlayerCollectionSlugs(playerId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ slug: legendCollections.slug })
    .from(legendCollectionMembers)
    .innerJoin(
      legendCollections,
      eq(legendCollectionMembers.collectionId, legendCollections.id),
    )
    .where(eq(legendCollectionMembers.playerId, playerId));
  return rows.map((r) => r.slug);
}

export async function listPublicCollectionMembers(slug: string) {
  const catalog = LEGEND_COLLECTIONS.find((c) => c.slug === slug);
  const collection = await getLegendCollectionBySlug(slug);

  // Catalog collections should render even before Admin seeds DB rows.
  if (!collection || !collection.isPublic) {
    if (!catalog) return null;
    return {
      collection: {
        id: "",
        slug: catalog.slug,
        label: catalog.label,
        description: catalog.description,
        entityKind: catalog.entityKind,
        sortOrder: 0,
        isPublic: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      members: [],
    };
  }

  const db = getDb();

  if (collection.entityKind === "coach") {
    const rows = await db
      .select({
        memberId: legendCollectionMembers.id,
        sortOrder: legendCollectionMembers.sortOrder,
        notes: legendCollectionMembers.notes,
        coachId: coaches.id,
        name: coaches.name,
        slug: coaches.slug,
        imageUrl: coaches.imageUrl,
        nationality: coaches.nationality,
      })
      .from(legendCollectionMembers)
      .innerJoin(coaches, eq(legendCollectionMembers.coachId, coaches.id))
      .where(
        and(
          eq(legendCollectionMembers.collectionId, collection.id),
          isNotNull(legendCollectionMembers.coachId),
        ),
      )
      .orderBy(asc(legendCollectionMembers.sortOrder), asc(coaches.name));

    return {
      collection,
      members: rows.map((r) => ({
        kind: "coach" as const,
        memberId: r.memberId,
        sortOrder: r.sortOrder,
        notes: r.notes,
        id: r.coachId!,
        name: r.name,
        slug: r.slug,
        imageUrl: r.imageUrl,
        nationality: r.nationality,
        href: `/coaches/${r.slug}`,
      })),
    };
  }

  const rows = await db
    .select({
      memberId: legendCollectionMembers.id,
      sortOrder: legendCollectionMembers.sortOrder,
      notes: legendCollectionMembers.notes,
      playerId: players.id,
      name: players.name,
      slug: players.slug,
      imageUrl: players.imageUrl,
      badgeImageUrl: players.badgeImageUrl,
      countryName: players.countryName,
      positionName: players.positionName,
    })
    .from(legendCollectionMembers)
    .innerJoin(players, eq(legendCollectionMembers.playerId, players.id))
    .where(
      and(
        eq(legendCollectionMembers.collectionId, collection.id),
        isNotNull(legendCollectionMembers.playerId),
        eq(players.isPublic, true),
        eq(players.publishStatus, "published"),
      ),
    )
    .orderBy(asc(legendCollectionMembers.sortOrder), asc(players.name));

  return {
    collection,
    members: rows.map((r) => ({
      kind: "player" as const,
      memberId: r.memberId,
      sortOrder: r.sortOrder,
      notes: r.notes,
      id: r.playerId!,
      name: r.name,
      slug: r.slug,
      imageUrl: r.badgeImageUrl ?? r.imageUrl,
      nationality: r.countryName,
      positionName: r.positionName,
      href: `/players/${r.slug}`,
    })),
  };
}

export async function countPublicCollectionMembers() {
  const db = getDb();
  const rows = await db
    .select({
      slug: legendCollections.slug,
      entityKind: legendCollections.entityKind,
      count: sql<number>`count(${legendCollectionMembers.id})::int`,
    })
    .from(legendCollections)
    .leftJoin(
      legendCollectionMembers,
      eq(legendCollectionMembers.collectionId, legendCollections.id),
    )
    .where(eq(legendCollections.isPublic, true))
    .groupBy(legendCollections.slug, legendCollections.entityKind, legendCollections.sortOrder)
    .orderBy(asc(legendCollections.sortOrder));
  return rows;
}
