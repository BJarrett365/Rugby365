import { desc, eq } from "drizzle-orm";
import {
  playerBioHistory,
  playerBioProfiles,
  playerBioSuggestions,
  playerProfileVerificationReports,
  players,
} from "@rugby365/db";
import { chatCompletion, getOpenAiModel, parseJsonObject } from "./openai-client";
import {
  buildPlayerBioPacket,
  persistPlayerRating,
} from "./player-bio-packet-service";
import {
  buildBioPrompt,
  inferPrimaryBioType,
  parseBioSections,
} from "./player-bio-prompt-service";
import type {
  BioRefreshTrigger,
  PlayerBioSections,
  PlayerBioType,
  PlayerProfileBioType,
} from "./player-bio-types";
import { getDb } from "./db";
import { updatePlayer } from "./entity-admin-service";
import {
  buildBioVerificationReport,
  mergeBioVerificationReport,
} from "./player-profile-verification-service";
import { shouldTriggerBioRefresh } from "./player-rating-service";
import {
  bioTypesForRefresh,
  composeFlatBioProfile,
  isProfileBioType,
  parseBioSectionsRecord,
  primaryBioSummary,
  readBioVariants,
} from "./player-bio-variant-utils";

function variantColumn(bioType: PlayerProfileBioType) {
  switch (bioType) {
    case "domestic":
      return "domesticSections" as const;
    case "international":
      return "internationalSections" as const;
    case "scouting":
      return "scoutingSections" as const;
  }
}

function variantUpdatedAtColumn(bioType: PlayerProfileBioType) {
  switch (bioType) {
    case "domestic":
      return "domesticUpdatedAt" as const;
    case "international":
      return "internationalUpdatedAt" as const;
    case "scouting":
      return "scoutingUpdatedAt" as const;
  }
}

async function persistBioVariants(input: {
  playerId: string;
  bioType: PlayerProfileBioType;
  sections: PlayerBioSections;
  approvedBy: string;
  suggestionId?: string;
  isInternational: boolean;
}) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(playerBioProfiles)
    .where(eq(playerBioProfiles.playerId, input.playerId))
    .limit(1);

  const variants = readBioVariants(existing);
  variants[input.bioType] = input.sections;
  const flat = composeFlatBioProfile(variants);
  const now = new Date();

  const variantPatch = {
    [variantColumn(input.bioType)]: input.sections,
    [variantUpdatedAtColumn(input.bioType)]: now,
  };

  await db
    .insert(playerBioProfiles)
    .values({
      playerId: input.playerId,
      primaryBioType: input.bioType,
      ...variantPatch,
      shortIntro: flat.shortIntro,
      fullBio: flat.fullBio,
      playingStyle: flat.playingStyle,
      strengths: flat.strengths,
      areasToImprove: flat.areasToImprove,
      careerSummary: flat.careerSummary,
      internationalSummary: flat.internationalSummary,
      currentSeasonSummary: flat.currentSeasonSummary,
      scoutingSummary: flat.scoutingSummary,
      ratingExplanation: flat.ratingExplanation,
      legendSummary: flat.legendSummary,
      domesticSections: variants.domestic,
      internationalSections: variants.international,
      scoutingSections: variants.scouting,
      approvedSuggestionId: input.suggestionId ?? existing?.approvedSuggestionId ?? null,
      approvedBy: input.approvedBy,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: playerBioProfiles.playerId,
      set: {
        primaryBioType: input.bioType,
        ...variantPatch,
        shortIntro: flat.shortIntro,
        fullBio: flat.fullBio,
        playingStyle: flat.playingStyle,
        strengths: flat.strengths,
        areasToImprove: flat.areasToImprove,
        careerSummary: flat.careerSummary,
        internationalSummary: flat.internationalSummary,
        currentSeasonSummary: flat.currentSeasonSummary,
        scoutingSummary: flat.scoutingSummary,
        ratingExplanation: flat.ratingExplanation,
        legendSummary: flat.legendSummary,
        domesticSections: variants.domestic,
        internationalSections: variants.international,
        scoutingSections: variants.scouting,
        approvedSuggestionId: input.suggestionId ?? existing?.approvedSuggestionId ?? null,
        approvedBy: input.approvedBy,
        updatedAt: now,
      },
    });

  await updatePlayer(input.playerId, {
    bioSummary: primaryBioSummary(variants, input.isInternational),
  });

  return { variants, flat };
}

