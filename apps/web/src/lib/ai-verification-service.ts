import { and, desc, eq } from "drizzle-orm";
import { aiVerificationReports } from "@rugby365/db";
import { chatCompletion, getOpenAiModel, parseJsonObject } from "./openai-client";
import type { AiEntityType, AiSourceSnapshot, AiVerificationReportPayload } from "./ai-enrichment-types";
import { buildSourceSnapshot } from "./ai-enrichment-service";
import {
  buildConfirmedFields,
  buildDuplicateWarnings,
  detectMissingFields,
  detectProfileConflicts,
  parseAiVerificationPayload,
} from "./ai-source-context";
import { getDb } from "./db";

const VERIFICATION_SYSTEM = `You are Rugby365's verification assistant for rugby profiles.
Produce an editorial verification report using ONLY the provided snapshot.
OpenAI is not authoritative — highlight what is confirmed, missing, or conflicting across Rugby365 database and linked sources.
Return strict JSON with keys:
confirmedFields, missingFields, conflictingFields, sourceUrls, confidenceScore (0-1), editorActions, summary.
editorActions items: priority (high|medium|low), action, rationale.
Do not invent URLs or facts.`;

export function buildRuleVerificationReport(snapshot: AiSourceSnapshot): AiVerificationReportPayload {
  const missingFields = detectMissingFields(snapshot.entityType, snapshot.database);
  const conflictingFields = detectProfileConflicts(snapshot);
  const confirmedFields = buildConfirmedFields(snapshot);
  const sourceUrls = collectSourceUrls(snapshot);
  const duplicateWarnings = buildDuplicateWarnings(
    snapshot.entityId,
    (snapshot.context.duplicates as Array<{ id: string; name: string; slug: string }>) ?? [],
  );

  const editorActions = [
    ...missingFields
      .filter((field) => field.importance === "high")
      .map((field) => ({
        priority: "high" as const,
        action: `Fill ${field.label}`,
        rationale: `${field.label} is missing from the approved profile.`,
      })),
    ...conflictingFields.map((conflict) => ({
      priority: "high" as const,
      action: `Resolve ${conflict.label} conflict`,
      rationale: conflict.suggestedAction,
    })),
    ...duplicateWarnings.map((warning) => ({
      priority: "medium" as const,
      action: `Review duplicate: ${warning.name}`,
      rationale: warning.rationale,
    })),
  ];

  const confidenceScore = Math.max(
    0.2,
    Math.min(
      0.95,
      0.4 +
        confirmedFields.length * 0.04 -
        missingFields.filter((field) => field.importance === "high").length * 0.08 -
        conflictingFields.length * 0.1,
    ),
  );

  return {
    confirmedFields,
    missingFields,
    conflictingFields,
    sourceUrls,
    confidenceScore,
    editorActions,
    summary: `Rule-based verification for ${snapshot.entityName}: ${confirmedFields.length} confirmed, ${missingFields.length} missing, ${conflictingFields.length} conflicting.`,
  };
}

function collectSourceUrls(snapshot: AiSourceSnapshot) {
  const urls: AiVerificationReportPayload["sourceUrls"] = [];
  const add = (label: string, url: unknown) => {
    if (typeof url === "string" && url.trim()) urls.push({ label, url: url.trim() });
  };
  add("Wikipedia", snapshot.sources.wikipediaUrl);
  add("RugbyPass", snapshot.sources.rugbypassUrl);
  add("Wikidata", snapshot.sources.wikidataId);
  return urls;
}

