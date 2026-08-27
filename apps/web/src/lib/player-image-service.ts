/**
 * Persist Planet Rugby player images, roles, and history.
 * Never auto-replace an approved primary profile image.
 */

import { and, desc, eq, ne } from "drizzle-orm";
import { playerImages, players, playerTransfers, teams } from "@rugby365/db";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import {
  canonicalizePlanetRugbyImageUrl,
  isAllowedPlanetRugbyImageUrl,
  unwrapPlanetRugbyImageUrl,
} from "./planet-rugby-image-utils";
import { canAutoApproveImageConfidence } from "./planet-rugby-image-match";
import { searchPlanetRugbyPlayerImages } from "./planet-rugby-image-search-service";
import { uploadPlayerImageBytesToSupabase } from "./supabase-live-service";
import {
  scoreAlamyCandidatesForPlayer,
  type RawAlamyImage,
} from "./alamy-image-search-service";
import { isAllowedAlamyImageUrl } from "./alamy-image-utils";

export type PlayerImageRole =
  | "primary"
  | "current_club"
  | "current_international"
  | "career"
  | "legend"
  | "gallery"
  | "badge"
  | "none";

export type PlayerImageStatus =
  | "candidate"
  | "approved"
  | "rejected"
  | "incorrect_player"
  | "removed";

export type PlayerImageType =
  | "headshot"
  | "action"
  | "international"
  | "club"
  | "historic"
  | "hero"
  | "gallery"
  | "badge_cutout";

function now() {
  return new Date();
}

export async function listPlayerImages(playerId: string) {
  const db = getDb();
  return db
    .select()
    .from(playerImages)
    .where(eq(playerImages.playerId, playerId))
    .orderBy(desc(playerImages.updatedAt));
}

/** Public gallery rows for a player profile. */
export async function listPublicPlayerGalleryImages(playerId: string) {
  const db = getDb();
  return db
    .select({
      id: playerImages.id,
      imageUrl: playerImages.imageUrl,
      altText: playerImages.altText,
      caption: playerImages.caption,
      credit: playerImages.credit,
      photographer: playerImages.photographer,
      imageType: playerImages.imageType,
      role: playerImages.role,
      focalX: playerImages.focalX,
      focalY: playerImages.focalY,
      licence: playerImages.licence,
      updatedAt: playerImages.updatedAt,
    })
    .from(playerImages)
    .where(
      and(
        eq(playerImages.playerId, playerId),
        eq(playerImages.isPublic, true),
        eq(playerImages.status, "approved"),
      ),
    )
    .orderBy(desc(playerImages.updatedAt));
}

export type PlayerImageMetadataPatch = {
  altText?: string | null;
  caption?: string | null;
  credit?: string | null;
  photographer?: string | null;
  agency?: string | null;
  copyright?: string | null;
  licence?: string | null;
  title?: string | null;
  description?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  imageType?: PlayerImageType | string | null;
  isAiGenerated?: boolean;
  isPublic?: boolean;
  setOgImage?: boolean;
  updatedBy?: string | null;
};

/**
 * Editor metadata update. Does not create players or replace unrelated rows.
 * Optional setOgImage copies this URL onto players.og_image_url.
 */
