/**
 * ElevenLabs TTS for Live Audio Commentary.
 * Voice IDs and storage paths stay server-side — never in public Match Animation payloads.
 */

import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import {
  audioCommentaryJobs,
  audioCommentaryScripts,
  audioCommentarySegments,
  audioVoiceProfiles,
} from "@rugby365/db";
import {
  resolveVoiceProfileForFixture,
  tonePresetSettings,
  formatCreatorProfileLabel,
  normalizeDeliveryStyle,
  normalizeVoiceStyle,
  type ResolvedVoiceProfile,
} from "./audio-voice-settings-service";
import { getDb } from "./db";
import {
  resolveElevenLabsApiKey,
  resolveElevenLabsModelId,
  resolveOpenAiApiKey,
} from "./integration-settings-service";
import { OPENAI_TTS_VOICES, synthesizeOpenAiSpeech } from "./openai-tts-service";
import { getSupabaseServerClient } from "./supabase-server";

export const AUDIO_COMMENTARY_BUCKET = "rugby365-audio-private";

export type TtsSpeaker = "lead" | "analyst" | "sideline" | "guest";

async function ensurePrivateAudioBucket(): Promise<void> {
  const supabase = await getSupabaseServerClient("service");
  const listed = await supabase.storage.listBuckets();
  if (listed.error) throw new Error(listed.error.message);
  if ((listed.data ?? []).some((b) => b.name === AUDIO_COMMENTARY_BUCKET)) return;
  const created = await supabase.storage.createBucket(AUDIO_COMMENTARY_BUCKET, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(created.error.message);
  }
}

/** Admin-safe voice profile summary — includes config fields; voice IDs only for admin. */
export async function listDefaultCurrieCupVoiceProfiles() {
  const db = getDb();
  const rows = await db
    .select({
      id: audioVoiceProfiles.id,
      slug: audioVoiceProfiles.slug,
      displayName: audioVoiceProfiles.displayName,
      role: audioVoiceProfiles.role,
      accent: audioVoiceProfiles.accent,
      locale: audioVoiceProfiles.locale,
      provider: audioVoiceProfiles.provider,
      competitionScope: audioVoiceProfiles.competitionScope,
      isDefault: audioVoiceProfiles.isDefault,
      status: audioVoiceProfiles.status,
      speed: audioVoiceProfiles.speed,
      tone: audioVoiceProfiles.tone,
      elevenlabsVoiceId: audioVoiceProfiles.elevenlabsVoiceId,
      openaiVoice: audioVoiceProfiles.openaiVoice,
    })
    .from(audioVoiceProfiles)
    .where(
      and(
        eq(audioVoiceProfiles.competitionScope, "currie_cup"),
        eq(audioVoiceProfiles.status, "active"),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    role: row.role,
    accent: row.accent,
    locale: row.locale,
    provider: row.provider,
    competitionScope: row.competitionScope,
    isDefault: row.isDefault,
    status: row.status,
    speed: row.speed,
    tone: row.tone,
    voiceConfigured: Boolean(
      row.elevenlabsVoiceId?.trim() || row.openaiVoice?.trim(),
    ),
  }));
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function synthesizeElevenLabsSpeech(input: {
  text: string;
  voiceId: string;
  maxRetries?: number;
  stability?: number | null;
  similarityBoost?: number | null;
  style?: number | null;
  /** Approximate speaking rate via voice settings when provider has no native speed. */
  speed?: number | null;
}): Promise<{ audio: Buffer; contentType: string }> {
  const apiKey = await resolveElevenLabsApiKey();
  if (!apiKey) {
    throw new Error("ElevenLabs API key not configured (ELEVENLABS_API_KEY or Admin → Keys).");
  }
  const modelId = await resolveElevenLabsModelId();
  const voiceId = input.voiceId.trim();
  if (!voiceId) throw new Error("Voice profile is missing elevenlabs_voice_id.");

  const toneHint = tonePresetSettings(undefined);
  const stability =
    typeof input.stability === "number" ? input.stability : toneHint.stability;
  const similarity =
    typeof input.similarityBoost === "number" ? input.similarityBoost : 0.75;
  let style = typeof input.style === "number" ? input.style : toneHint.style;
  // Slight style bump for faster delivery when speed > 1 (ElevenLabs has no native speed on all models).
  if (typeof input.speed === "number" && input.speed > 1.05) {
    style = Math.min(1, style + (input.speed - 1) * 0.35);
  }

  const maxRetries = input.maxRetries ?? 4;
  let lastError = "ElevenLabs TTS failed";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: input.text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarity,
            style,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (res.ok) {
      const ab = await res.arrayBuffer();
      return { audio: Buffer.from(ab), contentType: "audio/mpeg" };
    }

    const errText = await res.text();
    lastError = `ElevenLabs TTS failed (${res.status}): ${errText.slice(0, 280)}`;
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const backoffMs = Math.max(retryAfter * 1000, 800 * 2 ** attempt);
      await sleep(backoffMs);
      continue;
    }
    throw new Error(lastError);
  }

  throw new Error(lastError);
}

