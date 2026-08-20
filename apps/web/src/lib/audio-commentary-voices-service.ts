/**
 * Admin voice library — ElevenLabs list + OpenAI TTS names.
 * Voice IDs are admin-only; never expose on public Match Animation APIs.
 */

import "server-only";
import { OPENAI_VOICE_OPTIONS } from "./audio-voice-settings";
import { resolveElevenLabsApiKey } from "./integration-settings-service";

export type ElevenLabsVoiceSource = "premade" | "cloned" | "professional" | "generated" | "other";

export type AdminElevenLabsVoice = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  labels: {
    accent?: string;
    age?: string;
    gender?: string;
    descriptive?: string;
    use_case?: string;
    language?: string;
    [key: string]: string | undefined;
  };
  previewUrl: string | null;
  source: ElevenLabsVoiceSource;
  groupLabel: "My voices" | "Female" | "Male" | "Unspecified" | "Other";
};

export type AdminOpenAiVoiceOption = {
  id: string;
  name: string;
  source: "openai";
};

export type AdminVoiceLibraryResponse = {
  ok: true;
  elevenlabs: {
    voices: AdminElevenLabsVoice[];
    status: "ok" | "missing_key" | "auth_failed" | "network_error" | "empty";
    source: "elevenlabs" | "empty";
    diagnostics: {
      total: number;
      myVoicesCount: number;
      labelledCount: number;
      unlabelledCount: number;
      unlabelledVoiceNames: string[];
    };
    configureUrl: string;
    message: string | null;
  };
  openai: {
    voices: AdminOpenAiVoiceOption[];
  };
  /** Soft accent hints by competition scope for UI default filter. */
  regionalAccentHints: Record<string, string[]>;
};

type ApiVoice = {
  voice_id?: string;
  name?: string;
  description?: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  is_default?: boolean;
};

function isMyVoice(category: string | null | undefined): boolean {
  const c = String(category ?? "").toLowerCase();
  return (
    c === "cloned" ||
    c === "generated" ||
    c === "professional" ||
    c === "fine_tuned" ||
    c === "custom" ||
    c === "instant"
  );
}

function normalizeSource(category: string | null | undefined): ElevenLabsVoiceSource {
  const c = String(category ?? "").toLowerCase();
  if (c === "cloned") return "cloned";
  if (c === "professional") return "professional";
  if (c === "generated" || c === "instant" || c === "fine_tuned") return "generated";
  if (c === "premade" || !c) return "premade";
  return "other";
}

function groupLabelForVoice(v: ApiVoice): AdminElevenLabsVoice["groupLabel"] {
  if (isMyVoice(v.category)) return "My voices";
  const gender = String(v.labels?.gender ?? "").toLowerCase().trim();
  if (gender === "female") return "Female";
  if (gender === "male") return "Male";
  if (v.category === "premade" || v.is_default) return "Unspecified";
  return "Other";
}

function normalizeVoice(v: ApiVoice): AdminElevenLabsVoice | null {
  const id = String(v.voice_id ?? "").trim();
  const name = String(v.name ?? "").trim();
  if (!id || !name) return null;
  const labels: AdminElevenLabsVoice["labels"] = {};
  for (const [key, value] of Object.entries(v.labels ?? {})) {
    if (typeof value === "string" && value.trim()) {
      labels[key] = value.trim();
    }
  }
  return {
    id,
    name,
    category: v.category?.trim() || null,
    description: v.description?.trim() || null,
    labels,
    previewUrl: typeof v.preview_url === "string" && v.preview_url.trim() ? v.preview_url.trim() : null,
    source: normalizeSource(v.category),
    groupLabel: groupLabelForVoice(v),
  };
}

