/**
 * Stable identity resolution for Rugby365.
 *
 * Order:
 * 1. Provider match (provider + provider_key → Rugby365 UUID)
 * 2. Approved alias
 * 3. Trusted exact identity match (optional helpers)
 * 4. CMS identity review queue — never silent duplicates
 *
 * Sport CC IDs are the default external reference; Rugby365 UUIDs are permanent PKs.
 */
import "server-only";
import { and, eq } from "drizzle-orm";
import { entityAliases, identityReviewQueue, providerEntityMappings } from "@rugby365/db";
import { getDb } from "./db";
import { normalizedEntityKey } from "./entity-normalize";
import {
  getConfirmedMapping,
  upsertProviderMapping,
} from "./provider-mapping-service";
import {
  DEFAULT_EXTERNAL_PROVIDER,
  PROVIDER_SPORT_CC,
  type MappingEntityType,
} from "./provider-mapping-types";

export type IdentityResolveInput = {
  entityType: MappingEntityType;
  /** Prefer Sport CC when present. */
  provider?: string;
  providerKey?: string | null;
  name?: string | null;
  /** When true, unclear matches are queued; never creates entities. */
  enqueueIfUnresolved?: boolean;
  trustedCandidates?: Array<{
    rugby365Id: string;
    name: string;
    confidence: number;
    reason: string;
  }>;
};

export type IdentityResolveResult =
  | {
      status: "resolved";
      rugby365Id: string;
      via: "provider" | "alias" | "trusted_match";
      provider: string | null;
      providerKey: string | null;
    }
  | {
      status: "queued";
      reviewId: string;
      reason: string;
    }
  | {
      status: "unresolved";
      reason: string;
    };

function normalizeAlias(entityType: MappingEntityType, alias: string): string {
  return normalizedEntityKey(alias.trim(), entityType === "match" ? "team" : entityType);
}

export async function resolveStableIdentity(
  input: IdentityResolveInput,
): Promise<IdentityResolveResult> {
  const provider = (input.provider ?? DEFAULT_EXTERNAL_PROVIDER).trim() || DEFAULT_EXTERNAL_PROVIDER;
  const providerKey = input.providerKey?.trim() || null;
  const name = input.name?.trim() || null;

  // 1. Provider match
  if (providerKey) {
    const confirmed = await getConfirmedMapping({
      provider,
      entityType: input.entityType,
      externalId: providerKey,
    });
    if (confirmed?.rugby365Id) {
      await upsertProviderMapping({
        provider,
        entityType: input.entityType,
        externalId: providerKey,
        rugby365Id: confirmed.rugby365Id,
        externalName: name ?? confirmed.externalName,
        status: "confirmed",
        isDefaultProvider: provider === PROVIDER_SPORT_CC,
      });
      return {
        status: "resolved",
        rugby365Id: confirmed.rugby365Id,
        via: "provider",
        provider,
        providerKey,
      };
    }

    // Also accept any mapped row with a rugby365 id (suggested/confirmed path).
    const db = getDb();
    const [mapped] = await db
      .select()
      .from(providerEntityMappings)
      .where(
        and(
          eq(providerEntityMappings.provider, provider),
          eq(providerEntityMappings.entityType, input.entityType),
          eq(providerEntityMappings.externalId, providerKey),
        ),
      )
      .limit(1);
    if (mapped?.rugby365Id && (mapped.status === "confirmed" || mapped.status === "suggested")) {
      return {
        status: "resolved",
        rugby365Id: mapped.rugby365Id,
        via: "provider",
        provider,
        providerKey,
      };
    }
  }

  // 2. Approved alias
  if (name) {
    const db = getDb();
    const normalized = normalizeAlias(input.entityType, name);
    const [alias] = await db
      .select()
      .from(entityAliases)
      .where(
        and(
          eq(entityAliases.entityType, input.entityType),
          eq(entityAliases.normalizedAlias, normalized),
          eq(entityAliases.isApproved, true),
        ),
      )
      .limit(1);
    if (alias?.rugby365Id) {
      if (providerKey) {
        await upsertProviderMapping({
          provider,
          entityType: input.entityType,
          externalId: providerKey,
          rugby365Id: alias.rugby365Id,
          externalName: name,
          rugby365Name: alias.alias,
          status: "suggested",
          confidence: 85,
          matchReason: { rule: "approved_alias", details: alias.alias },
          isDefaultProvider: provider === PROVIDER_SPORT_CC,
        });
      }
      return {
        status: "resolved",
        rugby365Id: alias.rugby365Id,
        via: "alias",
        provider: providerKey ? provider : null,
        providerKey,
      };
    }
  }

  // 3. Trusted exact identity match (caller supplies candidates — no silent guessing)
  const trusted = (input.trustedCandidates ?? [])
    .filter((c) => c.confidence >= 95)
    .sort((a, b) => b.confidence - a.confidence);
  if (trusted.length === 1) {
    const hit = trusted[0]!;
    if (providerKey) {
      await upsertProviderMapping({
        provider,
        entityType: input.entityType,
        externalId: providerKey,
        rugby365Id: hit.rugby365Id,
        externalName: name,
        rugby365Name: hit.name,
        status: "suggested",
        confidence: hit.confidence,
        matchReason: { rule: "trusted_match", details: hit.reason },
        isDefaultProvider: provider === PROVIDER_SPORT_CC,
      });
    }
    return {
      status: "resolved",
      rugby365Id: hit.rugby365Id,
      via: "trusted_match",
      provider: providerKey ? provider : null,
      providerKey,
    };
  }

  // 4. Review queue — do not create duplicates
  if (input.enqueueIfUnresolved !== false && providerKey) {
    const reviewId = await enqueueIdentityReview({
      entityType: input.entityType,
      provider,
      providerKey,
      incomingName: name,
      suggestedRugby365Id: trusted[0]?.rugby365Id ?? null,
      suggestedName: trusted[0]?.name ?? null,
      confidence: trusted[0]?.confidence ?? 0,
      matchReason: {
        rule: trusted.length > 1 ? "ambiguous_trusted_match" : "unresolved",
        details:
          trusted.length > 1
            ? `${trusted.length} trusted candidates — needs CMS review`
            : "No provider, alias, or unique trusted match",
      },
    });
    return {
      status: "queued",
      reviewId,
      reason: "Identity unresolved — queued for CMS review",
    };
  }

  return {
    status: "unresolved",
    reason: "No provider mapping, approved alias, or unique trusted match",
  };
}

