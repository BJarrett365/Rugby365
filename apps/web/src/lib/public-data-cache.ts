/**
 * Process-local public page cache with TTL + singleflight.
 *
 * Used for heavy public read models (player overview, rankings filters,
 * tables hub, fixtures schedule, player directory). Survives across
 * requests in the Next.js Node process; pair with React `cache()` for
 * same-request dedupe (metadata + page).
 *
 * Loaders are detached from the caller microtask so a client disconnect
 * is less likely to cancel shared in-flight work other navigations need.
 */
type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  inflight?: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_SECONDS = 60;

/**
 * Netlify's Next plugin sets `Netlify-Vary` to RSC query keys only
 * (`_rsc`, `__nextDataReq`). Without this, `/api/fixtures/schedule?date=`
 * and `/api/fixtures/dates?start=` share one CDN body — every day shows
 * today's empty list.
 */
export function publicJsonCacheHeaders(ttlSeconds: number, swrSeconds?: number): HeadersInit {
  const swr = swrSeconds ?? ttlSeconds * 2;
  return {
    "Cache-Control": `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${swr}`,
    "Netlify-Vary": "query",
  };
}

export const PUBLIC_CACHE_TTL = {
  playerOverview: 120,
  playerDirectory: 60,
  rankingsBoard: 120,
  rankingsFilters: 300,
  tablesHub: 120,
  fixturesSchedule: 30,
  fixturesMeta: 120,
  /** Finished / historic competition tables (slow live calc). */
  competitionTableHistoric: 300,
  /** Current / active season live tables. */
  competitionTableLive: 45,
  /** Synced standings + hub payloads. */
  competitionStandings: 120,
  competitionHub: 90,
} as const;

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; code?: string; message?: string };
  return (
    e.name === "AbortError" ||
    e.code === "ABORT_ERR" ||
    /aborted|abort/i.test(e.message ?? "")
  );
}

export async function cachedPublic<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const ttl = Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_TTL_SECONDS;
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }
  if (existing?.inflight) {
    return existing.inflight;
  }

  const inflight = new Promise<T>((resolve, reject) => {
    setImmediate(() => {
      Promise.resolve()
        .then(() => loader())
        .then((value) => {
          store.set(key, { expiresAt: Date.now() + ttl * 1000, value });
          resolve(value);
        })
        .catch((error) => {
          const cur = store.get(key) as CacheEntry<T> | undefined;
          if (cur?.inflight && cur.value === undefined) {
            store.delete(key);
          }
          reject(error);
        });
    });
  });

  store.set(key, { expiresAt: 0, inflight });
  return inflight;
}

/** Drop cached entries. Pass a prefix to invalidate a family (e.g. `player-overview:`). */
export function invalidatePublicCache(prefix?: string): number {
  if (!prefix) {
    const n = store.size;
    store.clear();
    return n;
  }
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function publicCacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: [...store.keys()].slice(0, 50) };
}
