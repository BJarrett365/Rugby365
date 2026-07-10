import { NextResponse } from "next/server";
import type { AiEnrichmentTask, AiEntityType } from "@/lib/ai-enrichment-types";
import {
  listAiEnrichmentSuggestions,
  runAiEnrichment,
} from "@/lib/ai-enrichment-service";
import { apiErrorResponse } from "@/lib/api-errors";

type EnrichBody = {
  entityType: AiEntityType;
  entityId: string;
  task: AiEnrichmentTask;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") as AiEntityType | null;
    const entityId = searchParams.get("entityId");

    if (!entityType || !entityId || (entityType !== "player" && entityType !== "team")) {
      return NextResponse.json(
        { error: "entityType (player|team) and entityId are required" },
        { status: 400 },
      );
    }

    const suggestions = await listAiEnrichmentSuggestions(entityType, entityId);
    return NextResponse.json({ suggestions });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load AI enrichment suggestions");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EnrichBody;
    if (!body.entityType || !body.entityId || !body.task) {
      return NextResponse.json(
        { error: "entityType, entityId and task are required" },
        { status: 400 },
      );
    }
    if (body.entityType !== "player" && body.entityType !== "team") {
      return NextResponse.json({ error: "entityType must be player or team" }, { status: 400 });
    }

    const suggestion = await runAiEnrichment(body);
    return NextResponse.json({ suggestion });
  } catch (e) {
    return apiErrorResponse(e, "Failed to run AI enrichment");
  }
}
