import { and, desc, eq } from "drizzle-orm";
import { aiEnrichmentSuggestions } from "@rugby365/db";
import { chatCompletion, getOpenAiModel, parseJsonObject } from "./openai-client";
import type {
  AiEnrichmentPayload,
  AiEnrichmentTask,
  AiEntityType,
  AiSourceSnapshot,
} from "./ai-enrichment-types";
import { getTeamCoachingStaff } from "./coach-admin-service";
import { getDb } from "./db";
import { findDuplicatePlayers, findDuplicateTeams } from "./entity-dedup-service";
import { getPlayerDetail, getTeamDetail, updatePlayer, updateTeam } from "./entity-admin-service";
import {
  buildAliasSuggestionsFromContext,
  buildApplyPatch,
  buildDuplicateWarnings,
  detectMissingFields,
  detectProfileConflicts,
  mergeEnrichmentPayload,
  parseAiEnrichmentPayload,
} from "./ai-source-context";

const ENRICHMENT_SYSTEM = `You are Rugby365's editorial AI assistant for rugby player and team profiles.
You assist editors by summarising verified data, spotting gaps, comparing sources, and flagging conflicts.
You are NOT the source of truth. Never invent facts. Only use values supported by the provided Rugby365 snapshot.
If uncertain, leave suggestedValue null and explain in rationale.
For players, countryName should be the player's nationality or representative country when supported by squads, Wikipedia, birth place, or career stints — not their club.
Return strict JSON with keys:
fieldSuggestions, textSuggestions, aliasSuggestions, duplicateWarnings, missingFields, notes.
fieldSuggestions items: field, label, suggestedValue, currentValue, confidence (0-1), rationale, sourceKeys, overwriteRequired.
textSuggestions items: key, label, text, confidence, rationale. Keys may include playing_style, career_summary, legend_summary, venue_summary, coaching_summary, competition_history.
aliasSuggestions items: alias, confidence, rationale, seenIn.
duplicateWarnings items: entityId, name, slug, confidence, rationale.
missingFields items: field, label, importance (high|medium|low).
notes: short editor-facing strings.`;

function taskPrompt(task: AiEnrichmentTask, entityType: AiEntityType): string {
  const subject = entityType === "player" ? "player" : "team";
  switch (task) {
    case "generate_bio":
      return `Generate editorial suggestions for this ${subject}: bio summary${entityType === "player" ? ", playing style summary, career summary, and legend summary (if warranted)" : ", venue summary, competition history, and coaching staff summary"}.
Only fill empty profile fields automatically in fieldSuggestions. For populated fields, set overwriteRequired true.`;
    case "check_missing":
      return `Review this ${subject} profile and list missing important fields. Suggest safe values only when clearly supported by the snapshot.`;
    case "check_duplicates":
      return `Review duplicate warnings in the snapshot and explain whether they are likely true duplicates or false positives.`;
    case "compare_sources":
      return `Compare database values with Wikipedia, RugbyPass, SDMS, and match-derived context. Flag conflicts and recommend editor actions. Do not pick a winner without evidence.`;
    case "suggest_aliases":
      return `Suggest likely aliases or name variants editors should track for search and deduplication.`;
    default:
      return `Assist the editor with this ${subject} profile.`;
  }
}

