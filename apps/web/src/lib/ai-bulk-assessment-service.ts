import { asc } from "drizzle-orm";
import { players, teams } from "@rugby365/db";
import {
  approveAiEnrichmentSuggestion,
  runAiEnrichment,
} from "./ai-enrichment-service";
import type { AiEnrichmentPayload, AiEntityType } from "./ai-enrichment-types";
import { hasValue } from "./ai-source-context";
import { getDb } from "./db";
import { linkInternationalTeamForPlayer } from "./international-team-assign-service";

export type BulkAiAssessmentOptions = {
  entityType?: AiEntityType | "both";
  onlyMissing?: boolean;
  limit?: number;
  delayMs?: number;
  autoApply?: boolean;
  minConfidence?: number;
  onProgress?: (progress: {
    index: number;
    total: number;
    entityType: AiEntityType;
    entityName: string;
    appliedFields: string[];
    error?: string;
  }) => void;
};

export type BulkAiAssessmentResult = {
  playersProcessed: number;
  teamsProcessed: number;
  suggestionsCreated: number;
  fieldsApplied: number;
  internationalTeamsLinked: number;
  failures: Array<{ entityType: AiEntityType; entityId: string; entityName: string; error: string }>;
};

const DEFAULT_MIN_CONFIDENCE = 0.85;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function autoApplyableFields(
  payload: AiEnrichmentPayload,
  minConfidence: number,
): string[] {
  return payload.fieldSuggestions
    .filter((suggestion) => {
      if (suggestion.suggestedValue === null) return false;
      if (suggestion.confidence < minConfidence) return false;
      if (suggestion.overwriteRequired) return false;
      if (hasValue(suggestion.currentValue)) return false;
      return true;
    })
    .map((suggestion) => suggestion.field);
}

export async function assessEntityWithAi(input: {
  entityType: AiEntityType;
  entityId: string;
  autoApply?: boolean;
  minConfidence?: number;
}): Promise<{
  suggestionId: string;
  appliedFields: string[];
  internationalLinked: boolean;
}> {
  const suggestion = await runAiEnrichment({
    entityType: input.entityType,
    entityId: input.entityId,
    task: "check_missing",
  });

  const payload = suggestion.suggestions as AiEnrichmentPayload;
  const appliedFields: string[] = [];
  let internationalLinked = false;

  if (input.autoApply) {
    const fields = autoApplyableFields(payload, input.minConfidence ?? DEFAULT_MIN_CONFIDENCE);

    if (fields.length > 0) {
      const approved = await approveAiEnrichmentSuggestion({
        id: suggestion.id,
        approvedBy: "ai-bulk-assessment",
        approvedFields: fields,
        allowOverwrite: false,
      });
      appliedFields.push(...fields);

      if (input.entityType === "player") {
        const patch = (approved.appliedPatch ?? {}) as Record<string, unknown>;
        if (typeof patch.countryName === "string") {
          const linked = await linkInternationalTeamForPlayer(input.entityId, {
            countryName: patch.countryName,
            createTeamIfMissing: true,
          });
          internationalLinked = linked.linked;
        }
      }
    }
  }

  return { suggestionId: suggestion.id, appliedFields, internationalLinked };
}

export async function bulkAiAssessPlayersAndTeams(
  options: BulkAiAssessmentOptions = {},
): Promise<BulkAiAssessmentResult> {
  const db = getDb();
  const entityTypes: AiEntityType[] =
    options.entityType === "player" || options.entityType === "team"
      ? [options.entityType]
      : ["player", "team"];

  const result: BulkAiAssessmentResult = {
    playersProcessed: 0,
    teamsProcessed: 0,
    suggestionsCreated: 0,
    fieldsApplied: 0,
    internationalTeamsLinked: 0,
    failures: [],
  };

  const delayMs = options.delayMs ?? 500;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

  for (const entityType of entityTypes) {
    let targets =
      entityType === "player"
        ? await db.select({ id: players.id, name: players.name }).from(players).orderBy(asc(players.name))
        : await db.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name));

    if (options.onlyMissing && entityType === "player") {
      const { playerProfileIncompleteWhere } = await import("./player-profile-fields");
      targets = await db
        .select({ id: players.id, name: players.name })
        .from(players)
        .where(playerProfileIncompleteWhere())
        .orderBy(asc(players.name));
    }

    if (options.limit) {
      const remaining =
        options.entityType === "both"
          ? Math.max(0, options.limit - result.playersProcessed - result.teamsProcessed)
          : options.limit;
      targets = targets.slice(0, remaining);
    }

    for (let index = 0; index < targets.length; index++) {
      const target = targets[index]!;
      try {
        const assessed = await assessEntityWithAi({
          entityType,
          entityId: target.id,
          autoApply: options.autoApply ?? true,
          minConfidence,
        });
        result.suggestionsCreated += 1;
        result.fieldsApplied += assessed.appliedFields.length;
        if (assessed.internationalLinked) result.internationalTeamsLinked += 1;
        if (entityType === "player") result.playersProcessed += 1;
        else result.teamsProcessed += 1;

        options.onProgress?.({
          index: index + 1,
          total: targets.length,
          entityType,
          entityName: target.name,
          appliedFields: assessed.appliedFields,
        });
      } catch (error) {
        result.failures.push({
          entityType,
          entityId: target.id,
          entityName: target.name,
          error: error instanceof Error ? error.message : String(error),
        });
        options.onProgress?.({
          index: index + 1,
          total: targets.length,
          entityType,
          entityName: target.name,
          appliedFields: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (index < targets.length - 1 && delayMs > 0) await sleep(delayMs);
    }
  }

  return result;
}
