import { NextResponse } from "next/server";
import { loadCommentaryKnowledgeBase } from "@rugby365/commentary-research";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  const eventType = searchParams.get("eventType");

  const kb = loadCommentaryKnowledgeBase();

  let findings = kb.findings;
  if (provider) findings = findings.filter((f) => f.provider === provider);
  if (eventType) findings = findings.filter((f) => f.eventType === eventType);

  return NextResponse.json({
    policy: kb.policy,
    version: kb.version,
    updatedAt: kb.updatedAt,
    referenceProducts: kb.referenceProducts,
    findings,
    rugby365Templates: kb.rugby365Templates,
    stats: {
      productCount: kb.referenceProducts.length,
      findingCount: kb.findings.length,
      templateCount: kb.rugby365Templates.length,
      eventTypes: [...new Set(kb.findings.map((f) => f.eventType))].sort(),
    },
  });
}
