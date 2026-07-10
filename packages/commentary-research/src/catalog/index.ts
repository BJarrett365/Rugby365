import { CommentaryKnowledgeBaseSchema, type CommentaryKnowledgeBase } from "../schemas";
import { buildResearchFindings } from "./findings";
import { REFERENCE_PRODUCTS } from "./products";
import { RUGBY365_RESEARCH_TEMPLATES } from "./templates";

export { REFERENCE_PRODUCTS } from "./products";
export { buildResearchFindings } from "./findings";
export { RUGBY365_RESEARCH_TEMPLATES } from "./templates";

export function loadCommentaryKnowledgeBase(): CommentaryKnowledgeBase {
  return CommentaryKnowledgeBaseSchema.parse({
    version: "1.0.0",
    updatedAt: new Date().toISOString().slice(0, 10),
    policy: {
      noCopyrightedText: true,
      originalTemplatesOnly: true,
      factsFromStructuredDataOnly: true,
    },
    referenceProducts: REFERENCE_PRODUCTS,
    findings: buildResearchFindings(),
    rugby365Templates: RUGBY365_RESEARCH_TEMPLATES,
  });
}

export const COMMENTARY_KNOWLEDGE_BASE = loadCommentaryKnowledgeBase();
