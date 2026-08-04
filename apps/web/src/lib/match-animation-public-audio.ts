/**
 * Public-safe Live Audio types + client helpers for Match Animation + match centre.
 * Text/captions only — never storage paths, voice IDs, or media URLs.
 */

export type MatchAnimationAudioStatus = "stings_only" | "scripts_ready" | "streaming";

export type MatchAnimationAudioCaption = {
  minute: number;
  second: number;
  lead: string;
  analyst: string;
  sideline?: string;
  guest?: string;
  presenterCount?: number;
  /**
   * Optional written Intelligence Engine line for this clock (public text only).
   * Shown beside Lead/Analyst during Normal time — never storage or voice fields.
   */
  written?: string;
  /** True when a private Lead TTS segment is ready (play via same-origin proxy). */
  leadAudio?: boolean;
  /** True when a private Analyst TTS segment is ready (play via same-origin proxy). */
  analystAudio?: boolean;
  sidelineAudio?: boolean;
  guestAudio?: boolean;
};

export type MatchAnimationPublicAudio = {
  /** Stings / future listen always available as a control surface. */
  enabled: boolean;
  status: MatchAnimationAudioStatus;
  scriptCount: number;
  /** Ready private TTS segments for this fixture (Lead + Analyst counted separately). */
  readySegmentCount?: number;
  /** Clock-ordered Lead/Analyst caption timeline (public text only). */
  captions: MatchAnimationAudioCaption[];
};

export const EMPTY_MATCH_ANIMATION_AUDIO: MatchAnimationPublicAudio = {
  enabled: true,
  status: "stings_only",
  scriptCount: 0,
  readySegmentCount: 0,
  captions: [],
};

const MAX_PUBLIC_CAPTIONS = 120;

/** Script-shaped rows that may include private fields — only public fields are emitted. */
export type PublicAudioScriptSource = {
  minute: number;
  second: number;
  leadScript: string;
  analystScript: string;
  sidelineScript?: string;
  guestScript?: string;
  presenterCount?: number;
  /** Ignored if present — never forwarded to clients. */
  id?: string;
  storagePath?: string | null;
  voiceProfileId?: string | null;
  voiceId?: string | null;
  status?: string;
  sourceBody?: string | null;
  facts?: unknown;
  layers?: unknown;
  /** Optional readiness flags derived server-side from segments. */
  leadAudio?: boolean;
  analystAudio?: boolean;
  sidelineAudio?: boolean;
  guestAudio?: boolean;
};

/**
 * Build the public audio payload from script rows.
 * Strips every non-caption field (ids, storage, voices, drafts metadata).
 */
export function buildPublicMatchAudioFromScripts(
  scripts: PublicAudioScriptSource[],
  options?: { maxCaptions?: number; readySegmentCount?: number },
): MatchAnimationPublicAudio {
  if (!scripts.length) return EMPTY_MATCH_ANIMATION_AUDIO;

  const max = options?.maxCaptions ?? MAX_PUBLIC_CAPTIONS;
  const captions: MatchAnimationAudioCaption[] = scripts.slice(0, max).map((row) => {
    const caption: MatchAnimationAudioCaption = {
      minute: Math.max(0, Math.floor(Number(row.minute) || 0)),
      second: Math.max(0, Math.min(59, Math.floor(Number(row.second) || 0))),
      lead: String(row.leadScript ?? "").trim(),
      analyst: String(row.analystScript ?? "").trim(),
    };
    const sideline = String(row.sidelineScript ?? "").trim();
    const guest = String(row.guestScript ?? "").trim();
    if (sideline) caption.sideline = sideline;
    if (guest) caption.guest = guest;
    if (row.presenterCount) caption.presenterCount = row.presenterCount;
    const written = String(row.sourceBody ?? "").trim();
    if (written) caption.written = written;
    if (row.leadAudio) caption.leadAudio = true;
    if (row.analystAudio) caption.analystAudio = true;
    if (row.sidelineAudio) caption.sidelineAudio = true;
    if (row.guestAudio) caption.guestAudio = true;
    return caption;
  });

  const readySegmentCount = Math.max(0, Number(options?.readySegmentCount ?? 0));
  const anyCaptionAudio = captions.some(
    (c) => c.leadAudio || c.analystAudio || c.sidelineAudio || c.guestAudio,
  );
  const status: MatchAnimationAudioStatus =
    readySegmentCount > 0 || anyCaptionAudio ? "streaming" : "scripts_ready";

  return {
    enabled: true,
    status,
    scriptCount: scripts.length,
    readySegmentCount,
    captions,
  };
}

/** Nearest caption at or before the animation / match clock. */
export function captionForAnimationClock(
  captions: MatchAnimationAudioCaption[],
  minute: number,
  second: number,
): MatchAnimationAudioCaption | null {
  if (!captions.length) return null;
  const now = Math.max(0, minute) * 60 + Math.max(0, Math.min(59, second));
  let best: MatchAnimationAudioCaption | null = null;
  for (const caption of captions) {
    const t = caption.minute * 60 + caption.second;
    if (t <= now) best = caption;
    else break;
  }
  return best ?? captions[0] ?? null;
}

export function publicAudioStatusLabel(
  status: MatchAnimationAudioStatus,
  soundOn: boolean,
): string {
  if (!soundOn) return "Off";
  if (status === "streaming") return "Live commentary";
  if (status === "scripts_ready") return "Captions ready";
  return "Stings only";
}

/** Honest product copy — never implies streaming unless status is streaming. */
export function publicAudioProductNote(status: MatchAnimationAudioStatus): string {
  if (status === "streaming") {
    return "Live Audio Commentary — Press Play once to hear Lead + Analyst from the selected minute, then auto-advance through the feed. Stop ends the stream.";
  }
  if (status === "scripts_ready") {
    return "Live Audio Commentary — Play walks through the feed from the selected minute (preview voice until broadcast audio is ready). Stop ends the stream.";
  }
  return "Try and conversion stings play in Match Animation when Listen is on. Dual commentary scripts are not available for this match yet.";
}

/** Same-origin proxy URL for a ready segment — no storage paths. */
export function matchAudioPlayUrl(
  matchId: string,
  input: { minute: number; second: number; speaker: "lead" | "analyst" },
): string {
  const params = new URLSearchParams({
    speaker: input.speaker,
    minute: String(Math.max(0, Math.floor(input.minute))),
    second: String(Math.max(0, Math.min(59, Math.floor(input.second)))),
  });
  return `/api/fixtures/${encodeURIComponent(matchId)}/audio/play?${params.toString()}`;
}
