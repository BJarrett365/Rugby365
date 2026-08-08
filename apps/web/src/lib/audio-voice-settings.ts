/**
 * Pure Live Audio Commentary voice helpers (no DB / server-only).
 * Shared by admin UI logic and TTS resolution.
 * Creator Profile display: `Name · Accent/Org · Competition` (Plexa-style).
 */

export type AudioSpeakerRole = "lead" | "analyst" | "sideline" | "guest";
export type AudioTtsProvider = "auto" | "elevenlabs" | "openai";
export type AudioPresenterCount = 1 | 2 | 3 | 4;

export const AUDIO_SPEAKER_ROLES: AudioSpeakerRole[] = [
  "lead",
  "analyst",
  "sideline",
  "guest",
];

export const AUDIO_SPEAKER_ROLE_LABELS: Record<AudioSpeakerRole, string> = {
  lead: "Lead",
  analyst: "Analyst",
  sideline: "Sideline",
  guest: "Guest",
};

export const AUDIO_SPEAKER_ROLE_HINTS: Record<AudioSpeakerRole, string> = {
  lead: "Lead / play-by-play",
  analyst: "Studio analyst",
  sideline: "Touchline / colour",
  guest: "Guest / fourth voice",
};

/** Roles active for a given presenter count (1–4). */
export function rolesForPresenterCount(count: number): AudioSpeakerRole[] {
  const n = clampPresenterCount(count);
  return AUDIO_SPEAKER_ROLES.slice(0, n);
}

export function clampPresenterCount(value: number | null | undefined): AudioPresenterCount {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 2;
  if (n <= 1) return 1;
  if (n === 3) return 3;
  if (n >= 4) return 4;
  return 2;
}

export function normalizeTtsProvider(value: string | null | undefined): AudioTtsProvider {
  const key = (value ?? "auto").trim().toLowerCase();
  if (key === "elevenlabs" || key === "openai" || key === "auto") return key;
  return "auto";
}

export type MatchVoiceOverrideSlot = {
  provider?: AudioTtsProvider | null;
  elevenlabsVoiceId?: string | null;
  openaiVoice?: string | null;
};

export type MatchVoiceOverridesMap = Partial<
  Record<AudioSpeakerRole, MatchVoiceOverrideSlot>
>;

export function parseVoiceOverrides(raw: unknown): MatchVoiceOverridesMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MatchVoiceOverridesMap = {};
  for (const role of AUDIO_SPEAKER_ROLES) {
    const slot = (raw as Record<string, unknown>)[role];
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
    const s = slot as Record<string, unknown>;
    out[role] = {
      provider:
        typeof s.provider === "string" ? normalizeTtsProvider(s.provider) : undefined,
      elevenlabsVoiceId:
        s.elevenlabsVoiceId === null
          ? null
          : typeof s.elevenlabsVoiceId === "string"
            ? s.elevenlabsVoiceId.trim() || null
            : undefined,
      openaiVoice:
        s.openaiVoice === null
          ? null
          : typeof s.openaiVoice === "string"
            ? s.openaiVoice.trim() || null
            : undefined,
    };
  }
  return out;
}

export const AUDIO_TONE_PRESETS = [
  "energetic",
  "calm",
  "analytical",
  "broadcast",
  "neutral",
] as const;
export type AudioTonePreset = (typeof AUDIO_TONE_PRESETS)[number];

/** Plexa Voice Style options mapped to commentary personalities. */
export const AUDIO_VOICE_STYLES = [
  "journalist",
  "television",
  "analyst",
  "former_player",
  "storyteller",
] as const;
export type AudioVoiceStyle = (typeof AUDIO_VOICE_STYLES)[number];

export const AUDIO_VOICE_STYLE_LABELS: Record<AudioVoiceStyle, string> = {
  journalist: "Journalist",
  television: "Television",
  analyst: "Analyst",
  former_player: "Former player",
  storyteller: "Storyteller",
};

export const AUDIO_DELIVERY_STYLES = ["balanced", "energetic", "calm"] as const;
export type AudioDeliveryStyle = (typeof AUDIO_DELIVERY_STYLES)[number];

export const AUDIO_DELIVERY_STYLE_LABELS: Record<AudioDeliveryStyle, string> = {
  balanced: "Balanced",
  energetic: "Energetic",
  calm: "Calm",
};

export const OPENAI_VOICE_OPTIONS = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
] as const;

/** Known competition scopes for Creator Profile / division defaults. */
export const AUDIO_COMPETITION_SCOPES = [
  { scope: "currie_cup", label: "Currie Cup (SA)", accentHint: "South African English" },
  { scope: "premiership", label: "Premiership (England)", accentHint: "Southern English" },
  { scope: "mlr", label: "Major League Rugby (US)", accentHint: "American English" },
  { scope: "npc", label: "NPC (New Zealand)", accentHint: "New Zealand English" },
  { scope: "top14", label: "Top 14 (France)", accentHint: "French-accented English" },
  { scope: "urc", label: "United Rugby Championship", accentHint: "Neutral / mixed" },
  {
    scope: "nations_championship",
    label: "Nations Championship",
    accentHint: "International English",
  },
  { scope: "six_nations", label: "Six Nations", accentHint: "British / Irish English" },
  { scope: "super_rugby", label: "Super Rugby", accentHint: "New Zealand / Australian English" },
  { scope: "champions_cup", label: "Investec Champions Cup", accentHint: "Neutral / mixed" },
  { scope: "global", label: "Default broadcast (Global)", accentHint: "Neutral" },
] as const;

