import { desc, eq } from "drizzle-orm";
import {
  coaches,
  personBioHistory,
  personBioProfiles,
  personBioSuggestions,
  personVerificationReports,
  referees,
} from "@rugby365/db";
import { chatCompletion, getOpenAiModel, parseJsonObject } from "./openai-client";
import {
  buildCoachIntelligencePacket,
  persistCoachIntelligenceScore,
} from "./coach-intelligence-service";
import {
  buildRefereeIntelligencePacket,
  persistRefereeIntelligenceScore,
} from "./referee-intelligence-service";
import { getPersonById } from "./person-intelligence-service";
import {
  buildPersonBioPrompt,
  parsePersonBioSections,
} from "./person-bio-prompt-service";
import type {
  PersonBioSections,
  PersonBioType,
  PersonIntelligencePacket,
  PersonRoleType,
} from "./person-intelligence-types";
import { getDb } from "./db";
import { buildPersonVerificationReport } from "./person-verification-service";

export async function buildPersonIntelligencePacket(
  roleType: PersonRoleType,
  roleEntityId: string,
  options?: { persistScore?: boolean },
): Promise<PersonIntelligencePacket> {
  if (roleType === "coach") {
    const packet = await buildCoachIntelligencePacket(roleEntityId);
    if (options?.persistScore !== false) {
      await persistCoachIntelligenceScore(
        packet,
        (packet.roleContext.currentAssignment as { teamId?: string } | null)?.teamId ?? null,
      );
    }
    return packet;
  }
  if (roleType === "referee") {
    const packet = await buildRefereeIntelligencePacket(roleEntityId);
    if (options?.persistScore !== false) {
      await persistRefereeIntelligenceScore(packet);
    }
    return packet;
  }
  throw new Error(`Person bio automation not supported for role type: ${roleType}`);
}

export async function getPersonBioAutomationState(personId: string) {
  const db = getDb();
  const person = await getPersonById(personId);
  if (!person) throw new Error("Person not found");

  const [profile, latestSuggestion, latestReport, history, scoreHistory] = await Promise.all([
    db.select().from(personBioProfiles).where(eq(personBioProfiles.personId, personId)).limit(1),
    db
      .select()
      .from(personBioSuggestions)
      .where(eq(personBioSuggestions.personId, personId))
      .orderBy(desc(personBioSuggestions.createdAt))
      .limit(1),
    db
      .select()
      .from(personVerificationReports)
      .where(eq(personVerificationReports.personId, personId))
      .orderBy(desc(personVerificationReports.createdAt))
      .limit(1),
    db
      .select()
      .from(personBioHistory)
      .where(eq(personBioHistory.personId, personId))
      .orderBy(desc(personBioHistory.createdAt))
      .limit(5),
    db
      .select()
      .from(personBioSuggestions)
      .where(eq(personBioSuggestions.personId, personId))
      .orderBy(desc(personBioSuggestions.createdAt))
      .limit(10),
  ]);

  const packet = await buildPersonIntelligencePacket(
    person.roleType as PersonRoleType,
    person.roleEntityId,
    { persistScore: false },
  );

  return {
    person,
    packet,
    profile: profile[0] ?? null,
    latestSuggestion: latestSuggestion[0] ?? null,
    latestVerificationReport: latestReport[0] ?? null,
    history,
    suggestions: scoreHistory,
  };
}

