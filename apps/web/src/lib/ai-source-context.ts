import type {
  AiAliasSuggestion,
  AiConflictField,
  AiDuplicateWarning,
  AiEnrichmentPayload,
  AiEntityType,
  AiFieldSuggestion,
  AiSourceSnapshot,
  AiVerifiedField,
} from "./ai-enrichment-types";

export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return true;
}

export function normalizeComparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

const PLAYER_PROFILE_FIELDS: Array<{ field: string; label: string; importance: "high" | "medium" | "low" }> = [
  { field: "bioSummary", label: "Bio summary", importance: "medium" },
  { field: "positionName", label: "Position", importance: "high" },
  { field: "countryName", label: "Nationality", importance: "high" },
  { field: "birthDate", label: "Date of birth", importance: "high" },
  { field: "heightCm", label: "Height", importance: "medium" },
  { field: "weightKg", label: "Weight", importance: "medium" },
  { field: "clubName", label: "Club", importance: "medium" },
  { field: "fullName", label: "Full name", importance: "low" },
  { field: "birthPlace", label: "Birth place", importance: "low" },
  { field: "imageUrl", label: "Image", importance: "low" },
];

const TEAM_PROFILE_FIELDS: Array<{ field: string; label: string; importance: "high" | "medium" | "low" }> = [
  { field: "bioSummary", label: "Team bio", importance: "medium" },
  { field: "shortName", label: "Nickname / short name", importance: "medium" },
  { field: "countryName", label: "Country", importance: "medium" },
  { field: "foundedYear", label: "Founded year", importance: "low" },
  { field: "homeVenueId", label: "Home venue", importance: "medium" },
  { field: "wikipediaUrl", label: "Wikipedia URL", importance: "low" },
  { field: "imageUrl", label: "Image", importance: "low" },
];

export function detectMissingFields(
  entityType: AiEntityType,
  database: Record<string, unknown>,
): AiEnrichmentPayload["missingFields"] {
  const fields = entityType === "player" ? PLAYER_PROFILE_FIELDS : TEAM_PROFILE_FIELDS;
  return fields.filter((item) => !hasValue(database[item.field]));
}

export function detectProfileConflicts(snapshot: AiSourceSnapshot): AiConflictField[] {
  const conflicts: AiConflictField[] = [];
  const db = snapshot.database;
  const sources = snapshot.sources;

  if (snapshot.entityType === "player") {
    addConflict(conflicts, "birthDate", "Date of birth", db.birthDate, sources.wikipediaBirthDate, "wikipedia", sources.wikipediaUrl);
    addConflict(conflicts, "heightCm", "Height (cm)", db.heightCm, sources.rugbypassHeightCm, "rugbypass", sources.rugbypassUrl);
    addConflict(conflicts, "weightKg", "Weight (kg)", db.weightKg, sources.rugbypassWeightKg, "rugbypass", sources.rugbypassUrl);
    addConflict(conflicts, "positionName", "Position", db.positionName, sources.squadPositionName, "match squads");
    addConflict(conflicts, "countryName", "Nationality", db.countryName, sources.internationalTeamName, "international team link");
    addConflict(conflicts, "clubName", "Club", db.clubName, sources.clubTeamName, "club team link");
  }

  if (snapshot.entityType === "team") {
    addConflict(conflicts, "name", "Team name", db.name, sources.wikipediaName, "wikipedia", sources.wikipediaUrl);
    addConflict(conflicts, "countryName", "Country", db.countryName, sources.venueCountry, "home venue");
  }

  return conflicts;
}

function addConflict(
  conflicts: AiConflictField[],
  field: string,
  label: string,
  dbValue: unknown,
  sourceValue: unknown,
  source: string,
  sourceUrl?: unknown,
) {
  if (!hasValue(dbValue) || !hasValue(sourceValue)) return;
  if (normalizeComparable(dbValue) === normalizeComparable(sourceValue)) return;
  conflicts.push({
    field,
    label,
    values: [
      { value: dbValue as string | number | null, source: "database" },
      {
        value: sourceValue as string | number | null,
        source,
        sourceUrl: typeof sourceUrl === "string" ? sourceUrl : null,
      },
    ],
    suggestedAction: `Review ${label}; keep database value unless ${source} is more authoritative.`,
  });
}

