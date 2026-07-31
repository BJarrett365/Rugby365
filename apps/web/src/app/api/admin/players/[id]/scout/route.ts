import { NextResponse } from "next/server";
import {
  createScoutNote,
  getAdminPlayerScoutProfile,
  recalculatePlayerScoutProfile,
  updatePlayerScoutOverrides,
} from "@/lib/player-scout-intelligence-service";
import type { ScoutRecommendation } from "@/lib/player-scout-intelligence-math";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  try {
    let profile = await getAdminPlayerScoutProfile(id, {
      includeUnpublished: true,
      calculateIfMissing: false,
    });
    if (!profile) {
      profile = await recalculatePlayerScoutProfile(id);
    }
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load scout profile" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: "recalculate" | "note";
      notes?: string;
      observedOn?: string | null;
      venue?: string | null;
      matchContext?: string | null;
      confidence?: string;
      recommendation?: string | null;
      createdBy?: string | null;
    };

    if (body.action === "note") {
      if (!body.notes?.trim()) {
        return NextResponse.json({ error: "notes required" }, { status: 400 });
      }
      const note = await createScoutNote({
        playerId: id,
        notes: body.notes.trim(),
        observedOn: body.observedOn,
        venue: body.venue,
        matchContext: body.matchContext,
        confidence: body.confidence,
        recommendation: body.recommendation,
        createdBy: body.createdBy,
      });
      const profile = await getAdminPlayerScoutProfile(id, { includeUnpublished: true });
      return NextResponse.json({ note, profile });
    }

    const profile = await recalculatePlayerScoutProfile(id);
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update scout profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      overrides?: Record<string, unknown>;
      cmsNotes?: string | null;
      published?: boolean;
      aiSummary?: string | null;
      recommendation?: ScoutRecommendation | null;
      rriScore?: number | null;
    };

    const overrides = { ...(body.overrides ?? {}) };
    if (body.rriScore !== undefined) overrides.rriScore = body.rriScore;
    if (body.aiSummary !== undefined) overrides.aiSummary = body.aiSummary;
    if (body.recommendation !== undefined) overrides.recommendation = body.recommendation;

    const profile = await updatePlayerScoutOverrides(id, {
      overrides,
      cmsNotes: body.cmsNotes,
      published: body.published,
      aiSummary: body.aiSummary,
      recommendation: body.recommendation,
    });
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save scout overrides" },
      { status: 500 },
    );
  }
}
