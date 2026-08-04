import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  listAllAudioScriptIds,
  listPriorityAudioScriptIds,
  resolvePresenterCountForFixture,
  rolesForPresenterCount,
} from "@/lib/audio-voice-settings-service";
import {
  generatePrivateAudioForScriptSpeaker,
  type TtsSpeaker,
} from "@/lib/elevenlabs-tts-service";
import { getDb } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { audioCommentarySegments } from "@rugby365/db";

const VALID: TtsSpeaker[] = ["lead", "analyst", "sideline", "guest"];

/**
 * Admin: generate / regenerate TTS using currently resolved
 * match / competition voice profiles.
 *
 * body.mode:
 *   - "priority" (default) — high-priority subset (limit)
 *   - "remaining" — all scripts missing ready audio for active speakers
 *   - "full" — all scripts (skips already-ready unless force)
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: fixtureId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      limit?: number;
      speakers?: TtsSpeaker[];
      mode?: "priority" | "remaining" | "full";
      force?: boolean;
    };
    const mode = body.mode ?? "priority";
    const limit = Math.min(200, Math.max(1, body.limit ?? 12));
    const force = Boolean(body.force);

    let speakers: TtsSpeaker[];
    if (
      body.speakers?.length &&
      body.speakers.every((s) => VALID.includes(s))
    ) {
      speakers = body.speakers;
    } else {
      // Dual Lead+Analyst scripts are the product default — never drop Analyst
      // just because presenterCount was accidentally saved as 1.
      const count = await resolvePresenterCountForFixture(fixtureId);
      speakers = rolesForPresenterCount(Math.max(2, count)) as TtsSpeaker[];
    }

    let scriptIds: string[];
    if (mode === "full" || mode === "remaining") {
      scriptIds = await listAllAudioScriptIds(fixtureId);
    } else {
      scriptIds = await listPriorityAudioScriptIds(fixtureId, limit);
    }

    if (!scriptIds.length) {
      return NextResponse.json({
        ok: true,
        regenerated: 0,
        failed: 0,
        skipped: 0,
        message: "No audio scripts for this match yet. Generate commentary first.",
      });
    }

    const db = getDb();
    let regenerated = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const scriptId of scriptIds) {
      for (const speaker of speakers) {
        if (!force && mode !== "priority") {
          const [ready] = await db
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
          if (ready) {
            skipped += 1;
            continue;
          }
        }
        try {
          await generatePrivateAudioForScriptSpeaker({ scriptId, speaker });
          regenerated += 1;
        } catch (err) {
          failed += 1;
          const msg = err instanceof Error ? err.message : String(err);
          // Empty sideline/guest scripts are expected on short events
          if (/script is empty/i.test(msg)) {
            skipped += 1;
            failed -= 1;
            continue;
          }
          errors.push(`${scriptId.slice(0, 8)}… ${speaker}: ${msg.slice(0, 120)}`);
        }
      }
    }

    return NextResponse.json({
      ok: failed === 0 || errors.length === 0,
      regenerated,
      failed: errors.length,
      skipped,
      scriptCount: scriptIds.length,
      speakers,
      mode,
      errors: errors.slice(0, 12),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to regenerate audio");
  }
}
