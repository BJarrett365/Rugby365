export type AiEntityType = "player" | "team";

export type AiEnrichmentTask =
  | "generate_bio"
  | "check_missing"
  | "check_duplicates"
  | "compare_sources"
  | "suggest_aliases";

export type AiFieldSuggestion = {
  field: string;
  label: string;
  suggestedValue: string | number | null;
  currentValue?: string | number | null;
  confidence: number;
  rationale: string;
  sourceKeys: string[];
  overwriteRequired: boolean;
};

export type AiTextSuggestion = {
  key: string;
  label: string;
  text: string;
  confidence: number;
  rationale: string;
};

export type AiAliasSuggestion = {
  alias: string;
  confidence: number;
  rationale: string;
  seenIn: string[];
};

export type AiDuplicateWarning = {
  entityId: string;
  name: string;
  slug: string;
  confidence: number;
  rationale: string;
};

export type AiEnrichmentPayload = {
  fieldSuggestions: AiFieldSuggestion[];
  textSuggestions: AiTextSuggestion[];
  aliasSuggestions: AiAliasSuggestion[];
  duplicateWarnings: AiDuplicateWarning[];
  missingFields: Array<{ field: string; label: string; importance: "high" | "medium" | "low" }>;
  notes: string[];
};

export type AiVerifiedField = {
  field: string;
  label: string;
  value: string | number | null;
  source: string;
  sourceUrl?: string | null;
};

export type AiConflictField = {
  field: string;
  label: string;
  values: Array<{
    value: string | number | null;
    source: string;
    sourceUrl?: string | null;
  }>;
  suggestedAction: string;
};

export type AiEditorAction = {
  priority: "high" | "medium" | "low";
  action: string;
  rationale: string;
};

export type AiVerificationReportPayload = {
  confirmedFields: AiVerifiedField[];
  missingFields: Array<{ field: string; label: string; importance: "high" | "medium" | "low" }>;
  conflictingFields: AiConflictField[];
  sourceUrls: Array<{ label: string; url: string }>;
  confidenceScore: number;
  editorActions: AiEditorAction[];
  summary: string;
};

export type AiSourceSnapshot = {
  entityType: AiEntityType;
  entityId: string;
  entityName: string;
  database: Record<string, unknown>;
  sources: Record<string, unknown>;
  context: Record<string, unknown>;
};
