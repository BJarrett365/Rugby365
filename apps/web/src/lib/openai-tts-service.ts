/**
 * OpenAI TTS fallback for Live Audio Commentary.
 * Used when ElevenLabs is not configured but Admin → Keys → OpenAI (or OPENAI_API_KEY) is.
 * Voice names stay server-side — never in public Match Animation payloads.
 */

import "server-only";
import {
  resolveElevenLabsApiKey,
  resolveOpenAiApiKey,
} from "./integration-settings-service";

export type OpenAiTtsSpeaker = "lead" | "analyst" | "sideline" | "guest";

/** OpenAI built-in voices — dual-commentator defaults when ElevenLabs is unavailable. */
export const OPENAI_TTS_VOICES: Record<OpenAiTtsSpeaker, string> = {
  lead: "onyx",
  analyst: "nova",
  sideline: "echo",
  guest: "fable",
};

export type OpenAiTtsModel = "tts-1" | "tts-1-hd" | "gpt-4o-mini-tts";

export async function resolveOpenAiTtsModel(): Promise<OpenAiTtsModel> {
  const env = process.env.OPENAI_TTS_MODEL?.trim();
  if (env === "tts-1-hd" || env === "gpt-4o-mini-tts" || env === "tts-1") return env;
  return "tts-1";
}

export async function synthesizeOpenAiSpeech(input: {
  text: string;
  speaker: OpenAiTtsSpeaker;
  voice?: string;
  /** 0.75–1.5 preferred; OpenAI accepts 0.25–4.0 */
  speed?: number;
  /** Tone / delivery instructions (gpt-4o-mini-tts). */
  instructions?: string;
}): Promise<{ audio: Buffer; contentType: string; voice: string; model: string; speed: number }> {
  const apiKey = await resolveOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API key not configured (OPENAI_API_KEY or Admin → Keys → OpenAI).");
  }

  const voice = (input.voice?.trim() || OPENAI_TTS_VOICES[input.speaker]).trim();
  const model = await resolveOpenAiTtsModel();
  const text = input.text.trim().slice(0, 4096);
  if (!text) throw new Error("TTS text is empty");

  const speed =
    typeof input.speed === "number" && Number.isFinite(input.speed)
      ? Math.min(4, Math.max(0.25, input.speed))
      : 1;

  const body: Record<string, unknown> = {
    model,
    input: text,
    voice,
    response_format: "mp3",
    speed,
  };
  if (model === "gpt-4o-mini-tts" && input.instructions?.trim()) {
    body.instructions = input.instructions.trim().slice(0, 1000);
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS failed (${res.status}): ${errText.slice(0, 280)}`);
  }

  const ab = await res.arrayBuffer();
  return {
    audio: Buffer.from(ab),
    contentType: "audio/mpeg",
    voice,
    model,
    speed,
  };
}

/** Prefer ElevenLabs when keyed; otherwise OpenAI from Admin → Keys. */
export async function resolveAudioTtsBackend(): Promise<"elevenlabs" | "openai" | null> {
  if (await resolveElevenLabsApiKey()) return "elevenlabs";
  if (await resolveOpenAiApiKey()) return "openai";
  return null;
}
