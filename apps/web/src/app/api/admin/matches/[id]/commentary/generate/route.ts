import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listAudioCommentaryScripts } from "@/lib/audio-commentary-script-service";
import {
  generateAndPublishMatchNarrativeCommentary,
  listMatchNarrativeCommentary,
} from "@/lib/match-narrative-commentary-service";

/** Generate natural-flowing match commentary from venue, teams, coaches, lineups and events. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      replace?: boolean;
      generateAudioScripts?: boolean;
    };
    const result = await generateAndPublishMatchNarrativeCommentary(id, {
      replace: body.replace !== false,
      generateAudioScripts: body.generateAudioScripts !== false,
    });
    const stored = await listMatchNarrativeCommentary(id);
    const audioScripts = await listAudioCommentaryScripts(id);
    return NextResponse.json({
      ok: true,
      created: result.created,
      audioScriptsCreated: result.audioScriptsCreated ?? 0,
      // Newest-first for the feed UI (same order as GET).
      lines: stored,
      storedCount: stored.length,
      audioScripts,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to generate match commentary");
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [lines, audioScripts] = await Promise.all([
      listMatchNarrativeCommentary(id),
      listAudioCommentaryScripts(id),
    ]);
    return NextResponse.json({ lines, audioScripts });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load match commentary");
  }
}
