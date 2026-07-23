/**
 * Persist and apply image-match learning proposals from rejected images.
 */
import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { playerImageLearningRules, playerImages, players } from "@rugby365/db";
import { getDb } from "./db";
import {
  extractLearningDraftsFromRejection,
  type ApprovedImageLearningRule,
  type ImageLearningRuleKind,
} from "./player-image-rejection-learning";

export async function listImageLearningRules(status?: "pending" | "approved" | "rejected") {
  const db = getDb();
  if (status) {
    return db
      .select()
      .from(playerImageLearningRules)
      .where(eq(playerImageLearningRules.status, status))
      .orderBy(desc(playerImageLearningRules.createdAt));
  }
  return db
    .select()
    .from(playerImageLearningRules)
    .orderBy(desc(playerImageLearningRules.createdAt))
    .limit(200);
}

export async function loadApprovedImageLearningRules(): Promise<ApprovedImageLearningRule[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerImageLearningRules)
    .where(eq(playerImageLearningRules.status, "approved"));
  return rows.map((r) => ({
    kind: r.kind as ImageLearningRuleKind,
    pattern: r.pattern,
    penalty: r.penalty,
    scope: (r.scope === "player" ? "player" : "global") as "global" | "player",
    playerId: r.playerId,
  }));
}

export async function proposeLearningFromImageRejection(imageId: string) {
  const db = getDb();
  const [image] = await db
    .select()
    .from(playerImages)
    .where(eq(playerImages.id, imageId))
    .limit(1);
  if (!image) return { created: 0, drafts: [] as string[] };
  if (image.status !== "rejected" && image.status !== "incorrect_player") {
    return { created: 0, drafts: [] as string[] };
  }
  const [player] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.id, image.playerId))
    .limit(1);
  if (!player) return { created: 0, drafts: [] as string[] };

  const drafts = extractLearningDraftsFromRejection({
    playerId: player.id,
    playerName: player.name,
    imageId: image.id,
    imageUrl: image.imageUrl,
    canonicalUrl: image.canonicalUrl,
    altText: image.altText,
    caption: image.caption,
    sourceArticleTitle: image.sourceArticleTitle,
    rejectedReason: image.rejectedReason,
    status: image.status as "rejected" | "incorrect_player",
  });

  let created = 0;
  const keys: string[] = [];
  for (const draft of drafts) {
    const [existing] = await db
      .select({ id: playerImageLearningRules.id, status: playerImageLearningRules.status })
      .from(playerImageLearningRules)
      .where(eq(playerImageLearningRules.ruleKey, draft.ruleKey))
      .limit(1);
    if (existing) {
      keys.push(draft.ruleKey);
      continue;
    }
    await db.insert(playerImageLearningRules).values({
      ruleKey: draft.ruleKey,
      kind: draft.kind,
      pattern: draft.pattern,
      penalty: draft.penalty,
      scope: draft.scope,
      playerId: draft.scope === "player" ? player.id : null,
      sourceImageId: image.id,
      rationale: draft.rationale,
      status: "pending",
      sourceSnapshot: {
        playerName: player.name,
        imageUrl: image.imageUrl,
        altText: image.altText,
        caption: image.caption,
        articleTitle: image.sourceArticleTitle,
        rejectedReason: image.rejectedReason,
        imageStatus: image.status,
      },
      updatedAt: new Date(),
    });
    created += 1;
    keys.push(draft.ruleKey);
  }
  return { created, drafts: keys };
}

/** Scan all rejected / incorrect images and enqueue missing proposals. */
export async function learnFromAllRejectedImages() {
  const db = getDb();
  const rejected = await db
    .select({ id: playerImages.id })
    .from(playerImages)
    .where(inArray(playerImages.status, ["rejected", "incorrect_player"]));

  let created = 0;
  let scanned = 0;
  for (const row of rejected) {
    scanned += 1;
    const result = await proposeLearningFromImageRejection(row.id);
    created += result.created;
  }
  const pending = await db
    .select()
    .from(playerImageLearningRules)
    .where(eq(playerImageLearningRules.status, "pending"))
    .orderBy(desc(playerImageLearningRules.createdAt));

  return { scanned, created, pendingCount: pending.length, pending };
}

export async function reviewImageLearningRule(input: {
  id: string;
  action: "approve" | "reject";
  reviewedBy?: string;
}) {
  const db = getDb();
  const [row] = await db
    .update(playerImageLearningRules)
    .set({
      status: input.action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date(),
      reviewedBy: input.reviewedBy ?? "cms",
      updatedAt: new Date(),
    })
    .where(and(eq(playerImageLearningRules.id, input.id)))
    .returning();
  return row ?? null;
}
