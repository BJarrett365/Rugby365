import { NextResponse } from "next/server";
import {
  downloadPrivateAudioSegment,
  resolveReadyAudioSegment,
  type TtsSpeaker,
} from "@/lib/elevenlabs-tts-service";
import { getMatchDetailForPage } from "@/lib/match-detail-service";

/**
 * Same-origin proxy for ready private TTS segments.
 * Never returns storage paths or voice IDs — only audio/mpeg bytes.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatchDetailForPage(id);
  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const cmsFixtureId = data.cmsFixture?.id ?? null;
  if (!cmsFixtureId) {
    return NextResponse.json({ error: "No CMS fixture for this match" }, { status: 404 });
  }

  const url = new URL(req.url);
  const speakerRaw = (url.searchParams.get("speaker") ?? "lead").trim().toLowerCase();
  const speaker: TtsSpeaker = speakerRaw === "analyst" ? "analyst" : "lead";
  const minute = Number(url.searchParams.get("minute") ?? 0);
  const second = Number(url.searchParams.get("second") ?? 0);

  if (!Number.isFinite(minute) || !Number.isFinite(second)) {
    return NextResponse.json({ error: "Invalid minute/second" }, { status: 400 });
  }

  try {
    const resolved = await resolveReadyAudioSegment({
      fixtureId: cmsFixtureId,
      minute,
      second,
      speaker,
    });
    if (!resolved) {
      return NextResponse.json({ error: "No ready audio for this clock" }, { status: 404 });
    }

    const { bytes, contentType } = await downloadPrivateAudioSegment(resolved.storagePath);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=120",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio play failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