export async function getPlayerBioAutomationState(playerId: string) {
  const db = getDb();
  const [profile, latestSuggestions, latestReport, history, player] = await Promise.all([
    db.select().from(playerBioProfiles).where(eq(playerBioProfiles.playerId, playerId)).limit(1),
    db
      .select()
      .from(playerBioSuggestions)
      .where(eq(playerBioSuggestions.playerId, playerId))
      .orderBy(desc(playerBioSuggestions.createdAt))
      .limit(20),
    db
      .select()
      .from(playerProfileVerificationReports)
      .where(eq(playerProfileVerificationReports.playerId, playerId))
      .orderBy(desc(playerProfileVerificationReports.createdAt))
      .limit(1),
    db
      .select()
      .from(playerBioHistory)
      .where(eq(playerBioHistory.playerId, playerId))
      .orderBy(desc(playerBioHistory.createdAt))
      .limit(10),
    db
      .select({ internationalTeamId: players.internationalTeamId })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1),
  ]);

  const variants = readBioVariants(profile[0] ?? null);

  return {
    profile: profile[0] ?? null,
    variants,
    latestSuggestion: latestSuggestions[0] ?? null,
    latestVerificationReport: latestReport[0] ?? null,
    history,
    isInternational: Boolean(player[0]?.internationalTeamId),
  };
}

export async function listPlayerBioSuggestions(playerId: string, bioType?: PlayerBioType) {
  const db = getDb();
  const rows = await db
    .select()
    .from(playerBioSuggestions)
    .where(eq(playerBioSuggestions.playerId, playerId))
    .orderBy(desc(playerBioSuggestions.createdAt));
  if (!bioType) return rows;
  return rows.filter((row) => row.bioType === bioType);
}

export async function suggestPlayerBio(input: {
  playerId: string;
  bioType?: PlayerBioType;
  triggerReason: string;
  chat?: typeof chatCompletion;
}) {
  const packet = await buildPlayerBioPacket(input.playerId);
  await persistPlayerRating(input.playerId, packet);

  const bioType = input.bioType ?? inferPrimaryBioType(packet);
  const prompt = buildBioPrompt(bioType, packet);
  const ruleVerification = buildBioVerificationReport(packet);

  const chat = input.chat ?? chatCompletion;
  const raw = await chat({
    system: prompt.system,
    user: prompt.user,
    json: true,
    maxTokens: 2200,
  });

  const parsedSections = parseBioSections(parseJsonObject<Record<string, unknown>>(raw, {}));
  const suggestedSections: PlayerBioSections = {
    ...parsedSections,
    ratingExplanation: parsedSections.ratingExplanation || packet.rating.ratingExplanation || "",
  };

  const verificationReport = mergeBioVerificationReport(ruleVerification, {
    summary: `AI-assisted ${bioType} bio suggestion generated.`,
  });

  const db = getDb();
  const [suggestion] = await db
    .insert(playerBioSuggestions)
    .values({
      playerId: input.playerId,
      bioType,
      triggerReason: input.triggerReason,
      status: "pending",
      suggestedSections,
      sourceDataSnapshot: packet,
      verificationReport,
      promptVersion: prompt.promptVersion,
      model: await getOpenAiModel(),
      confidenceScore: verificationReport.confidenceScore,
    })
    .returning();

  await db.insert(playerProfileVerificationReports).values({
    playerId: input.playerId,
    suggestionId: suggestion.id,
    sourceFieldsUsed: verificationReport.sourceFieldsUsed,
    sourceUrls: verificationReport.sourceUrls,
    missingFields: verificationReport.missingFields,
    conflictingFields: verificationReport.conflictingFields,
    confidenceScore: verificationReport.confidenceScore,
    suggestedEditorAction: verificationReport.suggestedEditorAction,
  });

  return suggestion;
}

