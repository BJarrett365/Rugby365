/**
 * Save FUT-style Player Badge cutouts (transparent PNG) for a player.
 * Keeps primary gallery photo separate from badgeImageUrl.
 */

import { and, eq } from "drizzle-orm";
import { playerImages, players } from "@rugby365/db";
import { getDb } from "./db";
import { uploadPlayerImageBytesToSupabase } from "./supabase-live-service";
import { randomUUID } from "crypto";

function now() {
  return new Date();
}

function parseDataUrl(dataUrl: string): { bytes: Buffer; contentType: string } | null {
  const m = /^data:(image\/(?:png|webp|jpeg|jpg));base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!m) return null;
  const contentType = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  try {
    return { bytes: Buffer.from(m[2].replace(/\s+/g, ""), "base64"), contentType };
  } catch {
    return null;
  }
}

export type SavePlayerBadgeCutoutInput = {
  playerId: string;
  /** data:image/png;base64,... */
  dataUrl: string;
  sourceImageId?: string | null;
  updatedBy?: string | null;
};

/**
 * Upload cutout PNG to Supabase, insert player_images row (role=badge), set players.badgeImageUrl.
 */
export async function savePlayerBadgeCutout(input: SavePlayerBadgeCutoutInput) {
  const parsed = parseDataUrl(input.dataUrl);
  if (!parsed) {
    throw new Error("Invalid image data URL (expected PNG/WebP/JPEG base64)");
  }
  if (parsed.bytes.byteLength > 12 * 1024 * 1024) {
    throw new Error("Cutout image too large (max 12MB)");
  }

  const db = getDb();
  const imageId = randomUUID();
  const ext = parsed.contentType.includes("webp")
    ? "webp"
    : parsed.contentType.includes("jpeg")
      ? "jpg"
      : "png";

  const uploaded = await uploadPlayerImageBytesToSupabase({
    playerId: input.playerId,
    imageId: `badge-${imageId}`,
    bytes: parsed.bytes,
    contentType: parsed.contentType,
    ext,
  });

  if (!uploaded.publicUrl) {
    throw new Error(uploaded.error || "Failed to upload badge cutout to storage");
  }

  const ts = now();

  // Demote previous badge roles
  await db
    .update(playerImages)
    .set({ role: "gallery", updatedAt: ts })
    .where(and(eq(playerImages.playerId, input.playerId), eq(playerImages.role, "badge")));

  await db.insert(playerImages).values({
    id: imageId,
    playerId: input.playerId,
    imageUrl: uploaded.publicUrl,
    canonicalUrl: uploaded.publicUrl,
    sourceProvider: "cms_badge_cutout",
    caption: "Player badge cutout",
    altText: "Player badge cutout",
    credit: "Planet Rugby / Planet Sport",
    licence: "planet_rugby",
    imageType: "badge_cutout",
    role: "badge",
    confidence: "high",
    confidenceScore: 100,
    status: "approved",
    isPublic: true,
    isAiGenerated: true,
    matchContext: {
      kind: "badge_cutout",
      sourceImageId: input.sourceImageId ?? null,
      storagePath: uploaded.path,
      backgroundRemoved: true,
    },
    approvedAt: ts,
    updatedBy: input.updatedBy ?? "admin",
    discoveredAt: ts,
    createdAt: ts,
    updatedAt: ts,
  });

  await db
    .update(players)
    .set({
      badgeImageUrl: uploaded.publicUrl,
      badgeImageId: imageId,
      profileUpdatedAt: ts,
    })
    .where(eq(players.id, input.playerId));

  const [player] = await db
    .select({
      id: players.id,
      imageUrl: players.imageUrl,
      badgeImageUrl: players.badgeImageUrl,
      badgeImageId: players.badgeImageId,
    })
    .from(players)
    .where(eq(players.id, input.playerId))
    .limit(1);

  return {
    ok: true as const,
    imageId,
    badgeImageUrl: uploaded.publicUrl,
    player: player ?? null,
  };
}

export async function clearPlayerBadgeCutout(playerId: string) {
  const db = getDb();
  const ts = now();
  await db
    .update(playerImages)
    .set({ role: "gallery", updatedAt: ts, isPublic: false })
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.role, "badge")));
  await db
    .update(players)
    .set({ badgeImageUrl: null, badgeImageId: null, profileUpdatedAt: ts })
    .where(eq(players.id, playerId));
  return { ok: true as const };
}

/** Fetch a player image for the cutout editor (avoids CDN CORS). */
export async function fetchPlayerImageBytesForEditor(
  playerId: string,
  imageId: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: playerImages.id,
      imageUrl: playerImages.imageUrl,
    })
    .from(playerImages)
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.id, imageId)))
    .limit(1);

  if (!row?.imageUrl) {
    throw new Error("Image not found for this player");
  }

  const res = await fetch(row.imageUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Rugby365Bot/1.0; +https://localhost)",
      Accept: "image/*,*/*",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch source image (${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}