export async function updatePlayerImageMetadata(
  playerId: string,
  imageId: string,
  patch: PlayerImageMetadataPatch,
) {
  const db = getDb();
  const [image] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.id, imageId), eq(playerImages.playerId, playerId)))
    .limit(1);
  if (!image) throw new Error("Image not found");

  const licence = patch.licence?.trim() || image.licence || "planet_rugby";
  if (patch.isPublic === true && (licence === "unknown" || !licence)) {
    throw new Error("Cannot publish without a valid image licence");
  }

  const [row] = await db
    .update(playerImages)
    .set({
      ...(patch.altText !== undefined ? { altText: patch.altText?.trim() || null } : {}),
      ...(patch.caption !== undefined ? { caption: patch.caption?.trim() || null } : {}),
      ...(patch.credit !== undefined ? { credit: patch.credit?.trim() || null } : {}),
      ...(patch.photographer !== undefined
        ? { photographer: patch.photographer?.trim() || null }
        : {}),
      ...(patch.agency !== undefined ? { agency: patch.agency?.trim() || null } : {}),
      ...(patch.copyright !== undefined ? { copyright: patch.copyright?.trim() || null } : {}),
      ...(patch.licence !== undefined ? { licence } : {}),
      ...(patch.title !== undefined ? { title: patch.title?.trim() || null } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
      ...(patch.focalX !== undefined
        ? { focalX: patch.focalX == null ? null : Math.min(100, Math.max(0, Math.round(patch.focalX))) }
        : {}),
      ...(patch.focalY !== undefined
        ? { focalY: patch.focalY == null ? null : Math.min(100, Math.max(0, Math.round(patch.focalY))) }
        : {}),
      ...(patch.imageType !== undefined && patch.imageType
        ? { imageType: String(patch.imageType) }
        : {}),
      ...(patch.isAiGenerated !== undefined ? { isAiGenerated: Boolean(patch.isAiGenerated) } : {}),
      ...(patch.isPublic !== undefined ? { isPublic: Boolean(patch.isPublic) } : {}),
      updatedBy: patch.updatedBy?.trim() || "admin",
      updatedAt: now(),
    })
    .where(eq(playerImages.id, imageId))
    .returning();

  if (patch.setOgImage) {
    await db
      .update(players)
      .set({ ogImageUrl: image.imageUrl, profileUpdatedAt: now() })
      .where(eq(players.id, playerId));
  }

  return { image: row, player: await getPlayerRow(playerId) };
}

export async function getPlayerImageContext(playerId: string) {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  let internationalTeamName: string | null = null;
  if (player.internationalTeamId) {
    const [team] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, player.internationalTeamId))
      .limit(1);
    internationalTeamName = team?.name ?? null;
  }

  const transfers = await db
    .select({
      fromClub: playerTransfers.fromClub,
      toClub: playerTransfers.toClub,
    })
    .from(playerTransfers)
    .where(eq(playerTransfers.playerId, playerId));

  const previousClubs = [
    ...new Set(
      transfers
        .flatMap((t) => [t.fromClub, t.toClub])
        .filter((name): name is string => Boolean(name && name !== player.clubName)),
    ),
  ];

  const aliases = [player.fullName].filter((n): n is string => Boolean(n && n !== player.name));

  return {
    player,
    aliases,
    clubName: player.clubName,
    internationalTeamName: internationalTeamName ?? player.countryName,
    previousClubs,
    hasApprovedPrimary: Boolean(player.primaryImageApprovedAt && player.primaryImageId),
  };
}

