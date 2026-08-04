import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { generatePrivateAudioForScript, type TtsSpeaker } from "@/lib/elevenlabs-tts-service";

/**
 * Admin-only: generate private ElevenLabs audio for one script.
 * Response omits storage paths and voice IDs from the client-facing body where possible;
 * storagePath is returned for ops verification only (never wire this to public Match Animation).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; scriptId: string }> },
) {
  try {
    const { scriptId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      speakers?: TtsSpeaker[];
    };
    const speakers = body.speakers?.length ? body.speakers : (["lead"] as TtsSpeaker[]);
    const result = await generatePrivateAudioForScript(scriptId, { speakers });

    return NextResponse.json({
      ok: true,
      // Admin ops only — do not forward storagePath to any public payload.
      results: result.results.map((r) => ({
        segmentId: r.segmentId,
        speaker: r.speaker,
        status: r.status,
        jobId: r.jobId,
        storagePath: r.storagePath,
      })),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to generate audio TTS");
  }
}