export function buildConfirmedFields(snapshot: AiSourceSnapshot): AiVerifiedField[] {
  const fields = snapshot.entityType === "player" ? PLAYER_PROFILE_FIELDS : TEAM_PROFILE_FIELDS;
  const confirmed: AiVerifiedField[] = [];

  for (const item of fields) {
    const value = snapshot.database[item.field];
    if (!hasValue(value)) continue;
    confirmed.push({
      field: item.field,
      label: item.label,
      value: value as string | number | null,
      source: "database",
    });
  }

  if (snapshot.entityType === "player" && hasValue(snapshot.sources.wikipediaUrl)) {
    confirmed.push({
      field: "wikipediaUrl",
      label: "Wikipedia",
      value: String(snapshot.sources.wikipediaUrl),
      source: "wikipedia",
      sourceUrl: String(snapshot.sources.wikipediaUrl),
    });
  }

  return confirmed;
}

export function mergeEnrichmentPayload(
  ruleMissing: AiEnrichmentPayload["missingFields"],
  ruleConflicts: AiConflictField[],
  aiPayload: Partial<AiEnrichmentPayload>,
): AiEnrichmentPayload {
  const missingByField = new Map<string, AiEnrichmentPayload["missingFields"][number]>();
  for (const item of ruleMissing) missingByField.set(item.field, item);
  for (const item of aiPayload.missingFields ?? []) missingByField.set(item.field, item);

  return {
    fieldSuggestions: aiPayload.fieldSuggestions ?? [],
    textSuggestions: aiPayload.textSuggestions ?? [],
    aliasSuggestions: aiPayload.aliasSuggestions ?? [],
    duplicateWarnings: aiPayload.duplicateWarnings ?? [],
    missingFields: [...missingByField.values()],
    notes: [
      ...(aiPayload.notes ?? []),
      ...(ruleConflicts.length
        ? [`Rule-based checks found ${ruleConflicts.length} potential conflict(s).`]
        : []),
    ],
  };
}

export function buildDuplicateWarnings(
  entityId: string,
  duplicates: Array<{ id: string; name: string; slug: string }>,
): AiDuplicateWarning[] {
  return duplicates
    .filter((row) => row.id !== entityId)
    .map((row) => ({
      entityId: row.id,
      name: row.name,
      slug: row.slug,
      confidence: 0.75,
      rationale: "Normalized name matches another record in the CMS.",
    }));
}

export function buildAliasSuggestionsFromContext(
  entityType: AiEntityType,
  snapshot: AiSourceSnapshot,
): AiAliasSuggestion[] {
  const aliases = new Map<string, Set<string>>();

  if (entityType === "player") {
    const names = snapshot.context.seenNames;
    if (Array.isArray(names)) {
      for (const name of names) {
        if (typeof name !== "string" || !name.trim()) continue;
        if (normalizeComparable(name) === normalizeComparable(snapshot.entityName)) continue;
        const bucket = aliases.get(name.trim()) ?? new Set<string>();
        bucket.add("squads/transfers");
        aliases.set(name.trim(), bucket);
      }
    }
  }

  if (entityType === "team") {
    const names = snapshot.context.seenNames;
    if (Array.isArray(names)) {
      for (const name of names) {
        if (typeof name !== "string" || !name.trim()) continue;
        if (normalizeComparable(name) === normalizeComparable(snapshot.entityName)) continue;
        const bucket = aliases.get(name.trim()) ?? new Set<string>();
        bucket.add("fixtures/competitions");
        aliases.set(name.trim(), bucket);
      }
    }
    if (hasValue(snapshot.database.shortName)) {
      const shortName = String(snapshot.database.shortName);
      if (normalizeComparable(shortName) !== normalizeComparable(snapshot.entityName)) {
        aliases.set(shortName, new Set(["database shortName"]));
      }
    }
  }

  return [...aliases.entries()].map(([alias, seenIn]) => ({
    alias,
    confidence: 0.7,
    rationale: "Variant seen in Rugby365 source data.",
    seenIn: [...seenIn],
  }));
}

export function parseAiEnrichmentPayload(raw: Record<string, unknown>): AiEnrichmentPayload {
  return {
    fieldSuggestions: asArray(raw.fieldSuggestions).map(parseFieldSuggestion).filter(Boolean) as AiFieldSuggestion[],
    textSuggestions: asArray(raw.textSuggestions).map(parseTextSuggestion).filter(Boolean) as AiEnrichmentPayload["textSuggestions"],
    aliasSuggestions: asArray(raw.aliasSuggestions).map(parseAliasSuggestion).filter(Boolean) as AiAliasSuggestion[],
    duplicateWarnings: asArray(raw.duplicateWarnings).map(parseDuplicateWarning).filter(Boolean) as AiDuplicateWarning[],
    missingFields: asArray(raw.missingFields).map(parseMissingField).filter(Boolean) as AiEnrichmentPayload["missingFields"],
    notes: asArray(raw.notes).filter((item): item is string => typeof item === "string"),
  };
}

