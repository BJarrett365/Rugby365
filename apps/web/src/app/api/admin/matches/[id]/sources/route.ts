import { NextResponse } from "next/server";
import {
  getFixtureSourcesState,
  updateFixtureSources,
} from "@/lib/fixture-admin-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const state = await getFixtureSourcesState(id);
    if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(state);
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match sources");
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    await updateFixtureSources(id, {
      ...(body.primarySource !== undefined
        ? { primarySource: body.primarySource ? String(body.primarySource) : null }
        : {}),
      ...(body.sport365Url !== undefined
        ? { sport365Url: body.sport365Url ? String(body.sport365Url) : null }
        : {}),
      ...(body.planetRugbyUrl !== undefined
        ? { planetRugbyUrl: body.planetRugbyUrl ? String(body.planetRugbyUrl) : null }
        : {}),
      ...(body.externalMatchId !== undefined
        ? { externalMatchId: body.externalMatchId ? String(body.externalMatchId) : null }
        : {}),
    });
    const state = await getFixtureSourcesState(id);
    return NextResponse.json(state);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update match sources";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
