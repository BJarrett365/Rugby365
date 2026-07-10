import { loadCommentaryKnowledgeBase } from "@rugby365/commentary-research";
import { commentaryResearchFindings, referenceProducts } from "./schema/index";
import type { Db } from "./client";

export async function seedCommentaryResearch(db: Db) {
  const kb = loadCommentaryKnowledgeBase();

  for (const product of kb.referenceProducts) {
    await db
      .insert(referenceProducts)
      .values({
        slug: product.slug,
        name: product.name,
        role: product.role,
        sourceUrl: product.url,
        learnFrom: product.learnFrom,
        doNotCopy: product.doNotCopy,
        matchCentrePatterns: product.matchCentrePatterns ?? [],
        commentaryPatterns: product.commentaryPatterns ?? [],
        dataPatterns: product.dataPatterns ?? [],
      })
      .onConflictDoNothing();
  }

  for (const finding of kb.findings) {
    await db
      .insert(commentaryResearchFindings)
      .values({
        externalId: finding.id,
        providerSlug: finding.provider,
        eventType: finding.eventType,
        category: finding.category,
        style: finding.style,
        presentation: finding.presentation,
        researchNotes: finding.researchNotes,
        templateGuidance: finding.templateGuidance,
        rugby365TemplateKeys: finding.rugby365TemplateKeys,
        rugbyLawCategories: finding.rugbyLawCategories ?? [],
      })
      .onConflictDoNothing();
  }

  console.log(
    `Commentary research seeded: ${kb.referenceProducts.length} products, ${kb.findings.length} findings, ${kb.rugby365Templates.length} templates in catalog`,
  );
}
