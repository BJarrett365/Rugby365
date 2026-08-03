import "server-only";

import { listAudioCommentaryScripts } from "./audio-commentary-script-service";
import {
  countReadyAudioSegments,
  listReadyAudioSpeakerFlags,
} from "./elevenlabs-tts-service";
import {
  EMPTY_MATCH_ANIMATION_AUDIO,
  buildPublicMatchAudioFromScripts,
  type MatchAnimationPublicAudio,
} from "./match-animation-public-audio";

export async function buildMatchAnimationPublicAudio(
  cmsFixtureId: string | null,
): Promise<MatchAnimationPublicAudio> {
  if (!cmsFixtureId) return EMPTY_MATCH_ANIMATION_AUDIO;

  try {
    const [scripts, readySegmentCount, speakerFlags] = await Promise.all([
      listAudioCommentaryScripts(cmsFixtureId),
      countReadyAudioSegments(cmsFixtureId),
      listReadyAudioSpeakerFlags(cmsFixtureId),
    ]);

    return buildPublicMatchAudioFromScripts(
      scripts.map((row) => {
        const flags = speakerFlags.get(row.id);
        return {
          ...row,
          leadAudio: Boolean(flags?.lead),
          analystAudio: Boolean(flags?.analyst),
        };
      }),
      { readySegmentCount },
    );
  } catch {
    return EMPTY_MATCH_ANIMATION_AUDIO;
  }
}
