import { NextResponse } from "next/server";
import { listKnowledgePages, readKnowledgePage, writeKnowledgePage } from "@/lib/knowledge-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const pages = await listKnowledgePages();
    return NextResponse.json({ pages });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list knowledge pages");
  }
}