export async function findPlanetRugbyImagesForPlayer(playerId: string) {
  const ctx = await getPlayerImageContext(playerId);
  const { loadApprovedImageLearningRules } = await import("./player-image-learning-service");
  const learningRules = await loadApprovedImageLearningRules();
  const discovered = await searchPlanetRugbyPlayerImages({
    playerName: ctx.player.name,
    aliases: ctx.aliases,
    clubName: ctx.clubName,
    internationalTeamName: ctx.internationalTeamName,
    previousClubs: ctx.previousClubs,
    playerId,
    learningRules,
  });

  const db = getDb();
  const saved: Array<typeof playerImages.$inferSelect> = [];

  for (const candidate of discovered.candidates) {
    if (!isAllowedPlanetRugbyImageUrl(candidate.imageUrl)) continue;
    const imageUrl = unwrapPlanetRugbyImageUrl(candidate.imageUrl);
    const canonicalUrl = candidate.canonicalUrl || canonicalizePlanetRugbyImageUrl(imageUrl);

    const [existing] = await db
      .select()
      .from(playerImages)
      .where(
        and(eq(playerImages.playerId, playerId), eq(playerImages.canonicalUrl, canonicalUrl)),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "rejected" || existing.status === "incorrect_player") {
        continue;
      }
      saved.push(existing);
      continue;
    }

    const [row] = await db
      .insert(playerImages)
      .values({
        playerId,
        imageUrl,
        canonicalUrl,
        sourceProvider: "planet_rugby",
        sourcePageUrl: candidate.sourcePageUrl,
        sourceArticleTitle: candidate.sourceArticleTitle,
        caption: candidate.caption,
        altText: candidate.altText,
        credit: candidate.credit,
        imageType: guessImageType(candidate.altText, candidate.caption, candidate.sourceArticleTitle),
        role: "gallery",
        confidence: candidate.match.level,
        confidenceScore: candidate.match.score,
        status: "candidate",
        isPublic: false,
        matchContext: {
          reasons: candidate.match.reasons,
          nameInAltOrCaption: candidate.match.nameInAltOrCaption,
          teamContextMatch: candidate.match.teamContextMatch,
        },
        discoveredAt: now(),
        updatedAt: now(),
      })
      .returning();
    if (row) saved.push(row);
  }

  return {
    playerId,
    hasApprovedPrimary: ctx.hasApprovedPrimary,
    warnings: discovered.warnings,
    searchedPages: discovered.searchedPages,
    candidates: discovered.candidates,
    images: await listPlayerImages(playerId),
    savedCount: saved.length,
  };
}

/**
 * Register Alamy lightbox/search images for a player.
 * User confirmed licensed store use — high/medium name matches are approved + public.
 * Does not replace an already-approved primary headshot.
 */
export async function registerAlamyImagesForPlayer(
  playerId: string,
  rawImages: RawAlamyImage[],
  options?: { setPrimaryIfMissing?: boolean; maxPerPlayer?: number },
) {
  const ctx = await getPlayerImageContext(playerId);
  const scored = scoreAlamyCandidatesForPlayer(rawImages, {
    playerName: ctx.player.name,
    aliases: ctx.aliases,
    clubName: ctx.clubName,
    internationalTeamName: ctx.internationalTeamName,
    previousClubs: ctx.previousClubs,
  });

  const max = options?.maxPerPlayer ?? 6;
  const picked = scored.slice(0, max);
  const db = getDb();
  const saved: Array<typeof playerImages.$inferSelect> = [];
  let setPrimary = Boolean(options?.setPrimaryIfMissing) && !ctx.hasApprovedPrimary;

  for (const candidate of picked) {
    if (!isAllowedAlamyImageUrl(candidate.imageUrl)) continue;

    const [existing] = await db
      .select()
      .from(playerImages)
      .where(
        and(
          eq(playerImages.playerId, playerId),
          eq(playerImages.canonicalUrl, candidate.canonicalUrl),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === "rejected" || existing.status === "incorrect_player") {
        continue;
      }
      saved.push(existing);
      continue;
    }

    const autoApprove =
      candidate.match.level === "high" ||
      (candidate.match.level === "medium" && candidate.match.score >= 55);

    const [row] = await db
      .insert(playerImages)
      .values({
        playerId,
        imageUrl: candidate.imageUrl,
        canonicalUrl: candidate.canonicalUrl,
        sourceProvider: "alamy",
        sourcePageUrl: candidate.sourcePageUrl,
        caption: candidate.caption,
        altText: candidate.altText,
        credit: candidate.credit,
        agency: "Alamy",
        licence: "alamy",
        imageType: guessImageType(candidate.altText, candidate.caption, null),
        role: setPrimary ? "primary" : "gallery",
        confidence: candidate.match.level,
        confidenceScore: candidate.match.score,
        status: autoApprove ? "approved" : "candidate",
        isPublic: autoApprove,
        isAiGenerated: false,
        approvedAt: autoApprove ? now() : null,
        matchContext: {
          reasons: candidate.match.reasons,
          nameInAltOrCaption: candidate.match.nameInAltOrCaption,
          teamContextMatch: candidate.match.teamContextMatch,
          alamyId: candidate.alamyId,
        },
        discoveredAt: now(),
        updatedAt: now(),
      })
      .returning();

    if (!row) continue;
    saved.push(row);

    if (setPrimary && autoApprove) {
      await db
        .update(players)
        .set({
          imageUrl: row.imageUrl,
          primaryImageId: row.id,
          primaryImageApprovedAt: now(),
          updatedAt: now(),
        })
        .where(eq(players.id, playerId));
      setPrimary = false;
    }
  }

  return {
    playerId,
    matched: scored.length,
    savedCount: saved.length,
    images: saved,
  };
}

function canonicalizeSpringboksImageUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    u.protocol = "https:";
    return u.toString();
  } catch {
    return url;
  }
}

function isAllowedSpringboksImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    return (
      u.hostname === "media-cdn.cortextech.io" ||
      u.hostname === "springboks.rugby" ||
      u.hostname.endsWith(".springboks.rugby")
    );
  } catch {
    return false;
  }
}

/**
 * Register an official springboks.rugby / Cortex CDN headshot.
 * Sets as primary when the player has no approved primary yet.
 * Pass forcePrimary to replace Alamy/other primaries with the official shot.
 */
export async function registerSpringboksOfficialImage(
  playerId: string,
  imageUrl: string,
  options?: {
    sourcePageUrl?: string | null;
    playerName?: string | null;
    setPrimaryIfMissing?: boolean;
    forcePrimary?: boolean;
  },
) {
  if (!isAllowedSpringboksImageUrl(imageUrl)) {
    return { playerId, saved: false, reason: "url_not_allowed" as const };
  }

  const ctx = await getPlayerImageContext(playerId);
  const canonicalUrl = canonicalizeSpringboksImageUrl(imageUrl);
  const db = getDb();
  const forcePrimary = Boolean(options?.forcePrimary);
  const setPrimary =
    forcePrimary ||
    (Boolean(options?.setPrimaryIfMissing !== false) && !ctx.hasApprovedPrimary);

  const [existing] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.playerId, playerId), eq(playerImages.canonicalUrl, canonicalUrl)))
    .limit(1);

  async function promotePrimary(imageId: string, url: string) {
    if (!setPrimary) return;
    // Demote any other primary roles for this player.
    await db
      .update(playerImages)
      .set({ role: "gallery", updatedAt: now() })
      .where(
        and(
          eq(playerImages.playerId, playerId),
          eq(playerImages.role, "primary"),
          ne(playerImages.id, imageId),
        ),
      );
    await db
      .update(playerImages)
      .set({
        role: "primary",
        status: "approved",
        isPublic: true,
        approvedAt: now(),
        updatedAt: now(),
      })
      .where(eq(playerImages.id, imageId));
    await db
      .update(players)
      .set({
        imageUrl: url,
        primaryImageId: imageId,
        primaryImageApprovedAt: now(),
        updatedAt: now(),
      })
      .where(eq(players.id, playerId));
  }

  if (existing) {
    if (existing.status === "rejected" || existing.status === "incorrect_player") {
      return { playerId, saved: false, reason: "rejected" as const, imageId: existing.id };
    }
    await promotePrimary(existing.id, existing.imageUrl);
    return {
      playerId,
      saved: false,
      reason: forcePrimary || setPrimary ? ("promoted" as const) : ("already_present" as const),
      imageId: existing.id,
    };
  }

  const alt = options?.playerName
    ? `${options.playerName} — Springboks official portrait`
    : "Springboks official portrait";

  const [row] = await db
    .insert(playerImages)
    .values({
      playerId,
      imageUrl: canonicalizeSpringboksImageUrl(imageUrl),
      canonicalUrl,
      sourceProvider: "springboks_rugby",
      sourcePageUrl: options?.sourcePageUrl ?? null,
      caption: alt,
      altText: alt,
      credit: "SA Rugby / springboks.rugby",
      agency: "SA Rugby",
      licence: "editorial",
      imageType: "headshot",
      role: setPrimary ? "primary" : "gallery",
      confidence: "high",
      confidenceScore: 95,
      status: "approved",
      isPublic: true,
      isAiGenerated: false,
      approvedAt: now(),
      matchContext: {
        reasons: ["official_springboks_squad_image"],
        nameInAltOrCaption: true,
        teamContextMatch: true,
      },
      discoveredAt: now(),
      updatedAt: now(),
    })
    .returning();

  if (!row) return { playerId, saved: false, reason: "insert_failed" as const };

  await promotePrimary(row.id, row.imageUrl);

  return {
    playerId,
    saved: true,
    reason: forcePrimary || setPrimary ? ("inserted_primary" as const) : ("inserted" as const),
    imageId: row.id,
  };
}