function refreshChangeFlags(
  previousPacket: {
    rating: { formScore: number | null; displayRating: number | null; badges: Array<{ key: string }>; ageProfile: string | null };
    currentClub: string | null;
    position: string | null;
    isInternational: boolean;
  } | null,
  nextPacket: {
    rating: { formScore: number | null; displayRating: number | null; badges: Array<{ key: string }>; ageProfile: string | null };
    currentClub: string | null;
    position: string | null;
    isInternational: boolean;
  },
) {
  const previousBadges = new Set(previousPacket?.rating.badges.map((badge) => badge.key) ?? []);
  const badgeAdded = nextPacket.rating.badges.some((badge) => !previousBadges.has(badge.key));
  const formDelta = Math.abs((nextPacket.rating.formScore ?? 0) - (previousPacket?.rating.formScore ?? 0));
  const ratingDelta = Math.abs(
    (nextPacket.rating.displayRating ?? 0) - (previousPacket?.rating.displayRating ?? 0),
  );

  return {
    clubChanged: previousPacket?.currentClub !== nextPacket.currentClub,
    positionChanged: previousPacket?.position !== nextPacket.position,
    internationalChanged: previousPacket?.isInternational !== nextPacket.isInternational,
    ratingChanged: ratingDelta >= 5,
    formChanged: formDelta >= 8,
    badgeAdded,
    ageProfileChanged: previousPacket?.rating.ageProfile !== nextPacket.rating.ageProfile,
    initial: !previousPacket,
  };
}

export async function queuePlayerBioRefresh(input: {
  playerId: string;
  trigger: BioRefreshTrigger;
  bioType?: PlayerBioType;
  force?: boolean;
}) {
  const packet = await buildPlayerBioPacket(input.playerId);
  await persistPlayerRating(input.playerId, packet);

  const state = await getPlayerBioAutomationState(input.playerId);
  const previousPacket = state.latestSuggestion?.sourceDataSnapshot as
    | {
        rating: typeof packet.rating;
        currentClub: string | null;
        position: string | null;
        isInternational: boolean;
      }
    | undefined;

  const nextPacket = {
    rating: packet.rating,
    currentClub: packet.currentClub,
    position: packet.position,
    isInternational: packet.isInternational,
  };

  const previous = previousPacket
    ? {
        rating: previousPacket.rating,
        currentClub: previousPacket.currentClub,
        position: previousPacket.position,
        isInternational: previousPacket.isInternational,
      }
    : null;

  const decision = shouldTriggerBioRefresh({
    previousPacket: previous,
    nextPacket,
    trigger: input.trigger,
  });

  const flags = refreshChangeFlags(previous, nextPacket);
  const bioTypes = input.bioType
    ? isProfileBioType(input.bioType)
      ? [input.bioType]
      : []
    : bioTypesForRefresh({
        trigger: input.trigger,
        shouldRefresh: input.force || decision.shouldRefresh,
        ...flags,
        isInternational: packet.isInternational,
        initial: flags.initial,
      });

  if (!input.force && !decision.shouldRefresh) {
    return { queued: false, reason: decision.reason, suggestions: [] as const };
  }

  if (bioTypes.length === 0) {
    return { queued: false, reason: decision.reason, suggestions: [] as const };
  }

  const suggestions = [];
  for (const bioType of bioTypes) {
    suggestions.push(
      await suggestPlayerBio({
        playerId: input.playerId,
        bioType,
        triggerReason: decision.reason ?? input.trigger,
      }),
    );
  }

  return { queued: true, reason: decision.reason, suggestions };
}

export async function savePlayerBioVariant(input: {
  playerId: string;
  bioType: PlayerProfileBioType;
  sections: PlayerBioSections;
  savedBy: string;
  changeSummary?: string;
}) {
  const packet = await buildPlayerBioPacket(input.playerId);
  const result = await persistBioVariants({
    playerId: input.playerId,
    bioType: input.bioType,
    sections: input.sections,
    approvedBy: input.savedBy,
    isInternational: packet.isInternational,
  });

  const db = getDb();
  await db.insert(playerBioHistory).values({
    playerId: input.playerId,
    bioType: input.bioType,
    sections: input.sections,
    changeSummary: input.changeSummary ?? `Manual ${input.bioType} bio saved`,
    triggerReason: "manual",
    approvedBy: input.savedBy,
  });

  return result;
}