export type AudioCompetitionScope = (typeof AUDIO_COMPETITION_SCOPES)[number]["scope"];

/** Soft accent filter tokens for ElevenLabs voice list by competition scope. */
export function preferredAccentFiltersForScope(scope?: string | null): string[] {
  switch (scope) {
    case "currie_cup":
      return ["South African", "British"];
    case "premiership":
    case "six_nations":
      return ["British", "Irish"];
    case "mlr":
      return ["American"];
    case "npc":
    case "super_rugby":
      return ["New Zealand", "Australian"];
    case "top14":
      return ["British", "French"];
    case "urc":
    case "champions_cup":
      return ["British", "Irish", "South African"];
    case "nations_championship":
      return ["British", "American", "Australian", "New Zealand", "South African"];
    default:
      return [];
  }
}

/** Human accent label from stored accent key. */
export function accentDisplayLabel(accent?: string | null): string {
  const key = (accent ?? "").trim().toLowerCase();
  switch (key) {
    case "south_african_english":
      return "South African English";
    case "southern_english":
      return "Southern English";
    case "british_english":
      return "British English";
    case "american_english":
      return "American English";
    case "new_zealand_english":
      return "New Zealand English";
    case "french_english":
      return "French-accented English";
    case "international_english":
      return "International English";
    case "neutral":
      return "Neutral";
    default:
      return accent?.trim() || "Neutral";
  }
}

/**
 * Plexa-style Creator Profile dropdown label:
 * `Display name · Accent/Org · Competition focus`
 */
export function formatCreatorProfileLabel(input: {
  displayName: string;
  organisationLabel?: string | null;
  topicLabel?: string | null;
  accent?: string | null;
  competitionScope?: string | null;
}): string {
  const mid =
    input.organisationLabel?.trim() ||
    accentDisplayLabel(input.accent) ||
    "Neutral";
  const topic =
    input.topicLabel?.trim() ||
    scopeTopicLabel(input.competitionScope) ||
    "Global";
  return `${input.displayName.trim()} · ${mid} · ${topic}`;
}

export function scopeTopicLabel(scope?: string | null): string {
  switch (scope) {
    case "currie_cup":
      return "Currie Cup";
    case "premiership":
      return "Premiership";
    case "mlr":
      return "Major League Rugby";
    case "npc":
      return "NPC";
    case "top14":
      return "Top 14";
    case "urc":
      return "URC";
    case "nations_championship":
      return "Nations Championship";
    case "six_nations":
      return "Six Nations";
    case "super_rugby":
      return "Super Rugby";
    case "champions_cup":
      return "Champions Cup";
    case "global":
      return "Global";
    default:
      return scope?.replace(/_/g, " ") || "Global";
  }
}

/** Map competition slug/name → audio scope key used by defaults + profiles. */
export function competitionScopeFromSlugOrName(
  slug?: string | null,
  name?: string | null,
): string {
  const hay = `${slug ?? ""} ${name ?? ""}`.toLowerCase();

  if (hay.includes("currie")) return "currie_cup";
  if (
    hay.includes("premiership") ||
    hay.includes("gallagher") ||
    /\bprem\b/.test(hay) ||
    hay.includes("english premiership")
  ) {
    return "premiership";
  }
  if (
    hay.includes("major league rugby") ||
    /\bmlr\b/.test(hay) ||
    hay.includes("major-league-rugby")
  ) {
    return "mlr";
  }
  if (
    hay.includes("npc") ||
    hay.includes("national provincial") ||
    hay.includes("bunnings")
  ) {
    return "npc";
  }
  if (hay.includes("top 14") || hay.includes("top14") || hay.includes("top-14")) {
    return "top14";
  }
  if (
    hay.includes("united rugby") ||
    /\burc\b/.test(hay) ||
    hay.includes("united-rugby")
  ) {
    return "urc";
  }
  // World Rugby Nations Championship (12-team) — before Six Nations.
  if (
    (hay.includes("nations championship") || hay.includes("nations-championship")) &&
    !hay.includes("six")
  ) {
    return "nations_championship";
  }
  if (hay.includes("six nations") || hay.includes("six-nations")) {
    return "six_nations";
  }
  if (hay.includes("super rugby") || hay.includes("super-rugby")) {
    return "super_rugby";
  }
  if (
    hay.includes("champions cup") ||
    hay.includes("champions-cup") ||
    hay.includes("investec champions")
  ) {
    return "champions_cup";
  }

  return "global";
}

