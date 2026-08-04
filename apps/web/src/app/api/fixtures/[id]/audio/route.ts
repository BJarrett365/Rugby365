import { NextResponse } from "next/server";
import { getMatchDetailForPage } from "@/lib/match-detail-service";
import { buildMatchAnimationPublicAudio } from "@/lib/match-animation-public-audio-server";
import { EMPTY_MATCH_ANIMATION_AUDIO } from "@/lib/match-animation-public-audio";
import { getPublicMatchAudioVoiceLabels } from "@/lib/audio-voice-settings-service";

/**
 * Public Live Audio Commentary captions for a fixture (SDMS match id or CMS-backed page id).
 * Returns status + Lead/Analyst text only — never storage paths, voice IDs, or media URLs.
 * When TTS segments are ready, status is `streaming` and captions may include leadAudio/analystAudio flags.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatchDetailForPage(id);
  if (!data) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const cmsFixtureId = data.cmsFixture?.id ?? null;
  const audio = cmsFixtureId
    ? await buildMatchAnimationPublicAudio(cmsFixtureId)
    : EMPTY_MATCH_ANIMATION_AUDIO;

  let voices: Awaited<ReturnType<typeof getPublicMatchAudioVoiceLabels>> | null = null;
  if (cmsFixtureId) {
    try {
      voices = await getPublicMatchAudioVoiceLabels(cmsFixtureId);
    } catch {
      voices = null;
    }
  }

  return NextResponse.json(
    {
      matchId: data.detail.match_id,
      cmsFixtureId,
      status: audio.status,
      scriptCount: audio.scriptCount,
      readySegmentCount: audio.readySegmentCount ?? 0,
      captions: audio.captions,
      enabled: audio.enabled,
      /** Display names only — never ElevenLabs / OpenAI voice IDs. */
      voices: voices
        ? {
            presenterCount: voices.presenterCount,
            defaultsLabel: voices.defaultsLabel,
            source: voices.source,
            presenters: voices.presenters,
          }
        : null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
