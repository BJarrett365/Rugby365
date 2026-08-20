import "server-only";
import { and, count, desc, eq, max } from "drizzle-orm";
import {
  audioCommentaryScripts,
  fixtures,
  matchCommentary,
  matchEvents,
} from "@rugby365/db";
import { fetchSdmsMatchDetail } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { syncFixtureLiveStateFromSdms } from "./fixture-live-score-sync";
import { mergeProviderSnapshot } from "./head-to-head-service";
import { generateAndPublishMatchNarrativeCommentary } from "./match-narrative-commentary-service";
import {
  buildNarrativeRefreshSignature,
  type NarrativeRefreshState,
} from "./match-narrative-live-refresh-utils";
import { syncSdmsLiveEventsFromDetail } from "./planet-rugby-match-import-service";
import { isLiveFixtureStatus } from "./table-lab/live-table-service";

export { buildNarrativeRefreshSignature, narrativeProgressBucket } from "./match-narrative-live-refresh-utils";
export type { NarrativeRefreshState } from "./match-narrative-live-refresh-utils";

export const NARRATIVE_SOURCE = "match_narrative";

const SNAPSHOT_KEY = "narrativeLiveRefresh";
/** Avoid SDMS + rebuild storms from the 4s public commentary poll. */
const MIN_ATTEMPT_INTERVAL_MS = 12_000;

const lastAttemptAt = new Map<string, number>();
const inFlight = new Map<string, Promise<NarrativeLiveRefreshResult>>();

export type NarrativeLiveRefreshResult = {
  activated: boolean;
  skipped: boolean;
  reason:
    | "not_activated"
    | "throttled"
    | "unchanged"
    | "rebuilt"
    | "error"
    | "in_flight";
  created?: number;
  signature?: string;
  error?: string;
};

function readStoredSignature(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const block = (snapshot as Record<string, unknown>)[SNAPSHOT_KEY];
  if (!block || typeof block !== "object") return null;
  const signature = (block as Record<string, unknown>).signature;
  return typeof signature === "string" && signature.length > 0 ? signature : null;
}

export async function isNarrativeCommentaryActivated(fixtureId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: matchCommentary.id })
    .from(matchCommentary)
    .where(
      and(eq(matchCommentary.fixtureId, fixtureId), eq(matchCommentary.source, NARRATIVE_SOURCE)),
    )
    .limit(1);
  return Boolean(row);
}

async function fixtureHasAudioScripts(fixtureId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: audioCommentaryScripts.id })
    .from(audioCommentaryScripts)
    .where(eq(audioCommentaryScripts.fixtureId, fixtureId))
    .limit(1);
  return Boolean(row);
}

async function loadRefreshState(fixtureId: string): Promise<{
  fixture: {
    id: string;
    status: string;
    period: string;
    homeScore: number | null;
    awayScore: number | null;
    matchMinute: number;
    externalMatchId: string | null;
    providerSnapshot: unknown;
  };
  state: NarrativeRefreshState;
} | null> {
  const db = getDb();
  const [fixture] = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      period: fixtures.period,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      matchMinute: fixtures.matchMinute,
      externalMatchId: fixtures.externalMatchId,
      providerSnapshot: fixtures.providerSnapshot,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);
  if (!fixture) return null;

  const [eventAgg] = await db
    .select({
      eventCount: count(),
      maxSequence: max(matchEvents.sequenceNo),
    })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId));

  return {
    fixture,
    state: {
      status: fixture.status,
      period: fixture.period ?? "",
      homeScore: fixture.homeScore ?? 0,
      awayScore: fixture.awayScore ?? 0,
      matchMinute: fixture.matchMinute ?? 0,
      eventCount: Number(eventAgg?.eventCount ?? 0),
      maxSequence: Number(eventAgg?.maxSequence ?? 0),
    },
  };
}

async function persistRefreshSignature(fixtureId: string, signature: string): Promise<void> {
  const db = getDb();
  const [fixture] = await db
    .select({ providerSnapshot: fixtures.providerSnapshot })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);
  if (!fixture) return;
  const existing =
    fixture.providerSnapshot && typeof fixture.providerSnapshot === "object"
      ? (fixture.providerSnapshot as Record<string, unknown>)
      : {};
  await db
    .update(fixtures)
    .set({
      providerSnapshot: mergeProviderSnapshot(existing, {
        [SNAPSHOT_KEY]: {
          signature,
          refreshedAt: new Date().toISOString(),
        },
      }),
    })
    .where(eq(fixtures.id, fixtureId));
}