export function clampSpeechSpeed(speed: number | null | undefined, fallback = 1): number {
  const n = typeof speed === "number" && Number.isFinite(speed) ? speed : fallback;
  return Math.min(1.5, Math.max(0.75, Math.round(n * 100) / 100));
}

export function normalizeVoiceStyle(value: string | null | undefined): AudioVoiceStyle {
  const key = (value ?? "journalist").trim().toLowerCase().replace(/\s+/g, "_");
  if ((AUDIO_VOICE_STYLES as readonly string[]).includes(key)) {
    return key as AudioVoiceStyle;
  }
  if (key.includes("television") || key.includes("tv") || key.includes("broadcast")) {
    return "television";
  }
  if (key.includes("former")) return "former_player";
  if (key.includes("story")) return "storyteller";
  if (key.includes("analyst")) return "analyst";
  return "journalist";
}

export function normalizeDeliveryStyle(value: string | null | undefined): AudioDeliveryStyle {
  const key = (value ?? "balanced").trim().toLowerCase();
  if ((AUDIO_DELIVERY_STYLES as readonly string[]).includes(key)) {
    return key as AudioDeliveryStyle;
  }
  if (key.includes("energy") || key.includes("fast")) return "energetic";
  if (key.includes("smooth") || key.includes("calm") || key.includes("studio")) return "calm";
  return "balanced";
}

function accentInstruction(accent?: string | null, accentLabel?: string | null): string {
  const label = accentLabel?.trim() || accentDisplayLabel(accent);
  if (!label || label === "Neutral") {
    return "Use clear neutral broadcast English. ";
  }
  return `Speak in clear ${label}. `;
}

function voiceStyleInstruction(style: AudioVoiceStyle): string {
  switch (style) {
    case "television":
      return "Deliver as a television match commentator. ";
    case "analyst":
      return "Deliver as a tactical studio analyst. ";
    case "former_player":
      return "Deliver as a former player turned pundit — plain spoken, insightful. ";
    case "storyteller":
      return "Deliver with narrative colour without inventing facts. ";
    case "journalist":
    default:
      return "Deliver in a clear journalist broadcast style. ";
  }
}

function deliveryInstruction(delivery: AudioDeliveryStyle): string {
  switch (delivery) {
    case "energetic":
      return "Keep delivery energetic and forward. ";
    case "calm":
      return "Keep delivery calm and measured. ";
    case "balanced":
    default:
      return "Keep delivery balanced and natural. ";
  }
}

/** Tone → ElevenLabs style + stability hints and optional TTS instruction prefix. */
export function tonePresetSettings(
  tone: string | null | undefined,
  options?: {
    accent?: string | null;
    accentLabel?: string | null;
    voiceStyle?: string | null;
    deliveryStyle?: string | null;
    aiPrompt?: string | null;
    role?: AudioSpeakerRole | null;
  },
): {
  tone: string;
  style: number;
  stability: number;
  instructionPrefix: string;
} {
  const key = (tone ?? "broadcast").trim().toLowerCase() || "broadcast";
  const voiceStyle = normalizeVoiceStyle(options?.voiceStyle);
  const delivery = normalizeDeliveryStyle(options?.deliveryStyle);
  const customPrompt = options?.aiPrompt?.trim();
  const role = options?.role;

  const accentBit = accentInstruction(options?.accent, options?.accentLabel);
  const styleBit = voiceStyleInstruction(voiceStyle);
  const deliveryBit = deliveryInstruction(delivery);
  const roleBit =
    role === "sideline"
      ? "You are the touchline / colour commentator. "
      : role === "guest"
        ? "You are a guest studio voice — concise colour only. "
        : "";
  const basePrefix = customPrompt
    ? `${customPrompt.slice(0, 400).trim()} `
    : `${accentBit}${styleBit}${deliveryBit}${roleBit}`;

  switch (key) {
    case "energetic":
    case "urgent":
      return {
        tone: key === "urgent" ? "energetic" : key,
        style: 0.55,
        stability: 0.35,
        instructionPrefix: `${basePrefix}Speak as an energetic rugby lead commentator. `,
      };
    case "calm":
      return {
        tone: key,
        style: 0.15,
        stability: 0.62,
        instructionPrefix: `${basePrefix}Speak calmly and clearly as a measured rugby commentator. `,
      };
    case "analytical":
      return {
        tone: key,
        style: 0.22,
        stability: 0.55,
        instructionPrefix: `${basePrefix}Speak as a tactical rugby analyst — clear, insightful, never invented emotion. `,
      };
    case "neutral":
      return {
        tone: key,
        style: 0.3,
        stability: 0.5,
        instructionPrefix: `${basePrefix}Speak in a neutral, factual rugby broadcast tone. `,
      };
    case "broadcast":
      return {
        tone: key,
        style: 0.35,
        stability: 0.45,
        instructionPrefix: `${basePrefix}Speak as a professional rugby broadcast commentator. `,
      };
    default:
      return {
        tone: key.slice(0, 64),
        style: 0.35,
        stability: 0.45,
        instructionPrefix: `${basePrefix}Speak with a ${key.slice(0, 40)} tone as a rugby commentator. `,
      };
  }
}