function guessImageType(
  alt: string | null,
  caption: string | null,
  title: string | null,
): PlayerImageType {
  const blob = `${alt ?? ""} ${caption ?? ""} ${title ?? ""}`.toLowerCase();
  if (/headshot|portrait|mugshot/.test(blob)) return "headshot";
  if (/wallab|springbok|all black|england|ireland|wales|scotland|france|italy|international|test/.test(blob)) {
    return "international";
  }
  if (/historic|archive|legend|retire/.test(blob)) return "historic";
  if (/hero|banner/.test(blob)) return "hero";
  return "action";
}

export async function applyPlayerImageAction(
  playerId: string,
  imageId: string,
  action:
    | "set_primary"
    | "add_gallery"
    | "set_role"
    | "reject"
    | "incorrect_player"
    | "remove_public"
    | "approve",
  options?: { role?: PlayerImageRole; imageType?: PlayerImageType },
) {
  const db = getDb();
  const [image] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.id, imageId), eq(playerImages.playerId, playerId)))
    .limit(1);
  if (!image) throw new Error("Image not found");

  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  if (action === "reject" || action === "incorrect_player") {
    const [row] = await db
      .update(playerImages)
      .set({
        status: action === "reject" ? "rejected" : "incorrect_player",
        role: "none",
        isPublic: false,
        rejectedAt: now(),
        rejectedReason: action === "incorrect_player" ? "Marked incorrect player" : "Rejected by editor",
        updatedAt: now(),
      })
      .where(eq(playerImages.id, imageId))
      .returning();

    let learning: { created: number; drafts: string[] } | undefined;
    try {
      const { proposeLearningFromImageRejection } = await import("./player-image-learning-service");
      learning = await proposeLearningFromImageRejection(imageId);
    } catch {
      // Learning proposals are optional — rejection still succeeds
    }
    return { image: row, player, learning };
  }

  if (action === "remove_public") {
    const [row] = await db
      .update(playerImages)
      .set({ isPublic: false, updatedAt: now() })
      .where(eq(playerImages.id, imageId))
      .returning();
    if (player.primaryImageId === imageId) {
      await db
        .update(players)
        .set({
          primaryImageId: null,
          primaryImageApprovedAt: null,
          // Keep imageUrl history on players until a new primary is set
        })
        .where(eq(players.id, playerId));
    }
    return { image: row, player: await getPlayerRow(playerId) };
  }

  if (action === "add_gallery") {
    const [row] = await db
      .update(playerImages)
      .set({
        status: "approved",
        role: "gallery",
        isPublic: true,
        approvedAt: image.approvedAt ?? now(),
        updatedAt: now(),
      })
      .where(eq(playerImages.id, imageId))
      .returning();
    return { image: row, player };
  }

  if (action === "set_role") {
    const role = options?.role ?? "gallery";
    const [row] = await db
      .update(playerImages)
      .set({
        role,
        imageType: options?.imageType ?? image.imageType,
        status: "approved",
        isPublic: true,
        approvedAt: image.approvedAt ?? now(),
        updatedAt: now(),
      })
      .where(eq(playerImages.id, imageId))
      .returning();
    return { image: row, player };
  }

  if (action === "approve" || action === "set_primary") {
    if (!canAutoApproveImageConfidence(image.confidence as "high" | "medium" | "low") && action === "approve") {
      // Editors may still approve low via set_primary / explicit approve in CMS
    }

    if (action === "set_primary") {
      // Clear previous primary role (history retained)
      await db
        .update(playerImages)
        .set({ role: "gallery", updatedAt: now() })
        .where(
          and(
            eq(playerImages.playerId, playerId),
            eq(playerImages.role, "primary"),
            ne(playerImages.id, imageId),
          ),
        );

      const [row] = await db
        .update(playerImages)
        .set({
          status: "approved",
          role: "primary",
          isPublic: true,
          approvedAt: now(),
          updatedAt: now(),
        })
        .where(eq(playerImages.id, imageId))
        .returning();

      const [updatedPlayer] = await db
        .update(players)
        .set({
          imageUrl: image.imageUrl,
          primaryImageId: imageId,
          primaryImageApprovedAt: now(),
          profileUpdatedAt: now(),
        })
        .where(eq(players.id, playerId))
        .returning();

      const mirrored = await maybeMirrorPlayerImageToSupabase({
        playerId,
        imageId,
        sourceUrl: image.imageUrl,
        matchContext: (row?.matchContext ?? {}) as Record<string, unknown>,
      });
      return { image: mirrored ?? row, player: updatedPlayer };
    }

    const [row] = await db
      .update(playerImages)
      .set({
        status: "approved",
        isPublic: true,
        approvedAt: now(),
        updatedAt: now(),
      })
      .where(eq(playerImages.id, imageId))
      .returning();

    const mirrored = await maybeMirrorPlayerImageToSupabase({
      playerId,
      imageId,
      sourceUrl: image.imageUrl,
      matchContext: (row?.matchContext ?? {}) as Record<string, unknown>,
    });
    return { image: mirrored ?? row, player };
  }

  throw new Error(`Unknown action: ${action}`);
}

