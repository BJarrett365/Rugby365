import { NextResponse } from "next/server";
import { bulkImportFromSport365 } from "@/lib/sport365-import-service";
import { apiErrorResponse } from "@/lib/api-errors";

function bulkErrorSummary(result: Awaited<ReturnType<typeof bulkImportFromSport365>>): string | undefined {
  if (result.imported > 0 || result.errors.length === 0) return undefined;
  return result.errors.map((e) => `${e.matchId}: ${e.error}`).join(" · ");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      tournamentUrl?: string;
      matchIds?: string[];
      createTeams?: boolean;
      importEvents?: boolean;
    };

    if (!body.tournamentUrl?.trim()) {
      return NextResponse.json({ error: "tournamentUrl is required" }, { status: 400 });
    }
    if (!body.matchIds?.length) {
      return NextResponse.json({ error: "matchIds must include at least one match" }, { status: 400 });
    }

    const result = await bulkImportFromSport365({
      tournamentUrl: body.tournamentUrl.trim(),
      matchIds: body.matchIds,
      createTeams: body.createTeams,
      importEvents: body.importEvents,
    });

    const error = bulkErrorSummary(result);
    return NextResponse.json(error ? { ...result, error } : result, {
      status: result.imported > 0 ? 201 : 400,
    });
  } catch (e) {
    return apiErrorResponse(e, "Bulk import failed");
  }
}