export function parseAiVerificationPayload(raw: Record<string, unknown>) {
  return {
    confirmedFields: asArray(raw.confirmedFields),
    missingFields: asArray(raw.missingFields),
    conflictingFields: asArray(raw.conflictingFields),
    sourceUrls: asArray(raw.sourceUrls),
    confidenceScore: typeof raw.confidenceScore === "number" ? raw.confidenceScore : 0.5,
    editorActions: asArray(raw.editorActions),
    summary: typeof raw.summary === "string" ? raw.summary : "",
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseFieldSuggestion(value: unknown): AiFieldSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.field !== "string" || typeof row.label !== "string") return null;
  return {
    field: row.field,
    label: row.label,
    suggestedValue:
      typeof row.suggestedValue === "string" || typeof row.suggestedValue === "number"
        ? row.suggestedValue
        : null,
    currentValue:
      typeof row.currentValue === "string" || typeof row.currentValue === "number"
        ? row.currentValue
        : null,
    confidence: typeof row.confidence === "number" ? row.confidence : 0.5,
    rationale: typeof row.rationale === "string" ? row.rationale : "",
    sourceKeys: asArray(row.sourceKeys).filter((item): item is string => typeof item === "string"),
    overwriteRequired: Boolean(row.overwriteRequired),
  };
}

function parseTextSuggestion(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.key !== "string" || typeof row.text !== "string") return null;
  return {
    key: row.key,
    label: typeof row.label === "string" ? row.label : row.key,
    text: row.text,
    confidence: typeof row.confidence === "number" ? row.confidence : 0.5,
    rationale: typeof row.rationale === "string" ? row.rationale : "",
  };
}

function parseAliasSuggestion(value: unknown): AiAliasSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.alias !== "string") return null;
  return {
    alias: row.alias,
    confidence: typeof row.confidence === "number" ? row.confidence : 0.5,
    rationale: typeof row.rationale === "string" ? row.rationale : "",
    seenIn: asArray(row.seenIn).filter((item): item is string => typeof item === "string"),
  };
}

function parseDuplicateWarning(value: unknown): AiDuplicateWarning | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.entityId !== "string" || typeof row.name !== "string") return null;
  return {
    entityId: row.entityId,
    name: row.name,
    slug: typeof row.slug === "string" ? row.slug : "",
    confidence: typeof row.confidence === "number" ? row.confidence : 0.5,
    rationale: typeof row.rationale === "string" ? row.rationale : "",
  };
}

function parseMissingField(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.field !== "string" || typeof row.label !== "string") return null;
  const importance = row.importance;
  return {
    field: row.field,
    label: row.label,
    importance: importance === "high" || importance === "low" ? importance : "medium",
  };
}

export const PLAYER_APPLYABLE_FIELDS = new Set([
  "bioSummary",
  "positionName",
  "countryName",
  "birthDate",
  "birthPlace",
  "heightCm",
  "weightKg",
  "clubName",
  "fullName",
  "nationCode",
  "socialAccounts",
]);

export const TEAM_APPLYABLE_FIELDS = new Set([
  "bioSummary",
  "shortName",
  "countryName",
  "foundedYear",
]);

export function buildApplyPatch(
  entityType: AiEntityType,
  database: Record<string, unknown>,
  fieldSuggestions: AiFieldSuggestion[],
  approvedFields: string[],
  allowOverwrite: boolean,
): Record<string, unknown> {
  const allowed = entityType === "player" ? PLAYER_APPLYABLE_FIELDS : TEAM_APPLYABLE_FIELDS;
  const patch: Record<string, unknown> = {};

  for (const suggestion of fieldSuggestions) {
    if (!allowed.has(suggestion.field)) continue;
    if (!approvedFields.includes(suggestion.field)) continue;
    if (suggestion.suggestedValue === null) continue;

    const current = database[suggestion.field];
    const hasCurrent = hasValue(current);
    if (hasCurrent && !allowOverwrite && suggestion.overwriteRequired) continue;
    if (hasCurrent && !allowOverwrite) continue;

    patch[suggestion.field] = suggestion.suggestedValue;
  }

  return patch;
}
