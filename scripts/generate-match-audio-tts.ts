/**
 * Batch-generate Lead + Analyst TTS for a fixture's audio scripts.
 *
 *   set -a && source .env && set +a
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/generate-match-audio-tts.ts \
 *     [fixtureId] [--all] [--limit=20] [--speakers=lead,analyst] [--concurrency=1] [--force]
 *
 * Default is full match (--all). Pass --limit=N for a priority subset (testing).
 *
 * Prefers ElevenLabs (ELEVENLABS_API_KEY or Admin → Keys → ElevenLabs).
 * Falls back to OpenAI TTS (OPENAI_API_KEY or Admin → Keys → OpenAI) when ElevenLabs is unset.
 * Voices resolve via resolveVoiceProfileForFixture (match override → competition defaults).
 * Requires Supabase service credentials for private storage.
 */

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  audioCommentaryScripts,
  audioCommentarySegments,
  audioVoiceProfiles,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  configureCurrieCupVoicesFromElevenLabs,
  generatePrivateAudioForScriptSpeaker,
  type TtsSpeaker,
} from "../apps/web/src/lib/elevenlabs-tts-service";
import { resolveElevenLabsApiKey, resolveOpenAiApiKey } from "../apps/web/src/lib/integration-settings-service";
import { resolveAudioTtsBackend } from "../apps/web/src/lib/openai-tts-service";

const DEFAULT_FIXTURE = "456b1da9-af24-4573-9c76-60c2802622e0";

const PRIORITY_TYPES = [
  "full_time",
  "half_time",
  "kick_off",
  "major_event",
  "card",
  "momentum",
] as const;

function parseArgs(argv: string[]) {
  let fixtureId = DEFAULT_FIXTURE;
  // Default: full match. Pass --limit=N for a priority subset (testing).
  let limit: number | null = null;
  let all = true;
  let speakers: TtsSpeaker[] = ["lead", "analyst"];
  let concurrency = 1;
  let force = false;

  for (const arg of argv) {
    if (!arg.startsWith("--") && /^[0-9a-f-]{36}$/i.test(arg)) {
      fixtureId = arg;
      continue;
    }
    if (arg === "--all") {
      all = true;
      limit = null;
      continue;
    }
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      limit = Math.max(1, Number(arg.slice("--limit=".length)) || 20);
      all = false;
      continue;
    }
    if (arg.startsWith("--speakers=")) {
      const parts = arg
        .slice("--speakers=".length)
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is TtsSpeaker => s === "lead" || s === "analyst");
      if (parts.length) speakers = parts;
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      concurrency = Math.max(1, Math.min(2, Number(arg.slice("--concurrency=".length)) || 1));
    }
  }

  return { fixtureId, limit: limit ?? 20, all, speakers, concurrency, force };
}

async function ensureVoicesConfigured(backend: "elevenlabs" | "openai") {
  if (backend !== "elevenlabs") {
    console.log("Using OpenAI TTS voices (onyx Lead / nova Analyst) — no ElevenLabs voice IDs required.");
    return null;
  }

  const db = getDb();
  const rows = await db
    .select({
      slug: audioVoiceProfiles.slug,
      voiceId: audioVoiceProfiles.elevenlabsVoiceId,
    })
    .from(audioVoiceProfiles)
    .where(
      and(
        eq(audioVoiceProfiles.competitionScope, "currie_cup"),
        eq(audioVoiceProfiles.status, "active"),
        inArray(audioVoiceProfiles.slug, ["currie-cup-lead-sa", "currie-cup-analyst-sa"]),
      ),
    );

  const missing = rows.filter((r) => !r.voiceId?.trim());
  if (!missing.length && rows.length >= 2) {
    console.log("Voice profiles already configured (IDs redacted).");
    return null;
  }

  console.log("Configuring Currie Cup Lead/Analyst voices from ElevenLabs library…");
  const configured = await configureCurrieCupVoicesFromElevenLabs();
  console.log(
    `Voices set: lead=${configured.lead.name} (${configured.lead.voiceIdRedacted}), analyst=${configured.analyst.name} (${configured.analyst.voiceIdRedacted})`,
  );
  return configured;
}

function pickEvenlySpaced<T extends { minute: number; second: number; id: string }>(
  rows: T[],
  count: number,
): T[] {
  if (count <= 0 || !rows.length) return [];
  if (rows.length <= count) return [...rows];
  const byTime = [...rows].sort(
    (a, b) => a.minute * 60 + a.second - (b.minute * 60 + b.second),
  );
  const picked: T[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const idx =
      count === 1 ? 0 : Math.round((i * (byTime.length - 1)) / (count - 1));
    const row = byTime[idx]!;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    picked.push(row);
  }
  // Fill gaps if duplicates from rounding collapsed the set.
  for (const row of byTime) {
    if (picked.length >= count) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    picked.push(row);
  }
  return picked.sort((a, b) => a.minute * 60 + a.second - (b.minute * 60 + b.second));
}

