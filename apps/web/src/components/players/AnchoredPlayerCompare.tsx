"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerCompareCoreChart } from "@/components/players/PlayerCompareCoreChart";
import type { CompareLiteCard } from "@/lib/player-compare-lite-types";

export type AnchoredCompareCard = CompareLiteCard;

type SearchHit = {
  slug: string;
  name: string;
  positionName: string | null;
  clubName: string | null;
  imageUrl: string | null;
};

function profileEmbedSrc(slug: string, compareWith?: string | null): string {
  const params = new URLSearchParams({ embed: "1" });
  if (compareWith && compareWith !== slug) params.set("compareWith", compareWith);
  return `/players/${slug}?${params.toString()}`;
}

function PlayerSearchOnly({
  excludeSlug,
  onPick,
}: {
  excludeSlug: string;
  onPick: (hit: SearchHit) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [roster, setRoster] = useState<SearchHit[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRosterLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/players/search?browse=1&pageSize=100`, {
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as { rows?: SearchHit[] };
        if (cancelled) return;
        setRoster((json.rows ?? []).filter((r) => r.slug !== excludeSlug));
      } catch {
        if (!cancelled) setRoster([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludeSlug]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchLoading(false);
      return;
    }

    const local = roster
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 16);
    if (local.length >= 8) {
      setHits(local);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/players/search?q=${encodeURIComponent(q)}&pageSize=24`,
            { cache: "no-store" },
          );
          const json = (await res.json().catch(() => ({}))) as { rows?: SearchHit[] };
          if (cancelled) return;
          const remote = (json.rows ?? []).filter((r) => r.slug !== excludeSlug);
          const bySlug = new Map<string, SearchHit>();
          for (const hit of [...local, ...remote]) bySlug.set(hit.slug, hit);
          setHits([...bySlug.values()].slice(0, 20));
        } catch {
          if (!cancelled) setHits(local);
        } finally {
          if (!cancelled) setSearchLoading(false);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, excludeSlug, roster]);

  const q = query.trim().toLowerCase();
  const visible =
    q.length >= 2
      ? hits
      : roster.filter((p) => !q || p.name.toLowerCase().includes(q));

  const pick = (hit: SearchHit) => {
    onPick(hit);
    setQuery("");
    setHits([]);
  };

  return (
    <div ref={wrapRef} className="pr-compare-duo__search">
      <label className="pr-compare-duo__search-label">
        <span>Choose opponent</span>
        <input
          type="search"
          value={query}
          placeholder="Search players…"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="pr-compare-duo__roster" role="listbox" aria-label="Players">
        {rosterLoading ? (
          <p className="pr-compare-duo__search-empty">Loading players…</p>
        ) : searchLoading && visible.length === 0 ? (
          <p className="pr-compare-duo__search-empty">Searching…</p>
        ) : visible.length === 0 ? (
          <p className="pr-compare-duo__search-empty">No players found.</p>
        ) : (
          <ul>
            {visible.map((hit) => (
              <li key={hit.slug}>
                <button type="button" onClick={() => pick(hit)}>
                  {hit.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={hit.imageUrl} alt="" className="pr-compare-duo__roster-thumb" />
                  ) : (
                    <span className="pr-compare-duo__roster-thumb is-empty" aria-hidden>
                      {hit.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="pr-compare-duo__roster-text">
                    <span className="pr-compare-duo__search-name">{hit.name}</span>
                    <span className="pr-compare-duo__search-meta">
                      {[hit.positionName, hit.clubName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProfilePane({
  slug,
  label,
  compareWith,
  headerRight,
}: {
  slug: string;
  label: string;
  compareWith?: string | null;
  headerRight?: ReactNode;
}) {
  return (
    <div className="pr-compare-frames__pane">
      <div className="pr-compare-frames__pane-head">
        <strong>{label}</strong>
        {headerRight}
      </div>
      <div className="pr-compare-frames__scroll">
        <iframe
          title={`${label} profile`}
          src={profileEmbedSrc(slug, compareWith)}
          className="pr-compare-frames__iframe"
        />
      </div>
    </div>
  );
}

export function AnchoredPlayerCompare({
  anchored,
  initialOpponentSlug = null,
}: {
  anchored: AnchoredCompareCard;
  initialOpponentSlug?: string | null;
  /** Kept for page compatibility; full profiles load via embed iframes. */
  initialOpponent?: AnchoredCompareCard | null;
}) {
  const router = useRouter();
  const [opponentSlug, setOpponentSlug] = useState(initialOpponentSlug?.trim() || "");
  const [opponentName, setOpponentName] = useState("");

  useEffect(() => {
    setOpponentSlug(initialOpponentSlug?.trim() || "");
  }, [initialOpponentSlug]);

  useEffect(() => {
    const b = opponentSlug.trim();
    if (!b || b === anchored.slug) {
      setOpponentName("");
      return;
    }
    if (opponentName) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(b.replace(/-/g, " "))}&pageSize=24`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as { rows?: SearchHit[] };
        const hit = (json.rows ?? []).find((r) => r.slug === b);
        if (!cancelled && hit) setOpponentName(hit.name);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opponentSlug, anchored.slug, opponentName]);

  const pickOpponent = (hit: SearchHit) => {
    setOpponentSlug(hit.slug);
    setOpponentName(hit.name);
    const params = new URLSearchParams();
    params.set("player", anchored.slug);
    params.set("opponent", hit.slug);
    router.replace(`/players/compare?${params.toString()}`, { scroll: false });
  };

  const clearOpponent = () => {
    setOpponentSlug("");
    setOpponentName("");
    router.replace(`/players/compare?player=${encodeURIComponent(anchored.slug)}`, {
      scroll: false,
    });
  };

  const hasOpponent = Boolean(opponentSlug && opponentSlug !== anchored.slug);

  return (
    <div className="pr-compare-frames-wrap">
      <div className="pr-compare-frames">
        <ProfilePane
          slug={anchored.slug}
          label={anchored.displayName}
          compareWith={hasOpponent ? opponentSlug : null}
        />

        {hasOpponent ? (
          <ProfilePane
            slug={opponentSlug}
            label={opponentName || opponentSlug}
            compareWith={anchored.slug}
            headerRight={
              <button type="button" className="pr-compare-duo__change" onClick={clearOpponent}>
                Change opponent
              </button>
            }
          />
        ) : (
          <div className="pr-compare-frames__pane pr-compare-frames__pane--pick">
            <div className="pr-compare-frames__pane-head">
              <strong>Compare against</strong>
            </div>
            <div className="pr-compare-duo__panel pr-compare-duo__panel--pick">
              <p className="pr-compare-duo__pick-copy">
                Pick a player already on Rugby365 — both profiles keep Overview, Stats, Career,
                Performance, Intelligence, Rating, Comparison and News so you can scroll and
                compare side by side.
              </p>
              <PlayerSearchOnly excludeSlug={anchored.slug} onPick={pickOpponent} />
              <p className="pr-compare-duo__foot">
                <Link href={`/players/${anchored.slug}`}>
                  Back to {anchored.displayName} profile →
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>

      {hasOpponent ? (
        <PlayerCompareCoreChart
          slugA={anchored.slug}
          slugB={opponentSlug}
          nameA={anchored.displayName}
          nameB={opponentName || undefined}
        />
      ) : null}
    </div>
  );
}
