/**
 * Pure helpers for match commentary playback (broadcast proxy + preview voices).
 * Kept free of React so Vitest can cover queue / mode selection.
 */

import {
  matchAudioPlayUrl,
  type MatchAnimationAudioCaption,
} from "./match-animation-public-audio";

export type CommentarySpeechMode = "broadcast" | "preview";
export type CommentarySpeechSpeaker = "lead" | "analyst";
export type CommentarySpeechPhase = "idle" | "playing" | "paused";

export type BroadcastPlayItem = {
  speaker: CommentarySpeechSpeaker;
  url: string;
};

export type PreviewUtteranceItem = {
  speaker: CommentarySpeechSpeaker;
  text: string;
};

export function captionSpeechKey(caption: MatchAnimationAudioCaption): string {
  return [
    caption.minute,
    caption.second,
    caption.lead.slice(0, 48),
    caption.analyst.slice(0, 48),
    caption.leadAudio ? "L" : "-",
    caption.analystAudio ? "A" : "-",
  ].join(":");
}

/** Prefer real TTS segments when either speaker has ready audio. */
export function resolveCaptionSpeechMode(
  caption: MatchAnimationAudioCaption | null,
): CommentarySpeechMode | null {
  if (!caption) return null;
  if (caption.leadAudio || caption.analystAudio) return "broadcast";
  if (caption.lead.trim() || caption.analyst.trim()) return "preview";
  return null;
}

export function buildBroadcastPlayQueue(
  matchId: string,
  caption: MatchAnimationAudioCaption,
): BroadcastPlayItem[] {
  const items: BroadcastPlayItem[] = [];
  if (caption.leadAudio && caption.lead.trim()) {
    items.push({
      speaker: "lead",
      url: matchAudioPlayUrl(matchId, {
        minute: caption.minute,
        second: caption.second,
        speaker: "lead",
      }),
    });
  }
  if (caption.analystAudio && caption.analyst.trim()) {
    items.push({
      speaker: "analyst",
      url: matchAudioPlayUrl(matchId, {
        minute: caption.minute,
        second: caption.second,
        speaker: "analyst",
      }),
    });
  }
  return items;
}

export function buildPreviewUtteranceQueue(
  caption: MatchAnimationAudioCaption,
): PreviewUtteranceItem[] {
  const items: PreviewUtteranceItem[] = [];
  if (caption.lead.trim()) {
    items.push({ speaker: "lead", text: caption.lead.trim() });
  }
  if (caption.analyst.trim()) {
    items.push({ speaker: "analyst", text: caption.analyst.trim() });
  }
  return items;
}

/** Honest status copy for the Play control surface. */
export function commentaryPlaybackStatusLabel(input: {
  phase: CommentarySpeechPhase;
  mode: CommentarySpeechMode | null;
  speaker: CommentarySpeechSpeaker | null;
  /** Continuous feed playback (auto-advances captions). */
  streaming?: boolean;
}): string {
  if (input.phase === "idle" || !input.mode) {
    return input.streaming ? "On air" : "Ready";
  }
  const voice =
    input.mode === "broadcast" ? "broadcast audio" : "preview voice";
  if (input.phase === "paused") {
    return input.streaming ? `Stream paused (${voice})` : `Paused (${voice})`;
  }
  const who =
    input.speaker === "lead"
      ? "Lead"
      : input.speaker === "analyst"
        ? "Analyst"
        : "Commentary";
  if (input.streaming) return `On air · ${who} (${voice})`;
  return `Playing ${who} (${voice})`;
}

/** Short natural gap between Lead→Analyst and between consecutive captions. */
export const COMMENTARY_CAPTION_GAP_MS = 450;

export function nextCaptionAfter(
  captions: MatchAnimationAudioCaption[],
  current: MatchAnimationAudioCaption | null,
): MatchAnimationAudioCaption | null {
  if (!captions.length) return null;
  if (!current) return captions[0] ?? null;
  const idx = captions.findIndex(
    (c) =>
      c.minute === current.minute &&
      c.second === current.second &&
      c.lead === current.lead &&
      c.analyst === current.analyst,
  );
  if (idx < 0) return captions[0] ?? null;
  return captions[idx + 1] ?? null;
}

/**
 * Pick two distinct browser voices when possible (Lead deeper/slower, Analyst lighter/faster).
 */
export function pickPreviewSpeechVoices(voices: SpeechSynthesisVoice[]): {
  lead: SpeechSynthesisVoice | null;
  analyst: SpeechSynthesisVoice | null;
} {
  const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  if (!pool.length) return { lead: null, analyst: null };

  const score = (v: SpeechSynthesisVoice, role: "lead" | "analyst") => {
    const hay = `${v.name} ${v.lang}`.toLowerCase();
    let n = 0;
    if (/en-za|en_za|south africa|afrikaans/.test(hay)) n += 6;
    if (/en-gb|en_gb|british|uk/.test(hay)) n += 4;
    if (/en-us|en_us|american/.test(hay)) n += 2;
    if (role === "lead" && /male|daniel|david|james|george|arthur|rishi|thomas/.test(hay)) n += 5;
    if (role === "analyst" && /female|samantha|karen|moira|fiona|victoria|zira|susan/.test(hay)) {
      n += 5;
    }
    if (role === "lead" && /female/.test(hay)) n -= 2;
    if (role === "analyst" && /male/.test(hay)) n -= 1;
    return n;
  };

  const lead = [...pool].sort((a, b) => score(b, "lead") - score(a, "lead"))[0] ?? null;
  const analyst =
    [...pool]
      .filter((v) => !lead || v.voiceURI !== lead.voiceURI)
      .sort((a, b) => score(b, "analyst") - score(a, "analyst"))[0] ?? lead;

  return { lead, analyst };
}

export const COMMENTARY_SPEAKER_PAUSE_MS = 380;

/** First caption at or after a match clock (for Play-from-scrub). */
export function captionAtOrAfterClock(
  captions: MatchAnimationAudioCaption[],
  minute: number,
  second: number,
): MatchAnimationAudioCaption | null {
  if (!captions.length) return null;
  const now = Math.max(0, minute) * 60 + Math.max(0, Math.min(59, second));
  for (const caption of captions) {
    const t = caption.minute * 60 + caption.second;
    if (t >= now) return caption;
  }
  return captions[captions.length - 1] ?? null;
}