async function getPlayerRow(playerId: string) {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  return player;
}

/** Best-effort Supabase Storage mirror; never fails the CMS image action. */
async function maybeMirrorPlayerImageToSupabase(input: {
  playerId: string;
  imageId: string;
  sourceUrl: string;
  matchContext: Record<string, unknown>;
}) {
  try {
    const { mirrorRemoteImageToSupabase } = await import("./supabase-live-service");
    const mirrored = await mirrorRemoteImageToSupabase({
      sourceUrl: input.sourceUrl,
      playerId: input.playerId,
      imageId: input.imageId,
    });
    if (!mirrored.publicUrl) return null;

    const db = getDb();
    const [row] = await db
      .update(playerImages)
      .set({
        matchContext: {
          ...input.matchContext,
          supabase: {
            publicUrl: mirrored.publicUrl,
            path: mirrored.path,
            mirroredAt: new Date().toISOString(),
            sourceUrl: input.sourceUrl,
          },
        },
        updatedAt: now(),
      })
      .where(eq(playerImages.id, input.imageId))
      .returning();
    return row ?? null;
  } catch (error) {
    console.warn(
      `[supabase] player image mirror skipped for ${input.imageId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Automated discovery hook.
 * Never replaces an approved primary image — only adds candidates.
 */
export async function refreshPlayerPlanetRugbyImages(playerId: string, reason: string) {
  const ctx = await getPlayerImageContext(playerId);
  const result = await findPlanetRugbyImagesForPlayer(playerId);
  return {
    ...result,
    reason,
    autoReplacedPrimary: false,
    skippedPrimaryReplaceBecauseApproved: ctx.hasApprovedPrimary,
  };
}

export type RegisterAiCartoonAvatarInput = {
  playerId: string;
  imageUrl: string;
  sourcePhotoUrl?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  caption?: string | null;
  setPrimary?: boolean;
  updatedBy?: string | null;
};

/**
 * Upload bytes to Supabase and set as the player's approved primary profile image.
 */
export async function uploadPlayerPrimaryImage(input: {
  playerId: string;
  bytes: Buffer;
  contentType: string;
  fileName?: string | null;
  credit?: string | null;
}) {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
  if (!player) throw new Error("Player not found");
  if (input.bytes.byteLength > 12 * 1024 * 1024) {
    throw new Error("Image too large (max 12MB)");
  }

  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const contentType =
    input.contentType.toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : input.contentType.toLowerCase();
  if (!allowed.has(contentType)) {
    throw new Error("File must be an image (JPEG, PNG, WebP, or GIF)");
  }

  const imageId = randomUUID();
  const ext = contentType.includes("webp")
    ? "webp"
    : contentType.includes("jpeg")
      ? "jpg"
      : contentType.includes("gif")
        ? "gif"
        : "png";

  const uploaded = await uploadPlayerImageBytesToSupabase({
    playerId: input.playerId,
    imageId,
    bytes: input.bytes,
    contentType,
    ext,
  });
  if (!uploaded.publicUrl) {
    throw new Error(uploaded.error || "Failed to upload player image");
  }

  const ts = now();
  await db
    .update(playerImages)
    .set({ role: "gallery", updatedAt: ts })
    .where(and(eq(playerImages.playerId, input.playerId), eq(playerImages.role, "primary")));

  const [row] = await db
    .insert(playerImages)
    .values({
      id: imageId,
      playerId: input.playerId,
      imageUrl: uploaded.publicUrl,
      canonicalUrl: uploaded.publicUrl,
      sourceProvider: "cms_upload",
      caption: input.fileName ?? null,
      altText: player.name,
      credit: input.credit ?? null,
      imageType: "action",
      role: "primary",
      confidence: "high",
      confidenceScore: 100,
      status: "approved",
      isPublic: true,
      approvedAt: ts,
      discoveredAt: ts,
      updatedAt: ts,
      updatedBy: "admin",
    })
    .returning();

  await db
    .update(players)
    .set({
      imageUrl: uploaded.publicUrl,
      primaryImageId: imageId,
      primaryImageApprovedAt: ts,
      profileUpdatedAt: ts,
    })
    .where(eq(players.id, input.playerId));

  return row;
}

/**
 * Register an AI-generated cartoon avatar in player_images (does not create players).
 * Use after generating a stylised portrait from an approved source photo.
 */
export async function registerAiCartoonPlayerImage(input: RegisterAiCartoonAvatarInput) {
  const db = getDb();
  const imageUrl = input.imageUrl.trim();
  if (!imageUrl) throw new Error("imageUrl is required");

  const [existing] = await db
    .select()
    .from(playerImages)
    .where(and(eq(playerImages.playerId, input.playerId), eq(playerImages.imageUrl, imageUrl)))
    .limit(1);

  let imageRow = existing ?? null;
  if (!imageRow) {
    const [inserted] = await db
      .insert(playerImages)
      .values({
        playerId: input.playerId,
        imageUrl,
        canonicalUrl: imageUrl,
        sourceProvider: "ai_cartoon",
        sourcePageUrl: input.sourcePhotoUrl ?? null,
        caption: input.caption ?? "AI cartoon avatar (style transfer from source photo)",
        altText: input.caption ?? "Cartoon player portrait",
        credit: "Rugby365 AI",
        licence: "staff",
        imageType: "portrait",
        role: "gallery",
        confidence: "high",
        confidenceScore: 100,
        status: "candidate",
        isPublic: false,
        isAiGenerated: true,
        widthPx: input.widthPx ?? null,
        heightPx: input.heightPx ?? null,
        matchContext: {
          sourcePhotoUrl: input.sourcePhotoUrl ?? null,
          generator: "cursor-generate-image",
          style: "cel-shaded-sports-avatar",
        },
        updatedBy: input.updatedBy ?? "system",
        discoveredAt: now(),
        updatedAt: now(),
      })
      .returning();
    imageRow = inserted ?? null;
  }

  if (!imageRow) throw new Error("Failed to register cartoon avatar");

  if (input.setPrimary) {
    return applyPlayerImageAction(input.playerId, imageRow.id, "set_primary");
  }

  return { image: imageRow, player: await getPlayerRow(input.playerId) };
}