async function fetchVoiceEndpoint(url: string, key: string): Promise<ApiVoice[]> {
  const res = await fetch(url, {
    headers: { "xi-api-key": key },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: unknown; message?: unknown };
      const raw = body.detail ?? body.message;
      if (typeof raw === "string") detail = raw.slice(0, 160);
      else if (raw != null) detail = JSON.stringify(raw).slice(0, 160);
    } catch {
      /* ignore body parse failures */
    }
    const err = new Error(
      detail
        ? `ElevenLabs voices failed (${res.status}): ${detail}`
        : `ElevenLabs voices failed (${res.status})`,
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as { voices?: ApiVoice[]; results?: ApiVoice[] };
  if (Array.isArray(data.voices)) return data.voices;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

async function fetchAvailableVoices(key: string): Promise<ApiVoice[]> {
  const endpoints = [
    "https://api.elevenlabs.io/v1/voices?show_legacy=true",
    "https://api.elevenlabs.io/v2/voices/search?page_size=100&sort=name&sort_direction=asc",
  ];
  const seen = new Set<string>();
  const voices: ApiVoice[] = [];
  const errors: string[] = [];

  for (const endpoint of endpoints) {
    try {
      const batch = await fetchVoiceEndpoint(endpoint, key);
      for (const voice of batch) {
        const id = String(voice.voice_id ?? "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        voices.push(voice);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(message);
      // Continue — one endpoint may work when the other fails.
    }
  }

  if (!voices.length) {
    const err = new Error(
      errors.length
        ? errors.join(" | ")
        : "ElevenLabs returned no voices",
    ) as Error & { status?: number };
    const authHit = errors.find((m) => /\((401|403)\)/.test(m));
    if (authHit) {
      const match = authHit.match(/\((401|403)\)/);
      err.status = match ? Number(match[1]) : 401;
    }
    throw err;
  }
  return voices;
}

export const REGIONAL_ACCENT_HINTS: Record<string, string[]> = {
  currie_cup: ["south african", "british", "african"],
  premiership: ["british", "english", "uk"],
  mlr: ["american", "us"],
  npc: ["new zealand", "australian", "kiwi"],
  top14: ["french", "british"],
  urc: ["british", "irish", "south african", "welsh"],
  nations_championship: ["british", "american", "australian", "new zealand", "south african"],
  six_nations: ["british", "irish", "english"],
  super_rugby: ["new zealand", "australian", "kiwi"],
  champions_cup: ["british", "irish", "french", "south african"],
  global: ["british", "american", "neutral"],
};

export async function getAdminVoiceLibrary(): Promise<AdminVoiceLibraryResponse> {
  const openaiVoices: AdminOpenAiVoiceOption[] = [
    ...OPENAI_VOICE_OPTIONS,
    // ballad may exist on newer OpenAI TTS — include if not already in constants
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .concat(
      (["ballad"] as const).filter(
        (v) => !(OPENAI_VOICE_OPTIONS as readonly string[]).includes(v),
      ),
    )
    .map((id) => ({ id, name: id, source: "openai" as const }));

  const configureUrl = "/admin/keys#elevenlabs";
  const apiKey = await resolveElevenLabsApiKey();

  if (!apiKey) {
    return {
      ok: true,
      elevenlabs: {
        voices: [],
        status: "missing_key",
        source: "empty",
        diagnostics: {
          total: 0,
          myVoicesCount: 0,
          labelledCount: 0,
          unlabelledCount: 0,
          unlabelledVoiceNames: [],
        },
        configureUrl,
        message: `Configure ElevenLabs at ${configureUrl}`,
      },
      openai: { voices: openaiVoices },
      regionalAccentHints: REGIONAL_ACCENT_HINTS,
    };
  }

  try {
    const raw = await fetchAvailableVoices(apiKey);
    const voices = raw
      .map(normalizeVoice)
      .filter((v): v is AdminElevenLabsVoice => Boolean(v))
      .sort((a, b) => {
        const ma = a.groupLabel === "My voices";
        const mb = b.groupLabel === "My voices";
        if (ma !== mb) return ma ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const labelled = voices.filter((v) => Object.keys(v.labels).length > 0);
    const unlabelled = voices.filter((v) => Object.keys(v.labels).length === 0);
    const mine = voices.filter((v) => v.groupLabel === "My voices");

    return {
      ok: true,
      elevenlabs: {
        voices,
        status: voices.length ? "ok" : "empty",
        source: voices.length ? "elevenlabs" : "empty",
        diagnostics: {
          total: voices.length,
          myVoicesCount: mine.length,
          labelledCount: labelled.length,
          unlabelledCount: unlabelled.length,
          unlabelledVoiceNames: unlabelled.map((v) => v.name).slice(0, 50),
        },
        configureUrl,
        message: voices.length
          ? null
          : "ElevenLabs key is set but no voices were returned.",
      },
      openai: { voices: openaiVoices },
      regionalAccentHints: REGIONAL_ACCENT_HINTS,
    };
  } catch (e) {
    const statusCode =
      e && typeof e === "object" && "status" in e
        ? Number((e as { status?: number }).status)
        : 0;
    const detail = e instanceof Error ? e.message : String(e);
    const authLike =
      statusCode === 401 ||
      statusCode === 403 ||
      /invalid_api_key|authentication_error|unauthorized|api key id used/i.test(detail);
    const status = authLike ? "auth_failed" : "network_error";
    return {
      ok: true,
      elevenlabs: {
        voices: [],
        status,
        source: "empty",
        diagnostics: {
          total: 0,
          myVoicesCount: 0,
          labelledCount: 0,
          unlabelledCount: 0,
          unlabelledVoiceNames: [],
        },
        configureUrl,
        message:
          status === "auth_failed"
            ? "ElevenLabs rejected the saved key (it must be a secret key starting with sk_, not a key ID). Re-save a valid key at /admin/keys#elevenlabs."
            : `Could not reach ElevenLabs (${detail}). Check network access and try again.`,
      },
      openai: { voices: openaiVoices },
      regionalAccentHints: REGIONAL_ACCENT_HINTS,
    };
  }
}