export async function buildPlayerSourceSnapshot(playerId: string): Promise<AiSourceSnapshot> {
  const detail = await getPlayerDetail(playerId);
  if (!detail) throw new Error("Player not found");

  const squadPositions = [...new Set(detail.squads.map((row) => row.positionName).filter(Boolean))];
  const seenNames = [
    detail.player.name,
    detail.player.fullName,
    ...detail.squads.map((row) => row.teamName),
    ...detail.transfers.flatMap((row) => [row.fromClub, row.toClub]),
  ].filter((value): value is string => Boolean(value));

  const duplicateGroup = (await findDuplicatePlayers()).find((group) =>
    group.rows.some((row) => row.id === playerId),
  );

  return {
    entityType: "player",
    entityId: playerId,
    entityName: detail.player.name,
    database: {
      name: detail.player.name,
      fullName: detail.player.fullName,
      slug: detail.player.slug,
      positionName: detail.player.positionName,
      clubName: detail.player.clubName,
      countryName: detail.player.countryName,
      nationCode: detail.player.nationCode,
      birthDate: detail.player.birthDate,
      birthPlace: detail.player.birthPlace,
      heightCm: detail.player.heightCm,
      weightKg: detail.player.weightKg,
      bioSummary: detail.player.bioSummary,
      imageUrl: detail.player.imageUrl,
      externalProviderId: detail.player.externalProviderId,
      sourceProvider: detail.player.sourceProvider,
      socialAccounts: detail.player.socialAccounts,
      squadNumber: detail.player.squadNumber,
    },
    sources: {
      wikipediaUrl: detail.player.wikipediaUrl,
      wikidataId: detail.player.wikidataId,
      rugbypassUrl: detail.player.rugbypassUrl,
      rugbypassSlug: detail.player.rugbypassSlug,
      archiveSyncedAt: detail.player.archiveSyncedAt,
      rugbypassSyncedAt: detail.player.rugbypassSyncedAt,
      clubTeamName: detail.clubTeam?.name ?? null,
      internationalTeamName: detail.internationalTeam?.name ?? null,
      squadPositionName: squadPositions[0] ?? null,
      squadPositions,
    },
    context: {
      stats: detail.stats,
      transferCount: detail.transfers.length,
      squadCount: detail.squads.length,
      externalMatchCount: detail.externalMatches.length,
      careerStintCount: detail.careerStints.length,
      seenNames: [...new Set(seenNames.map((name) => name.trim()))],
      duplicates: duplicateGroup?.rows ?? [],
    },
  };
}

export async function buildTeamSourceSnapshot(teamId: string): Promise<AiSourceSnapshot> {
  const detail = await getTeamDetail(teamId);
  if (!detail) throw new Error("Team not found");
  const coachingStaff = await getTeamCoachingStaff(teamId);

  const competitions = [
    ...new Set(detail.fixtures.map((fixture) => fixture.competitionName).filter(Boolean)),
  ];
  const seenNames = [
    detail.team.name,
    detail.team.shortName,
    ...detail.fixtures.flatMap((fixture) => [fixture.homeTeam, fixture.awayTeam, fixture.opponentName]),
  ].filter((value): value is string => Boolean(value));

  const duplicateGroup = (await findDuplicateTeams()).find((group) =>
    group.rows.some((row) => row.id === teamId),
  );

  return {
    entityType: "team",
    entityId: teamId,
    entityName: detail.team.name,
    database: {
      name: detail.team.name,
      slug: detail.team.slug,
      shortName: detail.team.shortName,
      countryName: detail.team.countryName,
      foundedYear: detail.team.foundedYear,
      bioSummary: detail.team.bioSummary,
      imageUrl: detail.team.imageUrl,
      externalProviderId: detail.team.externalProviderId,
      sourceProvider: detail.team.sourceProvider,
      homeVenueId: detail.team.homeVenueId,
      wikipediaUrl: detail.team.wikipediaUrl,
    },
    sources: {
      wikipediaUrl: detail.team.wikipediaUrl,
      wikidataId: detail.team.wikidataId,
      venueName: detail.homeVenue?.name ?? null,
      venueCountry: detail.homeVenue?.countryName ?? null,
      archiveSyncedAt: detail.team.archiveSyncedAt,
    },
    context: {
      resultsSummary: detail.resultsSummary,
      fixtureCount: detail.fixtures.length,
      playerCount: detail.players.length,
      currentSquadCount: detail.currentSquad.length,
      competitions,
      coachingStaff: coachingStaff.current.map((row) => ({
        name: row.coachName,
        role: row.roleLabel,
        isCurrent: row.isCurrent,
      })),
      seenNames: [...new Set(seenNames.map((name) => name.trim()))],
      duplicates: duplicateGroup?.rows ?? [],
    },
  };
}

export async function buildSourceSnapshot(
  entityType: AiEntityType,
  entityId: string,
): Promise<AiSourceSnapshot> {
  return entityType === "player"
    ? buildPlayerSourceSnapshot(entityId)
    : buildTeamSourceSnapshot(entityId);
}

