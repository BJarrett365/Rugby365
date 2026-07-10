import { z } from "zod";

export const ReferenceProviderSchema = z.enum([
  "planet_rugby",
  "sport365",
  "espn_scrum",
  "statscore",
  "all_rugby",
]);

export type ReferenceProvider = z.infer<typeof ReferenceProviderSchema>;

export const ProductRoleSchema = z.enum(["first_party", "data_source", "reference_only"]);

export const ReferenceProductSchema = z.object({
  slug: ReferenceProviderSchema,
  name: z.string(),
  role: ProductRoleSchema,
  url: z.string().url().optional(),
  learnFrom: z.array(z.string()),
  doNotCopy: z.array(z.string()),
  matchCentrePatterns: z.array(z.string()).optional(),
  commentaryPatterns: z.array(z.string()).optional(),
  dataPatterns: z.array(z.string()).optional(),
});

export type ReferenceProduct = z.infer<typeof ReferenceProductSchema>;

export const EventOrderingSchema = z.enum([
  "immediate",
  "batched",
  "end_of_phase",
  "period_break",
  "post_match",
]);

export const EventFrequencySchema = z.enum([
  "on_every_event",
  "high",
  "medium",
  "low",
  "rare",
  "summary_only",
]);

export const EventImportanceSchema = z.enum(["critical", "high", "medium", "low"]);

export const CommentaryToneSchema = z.enum([
  "neutral",
  "factual",
  "dramatic",
  "analytical",
  "celebratory",
]);

export const SentenceLengthSchema = z.enum(["short", "medium", "long"]);

export const CommentaryStyleMetaSchema = z.object({
  ordering: EventOrderingSchema,
  frequency: EventFrequencySchema,
  importance: EventImportanceSchema,
  cadenceSeconds: z.object({ min: z.number(), max: z.number() }).optional(),
});

export const CommentaryPresentationMetaSchema = z.object({
  minuteFormat: z.string(),
  includesScore: z.boolean(),
  includesTeam: z.boolean(),
  includesPlayer: z.boolean(),
  includesReason: z.boolean(),
  includesLocation: z.boolean(),
  sentenceLength: SentenceLengthSchema,
  tone: CommentaryToneSchema,
  grouping: z.string().optional(),
  scoreAnnouncementStyle: z.string().optional(),
});

export const CommentaryResearchFindingSchema = z.object({
  id: z.string(),
  provider: ReferenceProviderSchema,
  eventType: z.string(),
  category: z.string(),
  style: CommentaryStyleMetaSchema,
  presentation: CommentaryPresentationMetaSchema,
  /** Structural research notes — never copyrighted text samples. */
  researchNotes: z.string(),
  templateGuidance: z.string(),
  rugby365TemplateKeys: z.array(z.string()),
  rugbyLawCategories: z.array(z.string()).optional(),
});

export type CommentaryResearchFinding = z.infer<typeof CommentaryResearchFindingSchema>;

export const Rugby365TemplateFromResearchSchema = z.object({
  templateKey: z.string(),
  outputType: z.string(),
  tone: CommentaryToneSchema,
  body: z.string(),
  eventTypes: z.array(z.string()),
  researchSource: z.string(),
  placeholders: z.array(z.string()),
});

export type Rugby365TemplateFromResearch = z.infer<typeof Rugby365TemplateFromResearchSchema>;

export const CommentaryKnowledgeBaseSchema = z.object({
  version: z.string(),
  updatedAt: z.string(),
  policy: z.object({
    noCopyrightedText: z.boolean(),
    originalTemplatesOnly: z.boolean(),
    factsFromStructuredDataOnly: z.boolean(),
  }),
  referenceProducts: z.array(ReferenceProductSchema),
  findings: z.array(CommentaryResearchFindingSchema),
  rugby365Templates: z.array(Rugby365TemplateFromResearchSchema),
});

export type CommentaryKnowledgeBase = z.infer<typeof CommentaryKnowledgeBaseSchema>;

export const RUGBY_EVENT_TYPES = [
  "try",
  "conversion",
  "conversion_missed",
  "drop_goal",
  "penalty_goal",
  "penalty",
  "scrum",
  "lineout",
  "maul",
  "ruck",
  "turnover",
  "card_yellow",
  "card_red",
  "substitution",
  "injury",
  "tmo_decision",
  "referee_decision",
  "score_update",
  "half_time",
  "full_time",
  "phase_milestone",
] as const;

export type RugbyEventType = (typeof RUGBY_EVENT_TYPES)[number];