export async function suggestPersonBio(input: {
  personId: string;
  bioType?: PersonBioType;
  triggerReason: string;
  chat?: typeof chatCompletion;
}) {
  const person = await getPersonById(input.personId);
  if (!person) throw new Error("Person not found");

  const packet = await buildPersonIntelligencePacket(
    person.roleType as PersonRoleType,
    person.roleEntityId,
    { persistScore: true },
  );
  const bioType = input.bioType ?? defaultBioType(person.roleType as PersonRoleType);
  const prompt = buildPersonBioPrompt(bioType, packet);
  const verificationReport = buildPersonVerificationReport(packet);

  const chat = input.chat ?? chatCompletion;
  const raw = await chat({
    system: prompt.system,
    user: prompt.user,
    json: true,
    maxTokens: 2000,
  });

  const parsed = parsePersonBioSections(parseJsonObject<Record<string, unknown>>(raw, {}));
  const suggestedSections: PersonBioSections = {
    ...parsed,
    ratingExplanation: parsed.ratingExplanation || packet.score.explanation,
  };

  const db = getDb();
  const [suggestion] = await db
    .insert(personBioSuggestions)
    .values({
      personId: input.personId,
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

  await db.insert(personVerificationReports).values({
    personId: input.personId,
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

function defaultBioType(roleType: PersonRoleType): PersonBioType {
  if (roleType === "coach") return "coach_full_profile";
  if (roleType === "referee") return "referee_full_profile";
  return "coach_short_bio";
}

export async function approvePersonBioSuggestion(input: {
  suggestionId: string;
  approvedBy: string;
  sections?: Partial<PersonBioSections>;
}) {
  const db = getDb();
  const [suggestion] = await db
    .select()
    .from(personBioSuggestions)
    .where(eq(personBioSuggestions.id, input.suggestionId))
    .limit(1);
  if (!suggestion) throw new Error("Bio suggestion not found");
  if (suggestion.status !== "pending") throw new Error("Bio suggestion is not pending");

  const suggested = suggestion.suggestedSections as PersonBioSections;
  const approvedSections: PersonBioSections = {
    shortIntro: input.sections?.shortIntro ?? suggested.shortIntro,
    fullBio: input.sections?.fullBio ?? suggested.fullBio,
    careerSummary: input.sections?.careerSummary ?? suggested.careerSummary,
    ratingExplanation: input.sections?.ratingExplanation ?? suggested.ratingExplanation,
    appointmentSummary: input.sections?.appointmentSummary ?? suggested.appointmentSummary,
    experienceProfile: input.sections?.experienceProfile ?? suggested.experienceProfile,
  };

  await db
    .insert(personBioProfiles)
    .values({
      personId: suggestion.personId,
      primaryBioType: suggestion.bioType,
      shortIntro: approvedSections.shortIntro,
      fullBio: approvedSections.fullBio,
      careerSummary: approvedSections.careerSummary,
      ratingExplanation: approvedSections.ratingExplanation,
      appointmentSummary: approvedSections.appointmentSummary,
      experienceProfile: approvedSections.experienceProfile,
      approvedSuggestionId: suggestion.id,
      approvedBy: input.approvedBy,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: personBioProfiles.personId,
      set: {
        primaryBioType: suggestion.bioType,
        shortIntro: approvedSections.shortIntro,
        fullBio: approvedSections.fullBio,
        careerSummary: approvedSections.careerSummary,
        ratingExplanation: approvedSections.ratingExplanation,
        appointmentSummary: approvedSections.appointmentSummary,
        experienceProfile: approvedSections.experienceProfile,
        approvedSuggestionId: suggestion.id,
        approvedBy: input.approvedBy,
        updatedAt: new Date(),
      },
    });

  const person = await getPersonById(suggestion.personId);
  if (person?.roleType === "coach") {
    await db
      .update(coaches)
      .set({ bioSummary: approvedSections.shortIntro || approvedSections.fullBio || null })
      .where(eq(coaches.id, person.roleEntityId));
  } else if (person?.roleType === "referee") {
    await db
      .update(referees)
      .set({ bioSummary: approvedSections.shortIntro || approvedSections.fullBio || null })
      .where(eq(referees.id, person.roleEntityId));
  }

  await db.insert(personBioHistory).values({
    personId: suggestion.personId,
    suggestionId: suggestion.id,
    bioType: suggestion.bioType,
    sections: approvedSections,
    changeSummary: suggestion.triggerReason,
    triggerReason: suggestion.triggerReason,
    approvedBy: input.approvedBy,
  });

  const [updated] = await db
    .update(personBioSuggestions)
    .set({
      status: "approved",
      approvedSections,
      approvedAt: new Date(),
      approvedBy: input.approvedBy,
    })
    .where(eq(personBioSuggestions.id, input.suggestionId))
    .returning();

  return updated;
}

export async function rejectPersonBioSuggestion(input: {
  suggestionId: string;
  rejectedBy: string;
}) {
  const db = getDb();
  const [updated] = await db
    .update(personBioSuggestions)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: input.rejectedBy,
    })
    .where(eq(personBioSuggestions.id, input.suggestionId))
    .returning();
  if (!updated) throw new Error("Bio suggestion not found");
  return updated;
}

export function diffPersonBioSections(
  current: PersonBioSections | null | undefined,
  suggested: PersonBioSections,
) {
  const keys = Object.keys(suggested) as Array<keyof PersonBioSections>;
  return keys
    .filter((key) => (current?.[key] ?? "").trim() !== suggested[key].trim())
    .map((key) => ({ section: key, previous: current?.[key] ?? "", next: suggested[key] }));
}