export async function upsertEntityAlias(input: {
  entityType: MappingEntityType;
  rugby365Id: string;
  alias: string;
  aliasKind?: string;
  sourceProvider?: string | null;
  notes?: string | null;
  isApproved?: boolean;
}) {
  const db = getDb();
  const alias = input.alias.trim();
  const normalizedAlias = normalizeAlias(input.entityType, alias);
  const now = new Date();
  const [row] = await db
    .insert(entityAliases)
    .values({
      entityType: input.entityType,
      rugby365Id: input.rugby365Id,
      alias,
      normalizedAlias,
      aliasKind: input.aliasKind ?? "name",
      isApproved: input.isApproved ?? true,
      sourceProvider: input.sourceProvider ?? null,
      notes: input.notes ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [entityAliases.entityType, entityAliases.normalizedAlias],
      set: {
        rugby365Id: input.rugby365Id,
        alias,
        isApproved: input.isApproved ?? true,
        sourceProvider: input.sourceProvider ?? null,
        notes: input.notes ?? null,
        updatedAt: now,
      },
    })
    .returning();
  return row;
}

export async function enqueueIdentityReview(input: {
  entityType: MappingEntityType;
  provider: string;
  providerKey: string;
  incomingName?: string | null;
  suggestedRugby365Id?: string | null;
  suggestedName?: string | null;
  confidence?: number;
  matchReason?: Record<string, unknown>;
  notes?: string | null;
  mappingId?: string | null;
}): Promise<string> {
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(identityReviewQueue)
    .where(
      and(
        eq(identityReviewQueue.provider, input.provider),
        eq(identityReviewQueue.entityType, input.entityType),
        eq(identityReviewQueue.providerKey, input.providerKey),
        eq(identityReviewQueue.status, "open"),
      ),
    )
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(identityReviewQueue)
      .set({
        incomingName: input.incomingName ?? existing.incomingName,
        suggestedRugby365Id: input.suggestedRugby365Id ?? existing.suggestedRugby365Id,
        suggestedName: input.suggestedName ?? existing.suggestedName,
        confidence: input.confidence ?? existing.confidence,
        matchReason: input.matchReason ?? existing.matchReason,
        notes: input.notes ?? existing.notes,
        mappingId: input.mappingId ?? existing.mappingId,
        updatedAt: now,
      })
      .where(eq(identityReviewQueue.id, existing.id))
      .returning();
    return updated.id;
  }

  const [row] = await db
    .insert(identityReviewQueue)
    .values({
      entityType: input.entityType,
      provider: input.provider,
      providerKey: input.providerKey,
      incomingName: input.incomingName ?? null,
      suggestedRugby365Id: input.suggestedRugby365Id ?? null,
      suggestedName: input.suggestedName ?? null,
      confidence: input.confidence ?? 0,
      matchReason: input.matchReason ?? {},
      notes: input.notes ?? null,
      mappingId: input.mappingId ?? null,
      updatedAt: now,
    })
    .returning();
  return row.id;
}

export async function listOpenIdentityReviews(limit = 100) {
  const db = getDb();
  return db
    .select()
    .from(identityReviewQueue)
    .where(eq(identityReviewQueue.status, "open"))
    .limit(limit);
}