export async function runAiVerification(input: {
  entityType: AiEntityType;
  entityId: string;
  chat?: typeof chatCompletion;
}): Promise<typeof aiVerificationReports.$inferSelect> {
  const snapshot = await buildSourceSnapshot(input.entityType, input.entityId);
  const ruleReport = buildRuleVerificationReport(snapshot);

  const userPrompt = `Create a verification report for this ${input.entityType}.

Snapshot JSON:
${JSON.stringify(snapshot, null, 2)}

Rule-based pre-check JSON:
${JSON.stringify(ruleReport, null, 2)}`;

  const chat = input.chat ?? chatCompletion;
  const raw = await chat({
    system: VERIFICATION_SYSTEM,
    user: userPrompt,
    json: true,
    maxTokens: 1800,
  });

  const aiReport = parseAiVerificationPayload(parseJsonObject<Record<string, unknown>>(raw, {}));
  const report: AiVerificationReportPayload = {
    confirmedFields: mergeConfirmed(ruleReport.confirmedFields, aiReport.confirmedFields),
    missingFields: mergeMissing(ruleReport.missingFields, aiReport.missingFields),
    conflictingFields: mergeConflicts(ruleReport.conflictingFields, aiReport.conflictingFields),
    sourceUrls: mergeSourceUrls(ruleReport.sourceUrls, aiReport.sourceUrls),
    confidenceScore:
      typeof aiReport.confidenceScore === "number" ? aiReport.confidenceScore : ruleReport.confidenceScore,
    editorActions: mergeActions(ruleReport.editorActions, aiReport.editorActions),
    summary: aiReport.summary || ruleReport.summary,
  };

  const model = await getOpenAiModel();
  const db = getDb();
  const [row] = await db
    .insert(aiVerificationReports)
    .values({
      entityType: input.entityType,
      entityId: input.entityId,
      model,
      promptSystem: VERIFICATION_SYSTEM,
      promptUser: userPrompt,
      sourceSnapshot: snapshot,
      report,
      confidenceScore: report.confidenceScore,
    })
    .returning();

  return row;
}

export async function listAiVerificationReports(entityType: AiEntityType, entityId: string) {
  const db = getDb();
  return db
    .select()
    .from(aiVerificationReports)
    .where(
      and(
        eq(aiVerificationReports.entityType, entityType),
        eq(aiVerificationReports.entityId, entityId),
      ),
    )
    .orderBy(desc(aiVerificationReports.createdAt))
    .then((rows) => rows.filter((row) => row.entityType === entityType));
}

export async function markVerificationReportReviewed(input: { id: string; reviewedBy: string }) {
  const db = getDb();
  const [row] = await db
    .update(aiVerificationReports)
    .set({
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: input.reviewedBy,
    })
    .where(eq(aiVerificationReports.id, input.id))
    .returning();
  if (!row) throw new Error("Verification report not found");
  return row;
}

function mergeConfirmed(rule: AiVerificationReportPayload["confirmedFields"], ai: unknown[]) {
  const map = new Map(rule.map((item) => [item.field, item]));
  for (const item of ai) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.field !== "string") continue;
    map.set(row.field, {
      field: row.field,
      label: typeof row.label === "string" ? row.label : row.field,
      value:
        typeof row.value === "string" || typeof row.value === "number" ? row.value : null,
      source: typeof row.source === "string" ? row.source : "ai",
      sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : null,
    });
  }
  return [...map.values()];
}

function mergeMissing(
  rule: AiVerificationReportPayload["missingFields"],
  ai: unknown[],
): AiVerificationReportPayload["missingFields"] {
  const map = new Map(rule.map((item) => [item.field, item]));
  for (const item of ai) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.field !== "string" || typeof row.label !== "string") continue;
    const importance = row.importance;
    map.set(row.field, {
      field: row.field,
      label: row.label,
      importance: importance === "high" || importance === "low" ? importance : "medium",
    });
  }
  return [...map.values()];
}

function mergeConflicts(
  rule: AiVerificationReportPayload["conflictingFields"],
  ai: unknown[],
): AiVerificationReportPayload["conflictingFields"] {
  return [...rule, ...ai.filter((item) => item && typeof item === "object")] as AiVerificationReportPayload["conflictingFields"];
}

function mergeSourceUrls(
  rule: AiVerificationReportPayload["sourceUrls"],
  ai: unknown[],
): AiVerificationReportPayload["sourceUrls"] {
  const map = new Map(rule.map((item) => [item.url, item]));
  for (const item of ai) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.url !== "string" || typeof row.label !== "string") continue;
    map.set(row.url, { label: row.label, url: row.url });
  }
  return [...map.values()];
}

function mergeActions(
  rule: AiVerificationReportPayload["editorActions"],
  ai: unknown[],
): AiVerificationReportPayload["editorActions"] {
  const actions = [...rule];
  for (const item of ai) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.action !== "string") continue;
    const priority = row.priority;
    actions.push({
      priority: priority === "high" || priority === "low" ? priority : "medium",
      action: row.action,
      rationale: typeof row.rationale === "string" ? row.rationale : "",
    });
  }
  return actions;
}