type ElevenLabsVoiceRow = {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  description?: string;
};

export async function listElevenLabsVoices(): Promise<ElevenLabsVoiceRow[]> {
  const apiKey = await resolveElevenLabsApiKey();
  if (!apiKey) {
    throw new Error("ElevenLabs API key not configured (ELEVENLABS_API_KEY or Admin → Keys).");
  }
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list ElevenLabs voices (${res.status}): ${body.slice(0, 220)}`);
  }
  const data = (await res.json()) as { voices?: ElevenLabsVoiceRow[] };
  return data.voices ?? [];
}

function voiceHaystack(voice: ElevenLabsVoiceRow): string {
  const labels = Object.values(voice.labels ?? {}).join(" ");
  return `${voice.name} ${labels} ${voice.description ?? ""}`.toLowerCase();
}

function scoreSaCommentaryVoice(voice: ElevenLabsVoiceRow, role: TtsSpeaker): number {
  const hay = voiceHaystack(voice);
  let score = 0;
  if (/south african|south africa|afrikaans|cape town|johannesburg|pretoria/.test(hay)) {
    score += 100;
  }
  if (/british|uk english|australian|irish|scottish/.test(hay)) score += 25;
  if (/american|us english/.test(hay)) score += 5;
  if (/male|man|deep|baritone|news|broadcast|narrat|sports|commentary/.test(hay)) score += 20;
  if (/female|woman/.test(hay)) score += role === "analyst" ? 8 : -5;
  if (/warm|confident|authoritative|professional/.test(hay)) score += 10;
  if (role === "lead" && /energetic|excited|dynamic/.test(hay)) score += 8;
  if (role === "analyst" && /calm|clear|informative|conversational/.test(hay)) score += 8;
  return score;
}

/**
 * Pick SA-leaning Lead + Analyst voices from the ElevenLabs library and store IDs
 * on Currie Cup default profiles (server-side only).
 */
export async function configureCurrieCupVoicesFromElevenLabs(): Promise<{
  lead: { slug: string; voiceIdRedacted: string; name: string };
  analyst: { slug: string; voiceIdRedacted: string; name: string };
}> {
  const voices = await listElevenLabsVoices();
  if (!voices.length) throw new Error("No ElevenLabs voices available for this API key.");

  const rankedLead = [...voices].sort(
    (a, b) => scoreSaCommentaryVoice(b, "lead") - scoreSaCommentaryVoice(a, "lead"),
  );
  const lead = rankedLead[0]!;
  const rankedAnalyst = [...voices]
    .filter((v) => v.voice_id !== lead.voice_id)
    .sort((a, b) => scoreSaCommentaryVoice(b, "analyst") - scoreSaCommentaryVoice(a, "analyst"));
  const analyst = rankedAnalyst[0] ?? rankedLead[1] ?? lead;

  const db = getDb();
  await db
    .update(audioVoiceProfiles)
    .set({
      elevenlabsVoiceId: lead.voice_id,
      updatedAt: new Date(),
      notes: `Auto-configured from ElevenLabs voice "${lead.name}" for Currie Cup Lead (SA-leaning).`,
    })
    .where(eq(audioVoiceProfiles.slug, "currie-cup-lead-sa"));
  await db
    .update(audioVoiceProfiles)
    .set({
      elevenlabsVoiceId: analyst.voice_id,
      updatedAt: new Date(),
      notes: `Auto-configured from ElevenLabs voice "${analyst.name}" for Currie Cup Analyst (SA-leaning).`,
    })
    .where(eq(audioVoiceProfiles.slug, "currie-cup-analyst-sa"));

  const redact = (id: string) =>
    id.length <= 6 ? `${id.slice(0, 2)}…` : `${id.slice(0, 4)}…${id.slice(-2)}`;

  return {
    lead: {
      slug: "currie-cup-lead-sa",
      voiceIdRedacted: redact(lead.voice_id),
      name: lead.name,
    },
    analyst: {
      slug: "currie-cup-analyst-sa",
      voiceIdRedacted: redact(analyst.voice_id),
      name: analyst.name,
    },
  };
}

async function refreshScriptAudioStatus(scriptId: string): Promise<void> {
  const db = getDb();
  const ready = await db
    .select({ speaker: audioCommentarySegments.speaker })
    .from(audioCommentarySegments)
    .where(
      and(
        eq(audioCommentarySegments.scriptId, scriptId),
        eq(audioCommentarySegments.status, "ready"),
      ),
    );
  const speakers = new Set(ready.map((r) => r.speaker));
  const status = speakers.has("lead") && speakers.has("analyst") ? "tts_ready" : "audio_pending";
  await db
    .update(audioCommentaryScripts)
    .set({ status, updatedAt: new Date() })
    .where(eq(audioCommentaryScripts.id, scriptId));
}

/**
 * Generate private TTS for one speaker on one script.
 * Uses resolveVoiceProfileForFixture (match override → competition default).
 * Returns segment metadata only — never voice IDs or public URLs.
 */
export async function generatePrivateAudioForScriptSpeaker(input: {
  scriptId: string;
  speaker: TtsSpeaker;
  /** Override voice profile id; otherwise resolved from fixture defaults/overrides. */
  voiceProfileId?: string;
}): Promise<{
  segmentId: string;
  speaker: TtsSpeaker;
  status: string;
  storagePath: string;
  jobId: string;
}> {
  const db = getDb();
  const [script] = await db
    .select()
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.id, input.scriptId))
    .limit(1);

  if (!script) throw new Error("Audio script not found");

  const text =
    input.speaker === "lead"
      ? script.leadScript
      : input.speaker === "analyst"
        ? script.analystScript
        : input.speaker === "sideline"
          ? script.sidelineScript
          : script.guestScript;
  if (!text?.trim()) throw new Error(`${input.speaker} script is empty`);

  let resolved: ResolvedVoiceProfile | null = null;
  if (input.voiceProfileId) {
    const [profile] = await db
      .select()
      .from(audioVoiceProfiles)
      .where(
        and(
          eq(audioVoiceProfiles.id, input.voiceProfileId),
          eq(audioVoiceProfiles.status, "active"),
        ),
      )
      .limit(1);
    if (!profile) throw new Error("Voice profile not found or inactive");
    const tone = tonePresetSettings(profile.tone, {
      accent: profile.accent,
      voiceStyle: profile.voiceStyle,
      deliveryStyle: profile.deliveryStyle,
      aiPrompt: profile.aiPrompt,
    });
    resolved = {
      profileId: profile.id,
      slug: profile.slug,
      displayName: profile.displayName,
      creatorProfileLabel: formatCreatorProfileLabel({
        displayName: profile.displayName,
        organisationLabel: profile.organisationLabel,
        topicLabel: profile.topicLabel,
        accent: profile.accent,
        competitionScope: profile.competitionScope,
      }),
      role: input.speaker,
      provider: profile.provider === "openai" ? "openai" : profile.provider === "auto" ? "auto" : "elevenlabs",
      elevenlabsVoiceId: profile.elevenlabsVoiceId,
      openaiVoice: profile.openaiVoice,
      speed: typeof profile.speed === "number" ? profile.speed : 1,
      tone: profile.tone || "broadcast",
      voiceStyle: normalizeVoiceStyle(profile.voiceStyle),
      deliveryStyle: normalizeDeliveryStyle(profile.deliveryStyle),
      aiPrompt: profile.aiPrompt,
      pitch: profile.pitch,
      stability: profile.stability ?? tone.stability,
      similarityBoost: profile.similarityBoost,
      styleExaggeration: profile.styleExaggeration ?? tone.style,
      accent: profile.accent,
      organisationLabel: profile.organisationLabel,
      topicLabel: profile.topicLabel,
      locale: profile.locale,
      competitionScope: profile.competitionScope,
      source: "fallback",
      defaultsLabel: null,
      stadiumAmbienceKey: null,
      accentLabel: profile.organisationLabel,
      optimiseDualCommentary: true,
      emphasiseScoreboard: true,
    };
  } else {
    resolved = await resolveVoiceProfileForFixture(script.fixtureId, input.speaker);
  }

  const tone = tonePresetSettings(resolved.tone, {
    accent: resolved.accent,
    accentLabel: resolved.accentLabel,
    voiceStyle: resolved.voiceStyle,
    deliveryStyle: resolved.deliveryStyle,
    aiPrompt: resolved.aiPrompt,
  });
  const stability = resolved.stability ?? tone.stability;
  const style = resolved.styleExaggeration ?? tone.style;
  const similarity = resolved.similarityBoost ?? 0.75;

  const elevenLabsKey = await resolveElevenLabsApiKey();
  const openAiKey = await resolveOpenAiApiKey();
  const providerPref = resolved.provider; // auto | elevenlabs | openai

  const canElevenLabs = Boolean(elevenLabsKey && resolved.elevenlabsVoiceId?.trim());
  const canOpenAi = Boolean(openAiKey);

  let useElevenLabs = false;
  let useOpenAi = false;

  if (providerPref === "openai") {
    useOpenAi = canOpenAi;
  } else if (providerPref === "elevenlabs") {
    useElevenLabs = canElevenLabs;
    // Soft fallback only if ElevenLabs voice missing but OpenAI available
    if (!useElevenLabs && canOpenAi) useOpenAi = true;
  } else {
    // Auto: ElevenLabs first, then OpenAI
    if (canElevenLabs) {
      useElevenLabs = true;
    } else if (canOpenAi) {
      useOpenAi = true;
    }
  }

  if (!useElevenLabs && !useOpenAi) {
    if (!elevenLabsKey && !openAiKey) {
      throw new Error(
        "No TTS key configured. Save ElevenLabs at Admin → Keys → ElevenLabs, or OpenAI at Admin → Keys → OpenAI.",
      );
    }
    throw new Error(
      `Voice profile "${resolved.slug}" has no usable voice id for the configured provider. Update Admin → Audio Commentary.`,
    );
  }

  const provider = useElevenLabs ? "elevenlabs" : "openai";

  const [job] = await db
    .insert(audioCommentaryJobs)
    .values({
      fixtureId: script.fixtureId,
      scriptId: script.id,
      jobType: "tts",
      status: "running",
      payload: {
        speaker: input.speaker,
        voiceProfileSlug: resolved.slug,
        provider,
        speed: resolved.speed,
        tone: resolved.tone,
        source: resolved.source,
        // Never persist raw voice id in job payload for accidental leakage.
      },
    })
    .returning();

  try {
    let audio: Buffer;
    let contentType = "audio/mpeg";
    let providerMeta: Record<string, string | number> = { provider };
    let usedProvider: "elevenlabs" | "openai" = provider;

    async function synthOpenAi() {
      const openaiVoice =
        resolved.openaiVoice?.trim() || OPENAI_TTS_VOICES[input.speaker];
      return synthesizeOpenAiSpeech({
        text,
        speaker: input.speaker,
        voice: openaiVoice,
        speed: resolved.speed,
        instructions: tone.instructionPrefix,
      });
    }

    if (useElevenLabs) {
      try {
        const synthesized = await synthesizeElevenLabsSpeech({
          text,
          voiceId: resolved.elevenlabsVoiceId!,
          stability,
          similarityBoost: similarity,
          style,
          speed: resolved.speed,
        });
        audio = synthesized.audio;
        contentType = synthesized.contentType;
        providerMeta = {
          provider: "elevenlabs",
          speed: resolved.speed,
          tone: resolved.tone,
        };
        usedProvider = "elevenlabs";
      } catch (elevenErr) {
        // Auto (and soft elevenlabs) → OpenAI fallback when credits/API fail
        if (canOpenAi && (providerPref === "auto" || providerPref === "elevenlabs")) {
          const synthesized = await synthOpenAi();
          audio = synthesized.audio;
          contentType = synthesized.contentType;
          providerMeta = {
            provider: "openai",
            model: synthesized.model,
            voice: synthesized.voice,
            speed: synthesized.speed,
            tone: resolved.tone,
            fallbackFrom: "elevenlabs",
          };
          usedProvider = "openai";
        } else {
          throw elevenErr;
        }
      }
    } else {
      const synthesized = await synthOpenAi();
      audio = synthesized.audio;
      contentType = synthesized.contentType;
      providerMeta = {
        provider: "openai",
        model: synthesized.model,
        voice: synthesized.voice,
        speed: synthesized.speed,
        tone: resolved.tone,
      };
      usedProvider = "openai";
    }

    // Keep job payload in sync with actual provider used
    void usedProvider;

    await ensurePrivateAudioBucket();
    const storagePath = `audio-commentary/${script.fixtureId}/${script.id}/${input.speaker}.mp3`;
    const supabase = await getSupabaseServerClient("service");
    const upload = await supabase.storage.from(AUDIO_COMMENTARY_BUCKET).upload(storagePath, audio, {
      contentType,
      upsert: true,
    });
    if (upload.error) throw new Error(upload.error.message);

    const [existing] = await db
      .select()
      .from(audioCommentarySegments)
      .where(
        and(
          eq(audioCommentarySegments.scriptId, script.id),
          eq(audioCommentarySegments.speaker, input.speaker),
        ),
      )
      .orderBy(desc(audioCommentarySegments.createdAt))
      .limit(1);

    let segmentId: string;
    if (existing) {
      const [updated] = await db
        .update(audioCommentarySegments)
        .set({
          voiceProfileId: resolved.profileId,
          storagePath,
          status: "ready",
          updatedAt: new Date(),
        })
        .where(eq(audioCommentarySegments.id, existing.id))
        .returning();
      segmentId = updated!.id;
    } else {
      const [segment] = await db
        .insert(audioCommentarySegments)
        .values({
          fixtureId: script.fixtureId,
          scriptId: script.id,
          speaker: input.speaker,
          voiceProfileId: resolved.profileId,
          storagePath,
          status: "ready",
        })
        .returning();
      segmentId = segment!.id;
    }

    await db
      .update(audioCommentaryJobs)
      .set({
        status: "completed",
        updatedAt: new Date(),
        payload: { speaker: input.speaker, storagePath, ...providerMeta },
      })
      .where(eq(audioCommentaryJobs.id, job!.id));

    await refreshScriptAudioStatus(script.id);

    return {
      segmentId,
      speaker: input.speaker,
      status: "ready",
      storagePath,
      jobId: job!.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed";
    await db
      .update(audioCommentaryJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(audioCommentaryJobs.id, job!.id));
    throw error;
  }
}

/** Admin-only: generate Lead (and optionally Analyst) private audio for one script. */
export async function generatePrivateAudioForScript(
  scriptId: string,
  options?: { speakers?: TtsSpeaker[] },
): Promise<{
  results: Array<{
    segmentId: string;
    speaker: TtsSpeaker;
    status: string;
    /** Admin-only path — strip before any public response. */
    storagePath: string;
    jobId: string;
  }>;
}> {
  const speakers = options?.speakers ?? ["lead"];
  const results = [];
  for (const speaker of speakers) {
    results.push(await generatePrivateAudioForScriptSpeaker({ scriptId, speaker }));
  }
  return { results };
}

export async function countReadyAudioSegments(fixtureId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(audioCommentarySegments)
    .where(
      and(
        eq(audioCommentarySegments.fixtureId, fixtureId),
        eq(audioCommentarySegments.status, "ready"),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function listReadyAudioSpeakerFlags(
  fixtureId: string,
): Promise<Map<string, { lead: boolean; analyst: boolean }>> {
  const db = getDb();
  const rows = await db
    .select({
      scriptId: audioCommentarySegments.scriptId,
      speaker: audioCommentarySegments.speaker,
    })
    .from(audioCommentarySegments)
    .where(
      and(
        eq(audioCommentarySegments.fixtureId, fixtureId),
        eq(audioCommentarySegments.status, "ready"),
      ),
    );

  const map = new Map<string, { lead: boolean; analyst: boolean }>();
  for (const row of rows) {
    if (!row.scriptId) continue;
    const cur = map.get(row.scriptId) ?? { lead: false, analyst: false };
    if (row.speaker === "lead") cur.lead = true;
    if (row.speaker === "analyst") cur.analyst = true;
    map.set(row.scriptId, cur);
  }
  return map;
}

/**
 * Resolve a ready private segment for a match clock + speaker.
 * Returns storage path server-side only — never expose to clients.
 */
export async function resolveReadyAudioSegment(input: {
  fixtureId: string;
  minute: number;
  second: number;
  speaker: TtsSpeaker;
}): Promise<{ segmentId: string; storagePath: string } | null> {
  const db = getDb();
  const minute = Math.max(0, Math.floor(input.minute));
  const second = Math.max(0, Math.min(59, Math.floor(input.second)));

  // Prefer exact clock match (highest priority), then nearest earlier script.
  const exact = await db
    .select({
      segmentId: audioCommentarySegments.id,
      storagePath: audioCommentarySegments.storagePath,
      priority: audioCommentaryScripts.priority,
    })
    .from(audioCommentarySegments)
    .innerJoin(
      audioCommentaryScripts,
      eq(audioCommentaryScripts.id, audioCommentarySegments.scriptId),
    )
    .where(
      and(
        eq(audioCommentarySegments.fixtureId, input.fixtureId),
        eq(audioCommentarySegments.speaker, input.speaker),
        eq(audioCommentarySegments.status, "ready"),
        eq(audioCommentaryScripts.minute, minute),
        eq(audioCommentaryScripts.second, second),
      ),
    )
    .orderBy(desc(audioCommentaryScripts.priority), asc(audioCommentaryScripts.createdAt))
    .limit(1);

  if (exact[0]?.storagePath) {
    return { segmentId: exact[0].segmentId, storagePath: exact[0].storagePath };
  }

  const nearest = await db
    .select({
      segmentId: audioCommentarySegments.id,
      storagePath: audioCommentarySegments.storagePath,
      minute: audioCommentaryScripts.minute,
      second: audioCommentaryScripts.second,
      priority: audioCommentaryScripts.priority,
    })
    .from(audioCommentarySegments)
    .innerJoin(
      audioCommentaryScripts,
      eq(audioCommentaryScripts.id, audioCommentarySegments.scriptId),
    )
    .where(
      and(
        eq(audioCommentarySegments.fixtureId, input.fixtureId),
        eq(audioCommentarySegments.speaker, input.speaker),
        eq(audioCommentarySegments.status, "ready"),
      ),
    )
    .orderBy(
      desc(audioCommentaryScripts.minute),
      desc(audioCommentaryScripts.second),
      desc(audioCommentaryScripts.priority),
    );

  const target = minute * 60 + second;
  for (const row of nearest) {
    const t = row.minute * 60 + row.second;
    if (t <= target && row.storagePath) {
      return { segmentId: row.segmentId, storagePath: row.storagePath };
    }
  }
  return null;
}

/** Download private segment bytes for same-origin proxy playback. */
export async function downloadPrivateAudioSegment(storagePath: string): Promise<{
  bytes: Buffer;
  contentType: string;
}> {
  const supabase = await getSupabaseServerClient("service");
  const downloaded = await supabase.storage.from(AUDIO_COMMENTARY_BUCKET).download(storagePath);
  if (downloaded.error || !downloaded.data) {
    throw new Error(downloaded.error?.message ?? "Failed to download audio segment");
  }
  const ab = await downloaded.data.arrayBuffer();
  return { bytes: Buffer.from(ab), contentType: "audio/mpeg" };
}

export async function testElevenLabsConnection(options?: {
  apiKeyOverride?: string;
}): Promise<{ ok: boolean; message: string }> {
  const apiKey = options?.apiKeyOverride?.trim() || (await resolveElevenLabsApiKey());
  if (!apiKey) {
    return { ok: false, message: "No ElevenLabs API key configured." };
  }

  const userRes = await fetch("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!userRes.ok) {
    const body = await userRes.text();
    return {
      ok: false,
      message: `ElevenLabs test failed (${userRes.status}): ${body.slice(0, 220)}`,
    };
  }

  const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!voicesRes.ok) {
    return {
      ok: true,
      message: "ElevenLabs connected (user OK). Voice list check failed — key may lack voices_read.",
    };
  }

  const voicesData = (await voicesRes.json().catch(() => ({}))) as { voices?: unknown[] };
  const voiceCount = Array.isArray(voicesData.voices) ? voicesData.voices.length : 0;
  return {
    ok: true,
    message: `ElevenLabs connected. voices_read passed (${voiceCount} voices listed).`,
  };
}