export async function approvePlayerBioSuggestion(input: {
  suggestionId: string;
  approvedBy: string;
  sections?: Partial<PlayerBioSections>;
}) {
  const db = getDb();
  const [suggestion] = await db
    .select()
    .from(playerBioSuggestions)
    .where(eq(playerBioSuggestions.id, input.suggestionId))
    .limit(1);
  if (!suggestion) throw new Error("Bio suggestion not found");
  if (suggestion.status !== "pending" && suggestion.status !== "draft") {
    throw new Error("Bio suggestion is not pending");
  }
  if (!isProfileBioType(suggestion.bioType as PlayerBioType)) {
    throw new Error(`Bio type ${suggestion.bioType} cannot be saved as a profile variant`);
  }

  const suggested = suggestion.suggestedSections as PlayerBioSections;
  const approvedSections: PlayerBioSections = {
    shortIntro: input.sections?.shortIntro ?? suggested.shortIntro,
    fullBio: input.sections?.fullBio ?? suggested.fullBio,
    playingStyle: input.sections?.playingStyle ?? suggested.playingStyle,
    strengths: input.sections?.strengths ?? suggested.strengths,
    areasToImprove: input.sections?.areasToImprove ?? suggested.areasToImprove,
    careerSummary: input.sections?.careerSummary ?? suggested.careerSummary,
    internationalSummary: input.sections?.internationalSummary ?? suggested.internationalSummary,
    currentSeasonSummary: input.sections?.currentSeasonSummary ?? suggested.currentSeasonSummary,
    scoutingSummary: input.sections?.scoutingSummary ?? suggested.scoutingSummary,
    ratingExplanation: input.sections?.ratingExplanation ?? suggested.ratingExplanation,
    legendSummary: input.sections?.legendSummary ?? suggested.legendSummary,
  };

  const packet = suggestion.sourceDataSnapshot as { isInternational?: boolean };
  await persistBioVariants({
    playerId: suggestion.playerId,
    bioType: suggestion.bioType as PlayerProfileBioType,
    sections: approvedSections,
    approvedBy: input.approvedBy,
    suggestionId: suggestion.id,
    isInternational: Boolean(packet.isInternational),
  });

  await db.insert(playerBioHistory).values({
    playerId: suggestion.playerId,
    suggestionId: suggestion.id,
    bioType: suggestion.bioType,
    sections: approvedSections,
    changeSummary: suggestion.triggerReason,
    triggerReason: suggestion.triggerReason,
    approvedBy: input.approvedBy,
  });

  const [updated] = await db
    .update(playerBioSuggestions)
    .set({
      status: "approved",
      approvedSections,
      approvedAt: new Date(),
      approvedBy: input.approvedBy,
    })
    .where(eq(playerBioSuggestions.id, input.suggestionId))
    .returning();

  return updated;
}

export async function rejectPlayerBioSuggestion(input: {
  suggestionId: string;
  rejectedBy: string;
}) {
  const db = getDb();
  const [updated] = await db
    .update(playerBioSuggestions)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: input.rejectedBy,
    })
    .where(eq(playerBioSuggestions.id, input.suggestionId))
    .returning();
  if (!updated) throw new Error("Bio suggestion not found");
  return updated;
}

export function diffBioSections(
  current: PlayerBioSections | null | undefined,
  suggested: PlayerBioSections,
) {
  const keys = Object.keys(suggested) as Array<keyof PlayerBioSections>;
  return keys
    .filter((key) => (current?.[key] ?? "").trim() !== suggested[key].trim())
    .map((key) => ({
      section: key,
      previous: current?.[key] ?? "",
      next: suggested[key],
    }));
}

export async function getApprovedPlayerBio(playerId: string) {
  const db = getDb();
  const [profile] = await db
    .select()
    .from(playerBioProfiles)
    .where(eq(playerBioProfiles.playerId, playerId))
    .limit(1);
  const [player] = await db
    .select({ bioSummary: players.bioSummary, internationalTeamId: players.internationalTeamId })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  const variants = readBioVariants(profile ?? null);
  return {
    profile: profile ?? null,
    variants,
    legacyBioSummary: player?.bioSummary ?? null,
    composed: composeFlatBioProfile(variants),
  };
}

export { parseBioSectionsRecord, readBioVariants, composeFlatBioProfile };
