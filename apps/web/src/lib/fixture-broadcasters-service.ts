import { and, asc, eq } from "drizzle-orm";
import { fixtureBroadcasters, fixtures } from "@rugby365/db";
import { getDb } from "./db";
import {
  isBroadcasterPlatform,
  type BroadcasterPlatform,
  type BroadcasterSourceProvider,
} from "./rugby-broadcaster-presets";

export type FixtureBroadcasterRow = {
  id: string;
  fixtureId: string;
  broadcasterName: string;
  channelName: string | null;
  region: string | null;
  platform: BroadcasterPlatform;
  startAt: string | null;
  endAt: string | null;
  url: string | null;
  sourceProvider: BroadcasterSourceProvider | string;
  externalId: string | null;
  sortOrder: number;
};

export type FixtureBroadcasterInput = {
  id?: string;
  broadcasterName: string;
  channelName?: string | null;
  region?: string | null;
  platform?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  url?: string | null;
  sourceProvider?: string | null;
  externalId?: string | null;
  sortOrder?: number;
};

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function mapRow(row: typeof fixtureBroadcasters.$inferSelect): FixtureBroadcasterRow {
  const platform = isBroadcasterPlatform(row.platform) ? row.platform : "tv";
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    broadcasterName: row.broadcasterName,
    channelName: row.channelName,
    region: row.region,
    platform,
    startAt: toIso(row.startAt),
    endAt: toIso(row.endAt),
    url: row.url,
    sourceProvider: row.sourceProvider,
    externalId: row.externalId,
    sortOrder: row.sortOrder,
  };
}

export async function listFixtureBroadcasters(
  fixtureId: string,
): Promise<FixtureBroadcasterRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(fixtureBroadcasters)
    .where(eq(fixtureBroadcasters.fixtureId, fixtureId))
    .orderBy(asc(fixtureBroadcasters.sortOrder), asc(fixtureBroadcasters.createdAt));
  return rows.map(mapRow);
}

export async function replaceFixtureBroadcasters(
  fixtureId: string,
  items: FixtureBroadcasterInput[],
): Promise<FixtureBroadcasterRow[]> {
  const db = getDb();
  const [fixture] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);
  if (!fixture) throw new Error("Fixture not found");

  const cleaned = items
    .map((item, index) => {
      const name = item.broadcasterName?.trim();
      if (!name) return null;
      const platformRaw = (item.platform ?? "tv").trim().toLowerCase();
      const platform = isBroadcasterPlatform(platformRaw) ? platformRaw : "tv";
      return {
        broadcasterName: name,
        channelName: item.channelName?.trim() || null,
        region: item.region?.trim() || null,
        platform,
        startAt: parseOptionalDate(item.startAt),
        endAt: parseOptionalDate(item.endAt),
        url: item.url?.trim() || null,
        sourceProvider: (item.sourceProvider?.trim() || "manual").slice(0, 64),
        externalId: item.externalId?.trim() || null,
        sortOrder: Number.isFinite(item.sortOrder) ? Number(item.sortOrder) : index,
      };
    })
    .filter(Boolean) as Array<{
    broadcasterName: string;
    channelName: string | null;
    region: string | null;
    platform: BroadcasterPlatform;
    startAt: Date | null;
    endAt: Date | null;
    url: string | null;
    sourceProvider: string;
    externalId: string | null;
    sortOrder: number;
  }>;

  await db.delete(fixtureBroadcasters).where(eq(fixtureBroadcasters.fixtureId, fixtureId));

  if (cleaned.length) {
    await db.insert(fixtureBroadcasters).values(
      cleaned.map((row) => ({
        fixtureId,
        ...row,
        updatedAt: new Date(),
      })),
    );
  }

  return listFixtureBroadcasters(fixtureId);
}

export async function deleteFixtureBroadcaster(
  fixtureId: string,
  broadcasterId: string,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .delete(fixtureBroadcasters)
    .where(
      and(
        eq(fixtureBroadcasters.id, broadcasterId),
        eq(fixtureBroadcasters.fixtureId, fixtureId),
      ),
    )
    .returning({ id: fixtureBroadcasters.id });
  return Boolean(row);
}

/** Compact public label e.g. "TNT Sports 1 (UK)". */
export function formatBroadcasterLabel(row: {
  broadcasterName: string;
  channelName?: string | null;
  region?: string | null;
}): string {
  const channel =
    row.channelName &&
    row.channelName.trim().toLowerCase() !== row.broadcasterName.trim().toLowerCase()
      ? row.channelName.trim()
      : null;
  const base = channel ? `${row.broadcasterName} · ${channel}` : row.broadcasterName;
  return row.region?.trim() ? `${base} (${row.region.trim()})` : base;
}