/**
 * After CMS Generate activates Live Commentary, keep the written feed in sync
 * when score/clock/events change. Does nothing until narrative lines exist.
 */
export async function refreshActivatedNarrativeCommentary(
  fixtureId: string,
  options?: { force?: boolean; syncProvider?: boolean },
): Promise<NarrativeLiveRefreshResult> {
  const existing = inFlight.get(fixtureId);
  if (existing) {
    return existing.then((result) =>
      result.reason === "rebuilt" ? result : { ...result, reason: "in_flight" as const },
    );
  }

  const run = (async (): Promise<NarrativeLiveRefreshResult> => {
    try {
      const activated = await isNarrativeCommentaryActivated(fixtureId);
      if (!activated) {
        return { activated: false, skipped: true, reason: "not_activated" };
      }

      const now = Date.now();
      const last = lastAttemptAt.get(fixtureId) ?? 0;
      if (!options?.force && now - last < MIN_ATTEMPT_INTERVAL_MS) {
        return { activated: true, skipped: true, reason: "throttled" };
      }
      lastAttemptAt.set(fixtureId, now);

      if (options?.syncProvider !== false) {
        await syncProviderFeedIfPossible(fixtureId);
      }

      const loaded = await loadRefreshState(fixtureId);
      if (!loaded) {
        return { activated: true, skipped: true, reason: "unchanged" };
      }

      const signature = buildNarrativeRefreshSignature(loaded.state);
      const stored = readStoredSignature(loaded.fixture.providerSnapshot);
      if (!options?.force && stored === signature) {
        return { activated: true, skipped: true, reason: "unchanged", signature };
      }

      const hasAudio = await fixtureHasAudioScripts(fixtureId);
      const result = await generateAndPublishMatchNarrativeCommentary(fixtureId, {
        replace: true,
        generateAudioScripts: hasAudio,
      });
      await persistRefreshSignature(fixtureId, signature);
      return {
        activated: true,
        skipped: false,
        reason: "rebuilt",
        created: result.created,
        signature,
      };
    } catch (error) {
      return {
        activated: true,
        skipped: true,
        reason: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  inFlight.set(fixtureId, run);
  try {
    return await run;
  } finally {
    inFlight.delete(fixtureId);
  }
}

async function syncProviderFeedIfPossible(fixtureId: string): Promise<void> {
  const loaded = await loadRefreshState(fixtureId);
  if (!loaded?.fixture.externalMatchId) return;

  const liveLike =
    isLiveFixtureStatus(loaded.fixture.status) ||
    /live|first|second|half/i.test(loaded.fixture.status) ||
    /live|first|second|half/i.test(loaded.fixture.period ?? "");
  // Also pull once after kick-off window when still scheduled but commentary is active.
  if (!liveLike && loaded.state.eventCount === 0 && loaded.state.matchMinute <= 0) {
    return;
  }

  const detail = await fetchSdmsMatchDetail(loaded.fixture.externalMatchId);
  if (!detail) return;

  await syncFixtureLiveStateFromSdms(fixtureId, detail);
  await syncSdmsLiveEventsFromDetail(fixtureId, detail.match_id, detail);
}

/** Record the post-Generate signature so the next poll does not rebuild immediately. */
export async function markNarrativeCommentaryFresh(fixtureId: string): Promise<void> {
  const loaded = await loadRefreshState(fixtureId);
  if (!loaded) return;
  await persistRefreshSignature(fixtureId, buildNarrativeRefreshSignature(loaded.state));
}

/** Latest narrative line minute — useful for tests / diagnostics. */
export async function latestNarrativeCommentaryMinute(fixtureId: string): Promise<number | null> {
  const db = getDb();
  const [row] = await db
    .select({ minute: matchCommentary.minute })
    .from(matchCommentary)
    .where(
      and(eq(matchCommentary.fixtureId, fixtureId), eq(matchCommentary.source, NARRATIVE_SOURCE)),
    )
    .orderBy(desc(matchCommentary.minute), desc(matchCommentary.publishedAt))
    .limit(1);
  return row?.minute ?? null;
}