export async function runAiEnrichment(input: {
  entityType: AiEntityType;
  entityId: string;
  task: AiEnrichmentTask;
  chat?: typeof chatCompletion;
}): Promise<typeof aiEnrichmentSuggestions.$inferSelect> {
  const snapshot = await buildSourceSnapshot(input.entityType, input.entityId);
  const ruleMissing = detectMissingFields(input.entityType, snapshot.database);
  const ruleConflicts = detectProfileConflicts(snapshot);
  const ruleDuplicates = buildDuplicateWarnings(
    input.entityId,
    (snapshot.context.duplicates as Array<{ id: string; name: string; slug: string }>) ?? [],
  );
  const ruleAliases =
    input.task === "suggest_aliases"
      ? buildAliasSuggestionsFromContext(input.entityType, snapshot)
      : [];

  const userPrompt = `${taskPrompt(input.task, input.entityType)}

Snapshot JSON:
${JSON.stringify(snapshot, null, 2)}`;

  const chat = input.chat ?? chatCompletion;
  const raw = await chat({
    system: ENRICHMENT_SYSTEM,
    user: userPrompt,
    json: true,
    maxTokens: 1800,
  });

  const parsed = parseAiEnrichmentPayload(
    parseJsonObject<Record<string, unknown>>(raw, {}),
  );
  const merged = mergeEnrichmentPayload(ruleMissing, ruleConflicts, parsed);

  if (input.task === "check_duplicates" && ruleDuplicates.length) {
    merged.duplicateWarnings = [...ruleDuplicates, ...merged.duplicateWarnings];
  }
  if (input.task === "suggest_aliases" && ruleAliases.length) {
    merged.aliasSuggestions = [...ruleAliases, ...merged.aliasSuggestions];
  }
  if (input.task === "compare_sources" && ruleConflicts.length) {
    merged.notes.push(
      ...ruleConflicts.map(
        (conflict) => `${conflict.label}: ${conflict.values.map((v) => `${v.source}=${v.value}`).join(" vs ")}`,
      ),
    );
  }

  const model = await getOpenAiModel();
  const db = getDb();
  const [row] = await db
    .insert(aiEnrichmentSuggestions)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      task: input.task,
      model,
      promptSystem: ENRICHMENT_SYSTEM,
      promptUser: userPrompt,
      sourceSnapshot: snapshot,
      suggestions: merged,
    })
    .returning();

  return row;
}

export async function listAiEnrichmentSuggestions(entityType: AiEntityType, entityId: string) {
  const db = getDb();
  return db
    .select()
    .from(aiEnrichmentSuggestions)
    .where(
      and(
        eq(aiEnrichmentSuggestions.entityType, entityType),
        eq(aiEnrichmentSuggestions.entityId, entityId),
      ),
    )
    .orderBy(desc(aiEnrichmentSuggestions.createdAt))
    .then((rows) => rows.filter((row) => row.entityType === entityType));
}

export async function getAiEnrichmentSuggestion(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiEnrichmentSuggestions)
    .where(eq(aiEnrichmentSuggestions.id, id))
    .limit(1);
  return row ?? null;
}

export async function approveAiEnrichmentSuggestion(input: {
  id: string;
  approvedBy: string;
  approvedFields: string[];
  allowOverwrite?: boolean;
}) {
  const suggestion = await getAiEnrichmentSuggestion(input.id);
  if (!suggestion) throw new Error("Suggestion not found");
  if (suggestion.status !== "pending") throw new Error("Suggestion is not pending");

  const payload = suggestion.suggestions as AiEnrichmentPayload;
  const snapshot = suggestion.sourceSnapshot as AiSourceSnapshot;
  const patch = buildApplyPatch(
    suggestion.entityType as AiEntityType,
    snapshot.database,
    payload.fieldSuggestions,
    input.approvedFields,
    input.allowOverwrite ?? false,
  );

  if (suggestion.entityType === "player") {
    if (Object.keys(patch).length) {
      await updatePlayer(suggestion.entityId, patch as Parameters<typeof updatePlayer>[1]);
    }
  } else if (Object.keys(patch).length) {
    await updateTeam(suggestion.entityId, patch as Parameters<typeof updateTeam>[1]);
  }

  const db = getDb();
  const [row] = await db
    .update(aiEnrichmentSuggestions)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: input.approvedBy,
      appliedPatch: patch,
    })
    .where(eq(aiEnrichmentSuggestions.id, input.id))
    .returning();

  return row;
}

export async function rejectAiEnrichmentSuggestion(input: { id: string; rejectedBy: string }) {
  const db = getDb();
  const [row] = await db
    .update(aiEnrichmentSuggestions)
    .set({
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: input.rejectedBy,
    })
    .where(eq(aiEnrichmentSuggestions.id, input.id))
    .returning();
  if (!row) throw new Error("Suggestion not found");
  return row;
}