async function selectScripts(fixtureId: string, limit: number, all: boolean) {
  const db = getDb();
  const base = db
    .select({
      id: audioCommentaryScripts.id,
      minute: audioCommentaryScripts.minute,
      second: audioCommentaryScripts.second,
      combinationType: audioCommentaryScripts.combinationType,
      priority: audioCommentaryScripts.priority,
      status: audioCommentaryScripts.status,
      leadScript: audioCommentaryScripts.leadScript,
      analystScript: audioCommentaryScripts.analystScript,
    })
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.fixtureId, fixtureId))
    .orderBy(
      desc(audioCommentaryScripts.priority),
      asc(audioCommentaryScripts.minute),
      asc(audioCommentaryScripts.second),
    );

  const rows = await base;
  if (all) return rows;

  const priority = rows.filter((r) =>
    (PRIORITY_TYPES as readonly string[]).includes(r.combinationType),
  );
  const picked = priority.slice(0, limit);
  const pickedIds = new Set(picked.map((p) => p.id));

  if (picked.length < limit) {
    // Prefer even spacing across the match clock so Normal time isn't silent for long stretches.
    const remaining = rows.filter((r) => !pickedIds.has(r.id));
    const spaced = pickEvenlySpaced(remaining, limit - picked.length);
    for (const row of spaced) {
      picked.push(row);
      pickedIds.add(row.id);
    }
  }

  return picked.sort(
    (a, b) => a.minute * 60 + a.second - (b.minute * 60 + b.second),
  );
}

async function alreadyReady(
  scriptId: string,
  speaker: TtsSpeaker,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: audioCommentarySegments.id })
    .from(audioCommentarySegments)
    .where(
      and(
        eq(audioCommentarySegments.scriptId, scriptId),
        eq(audioCommentarySegments.speaker, speaker),
        eq(audioCommentarySegments.status, "ready"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let idx = 0;
  async function next(): Promise<void> {
    while (idx < items.length) {
      const current = items[idx++]!;
      await worker(current);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => next()));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const backend = await resolveAudioTtsBackend();
  if (!backend) {
    console.error(
      "BLOCKER: No TTS key. Set Admin → Keys → ElevenLabs (preferred) or Admin → Keys → OpenAI, or matching .env vars.",
    );
    process.exit(2);
  }

  const el = await resolveElevenLabsApiKey();
  const oa = await resolveOpenAiApiKey();
  console.log(
    `TTS backend: ${backend} (ElevenLabs ${el ? "SET" : "missing"}, OpenAI ${oa ? "SET" : "missing"})`,
  );

  const voices = await ensureVoicesConfigured(backend);

  const db = getDb();
  const [{ scriptsTotal }] = await db
    .select({ scriptsTotal: sql<number>`count(*)::int` })
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.fixtureId, args.fixtureId));

  if (!Number(scriptsTotal)) {
    console.error(
      `No audio scripts for fixture ${args.fixtureId}. Run scripts/regen-match-commentary.ts first.`,
    );
    process.exit(1);
  }

  const selected = await selectScripts(args.fixtureId, args.limit, args.all);
  console.log(
    `Fixture ${args.fixtureId}: ${scriptsTotal} scripts total; generating TTS for ${selected.length} (${args.all ? "all" : "priority subset"}) · speakers=${args.speakers.join(",")} · concurrency=${args.concurrency}`,
  );

  type Job = { scriptId: string; speaker: TtsSpeaker; label: string };
  const jobs: Job[] = [];
  for (const script of selected) {
    for (const speaker of args.speakers) {
      const text = speaker === "lead" ? script.leadScript : script.analystScript;
      if (!text?.trim()) continue;
      if (!args.force && (await alreadyReady(script.id, speaker))) continue;
      jobs.push({
        scriptId: script.id,
        speaker,
        label: `${String(script.minute).padStart(2, "0")}:${String(script.second).padStart(2, "0")} ${script.combinationType} ${speaker}`,
      });
    }
  }

  console.log(`Jobs to run: ${jobs.length} (skipped already-ready unless --force)`);

  let ok = 0;
  let failed = 0;
  const failures: string[] = [];

  await runPool(jobs, args.concurrency, async (job) => {
    process.stdout.write(`→ ${job.label} … `);
    try {
      const result = await generatePrivateAudioForScriptSpeaker({
        scriptId: job.scriptId,
        speaker: job.speaker,
      });
      ok += 1;
      console.log(`ok segment=${result.segmentId.slice(0, 8)}…`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${job.label}: ${message}`);
      console.log(`FAIL ${message.slice(0, 160)}`);
      if (/quota|credits|payment|401|unauthorized/i.test(message)) {
        throw error;
      }
    }
  });

  const [{ readySegments }] = await db
    .select({ readySegments: sql<number>`count(*)::int` })
    .from(audioCommentarySegments)
    .where(
      and(
        eq(audioCommentarySegments.fixtureId, args.fixtureId),
        eq(audioCommentarySegments.status, "ready"),
      ),
    );

  const [{ ttsReadyScripts }] = await db
    .select({ ttsReadyScripts: sql<number>`count(*)::int` })
    .from(audioCommentaryScripts)
    .where(
      and(
        eq(audioCommentaryScripts.fixtureId, args.fixtureId),
        eq(audioCommentaryScripts.status, "tts_ready"),
      ),
    );

  console.log("\n=== Summary ===");
  console.log(`Scripts in DB: ${scriptsTotal}`);
  console.log(`TTS jobs succeeded: ${ok}`);
  console.log(`TTS jobs failed: ${failed}`);
  console.log(`Ready segments: ${readySegments}`);
  console.log(`Scripts with both speakers (tts_ready): ${ttsReadyScripts}`);
  if (voices) {
    console.log(
      `Voices configured: lead ${voices.lead.voiceIdRedacted} / analyst ${voices.analyst.voiceIdRedacted}`,
    );
  }
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures.slice(0, 20)) console.log(` - ${f}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
