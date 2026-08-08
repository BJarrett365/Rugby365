/**
 * Coach CMS image helpers — upload, set primary, gallery via coach_images.
 */

import { and, desc, eq } from "drizzle-orm";
import { coachImages, coaches } from "@rugby365/db";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import { uploadCoachImageBytesToSupabase } from "./supabase-live-service";
import { getCoachById, updateCoach } from "./coach-admin-service";

function now() {
  return new Date();
}

function extFromContentType(contentType: string): string {
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export async function listCoachImages(coachId: string) {
  const db = getDb();
  return db
    .select()
    .from(coachImages)
    .where(eq(coachImages.coachId, coachId))
    .orderBy(desc(coachImages.updatedAt));
}

async function demotePrimary(coachId: string) {
  const db = getDb();
  await db
    .update(coachImages)
    .set({ role: "gallery", updatedAt: now() })
    .where(and(eq(coachImages.coachId, coachId), eq(coachImages.role, "primary")));
}

export async function setCoachPrimaryImage(input: {
  coachId: string;
  imageUrl: string;
  sourceProvider?: string;
  sourcePageUrl?: string | null;
  caption?: string | null;
  altText?: string | null;
  credit?: string | null;
  imageType?: string;
}) {
  const coach = await getCoachById(input.coachId);
  if (!coach) throw new Error("Coach not found");

  const db = getDb();
  const ts = now();
  await demotePrimary(input.coachId);

  const [row] = await db
    .insert(coachImages)
    .values({
      coachId: input.coachId,
      imageUrl: input.imageUrl,
      canonicalUrl: input.imageUrl,
      sourceProvider: input.sourceProvider ?? "manual",
      sourcePageUrl: input.sourcePageUrl ?? null,
      caption: input.caption ?? null,
      altText: input.altText ?? coach.name,
      credit: input.credit ?? null,
      imageType: input.imageType ?? "portrait",
      role: "primary",
      status: "approved",
      isPublic: true,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();

  await updateCoach(input.coachId, { imageUrl: input.imageUrl });
  return row;
}

export async function uploadCoachPrimaryImage(input: {
  coachId: string;
  bytes: Buffer;
  contentType: string;
  fileName?: string | null;
  credit?: string | null;
}) {
  const coach = await getCoachById(input.coachId);
  if (!coach) throw new Error("Coach not found");
  if (input.bytes.byteLength > 12 * 1024 * 1024) {
    throw new Error("Image too large (max 12MB)");
  }

  const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  const contentType = input.contentType.toLowerCase() === "image/jpg"
    ? "image/jpeg"
    : input.contentType.toLowerCase();
  if (!allowed.has(contentType)) {
    throw new Error("File must be an image (JPEG, PNG, WebP, or GIF)");
  }

  const imageId = randomUUID();
  const ext = extFromContentType(contentType);
  const uploaded = await uploadCoachImageBytesToSupabase({
    coachId: input.coachId,
    imageId,
    bytes: input.bytes,
    contentType,
    ext,
  });
  if (!uploaded.publicUrl) {
    throw new Error(uploaded.error || "Failed to upload coach image");
  }

  return setCoachPrimaryImage({
    coachId: input.coachId,
    imageUrl: uploaded.publicUrl,
    sourceProvider: "cms_upload",
    caption: input.fileName ?? null,
    altText: coach.name,
    credit: input.credit ?? null,
    imageType: "portrait",
  });
}

export async function setCoachPrimaryFromUrl(input: {
  coachId: string;
  imageUrl: string;
  sourceProvider?: string;
  sourcePageUrl?: string | null;
}) {
  const url = input.imageUrl.trim();
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    throw new Error("Image URL must be http(s) or a site-relative path");
  }
  return setCoachPrimaryImage({
    coachId: input.coachId,
    imageUrl: url,
    sourceProvider: input.sourceProvider ?? "manual_url",
    sourcePageUrl: input.sourcePageUrl ?? null,
  });
}

export async function getCoachImageSummary(coachId: string) {
  const [coach] = await getDb()
    .select({ id: coaches.id, name: coaches.name, imageUrl: coaches.imageUrl })
    .from(coaches)
    .where(eq(coaches.id, coachId))
    .limit(1);
  if (!coach) return null;
  const images = await listCoachImages(coachId);
  return { coach, images };
}
