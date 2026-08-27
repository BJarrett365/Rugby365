"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ComparePlayersResult } from "@/components/players/ComparePlayersResult";

type SearchHit = {
  slug: string;
  name: string;
  position: string | null;
  clubName: string | null;
};

type Side = "a" | "b";

type SideState = {
  playerSlug: string;
  picked: SearchHit | null;
};

type Props = {
  /** Used for the “back to stats” link on competition compare pages. */
  competitionSlug?: string;
  competitionName?: string;
  /** Prefill from /players/compare?player1=&player2= (or legacy player/opponent). */
  initialPlayerA?: string | null;
  initialPlayerB?: string | null;
  /**
   * When true (profile → compare?player=slug), Player A is fixed — only show an opponent picker.
   */
  anchoredMode?: boolean;
  anchoredDisplayName?: string | null;
};

function emptySide(): SideState {
  return { playerSlug: "", picked: null };
}

function playerLabel(p: {
  name: string;
  position?: string | null;
  clubName?: string | null;
}): string {
  const bits = [p.name];
  if (p.position?.trim()) bits.push(p.position.trim());
  if (p.clubName?.trim()) bits.push(p.clubName.trim());
  return bits.join(" · ");
}

function PlayerSearchField({
  otherSlug,
  selectedSlug,
  onPick,
  label,
}: {
  otherSlug: string;
  selectedSlug: string;
  onPick: (hit: SearchHit) => void;
  label: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    setLoading(true);
    setPage(1);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ pageSize: "100", page: "1" });
          if (q.length >= 2) params.set("q", q);
          else params.set("browse", "1");
          const res = await fetch(`/api/players/search?${params}`, { cache: "no-store" });
          const json = (await res.json().catch(() => ({}))) as {
            rows?: Array<{
              slug: string;
              name: string;
              positionName: string | null;
              clubName: string | null;
            }>;
            total?: number;
          };
          if (cancelled) return;
          setHits(
            (json.rows ?? [])
              .filter((r) => r.slug && r.slug !== otherSlug)
              .map((r) => ({
                slug: r.slug,
                name: r.name,
                position: r.positionName,
                clubName: r.clubName,
              })),
          );
          setTotal(typeof json.total === "number" ? json.total : 0);
        } catch {
          if (!cancelled) {
            setHits([]);
            setTotal(0);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, q.length >= 2 ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, otherSlug]);

  const loadMore = () => {
    const q = query.trim();
    const nextPage = page + 1;
    setLoadingMore(true);
    void (async () => {
      try {
        const params = new URLSearchParams({
          pageSize: "100",
          page: String(nextPage),
        });
        if (q.length >= 2) params.set("q", q);
        else params.set("browse", "1");
        const res = await fetch(`/api/players/search?${params}`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          rows?: Array<{
            slug: string;
            name: string;
            positionName: string | null;
            clubName: string | null;
          }>;
          total?: number;
        };
        setHits((prev) => {
          const seen = new Set(prev.map((h) => h.slug));
          const extra = (json.rows ?? [])
            .filter((r) => r.slug && r.slug !== otherSlug && !seen.has(r.slug))
            .map((r) => ({
              slug: r.slug,
              name: r.name,
              position: r.positionName,
              clubName: r.clubName,
            }));
          return [...prev, ...extra];
        });
        if (typeof json.total === "number") setTotal(json.total);
        setPage(nextPage);
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  const canLoadMore = !loading && hits.length < total;

  return (
    <div ref={wrapRef} className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--pr-mc-muted)]">{label}</span>
        <input
          type="search"
          value={query}
          placeholder="Search by name…"
          autoComplete="off"
          className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] placeholder:text-[var(--pr-mc-grey)]"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="max-h-72 overflow-auto rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)]">
        {loading ? (
          <p className="m-0 px-3 py-2 text-sm text-[var(--pr-mc-muted)]">Loading players…</p>
        ) : hits.length === 0 ? (
          <p className="m-0 px-3 py-2 text-sm text-[var(--pr-mc-muted)]">No players found.</p>
        ) : (
          <ul className="m-0 list-none p-1">
            {hits.map((hit) => {
              const selected = hit.slug === selectedSlug;
              return (
                <li key={hit.slug}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--pr-mc-panel)] ${
                      selected
                        ? "bg-[var(--pr-mc-panel)] text-[var(--pr-mc-text)] font-medium"
                        : "text-[var(--pr-mc-text)]"
                    }`}
                    onClick={() => onPick(hit)}
                  >
                    {playerLabel(hit)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {canLoadMore ? (
          <div className="border-t border-[var(--pr-mc-border)] p-2">
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-sm text-[var(--pr-mc-link,#54b989)] hover:underline disabled:opacity-50"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? "Loading…" : `Show more (${hits.length} of ${total})`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ComparePlayersPicker({
  competitionSlug,
  initialPlayerA,
  initialPlayerB,
  anchoredMode = false,
  anchoredDisplayName = null,
}: Props) {
  const hubSlug = competitionSlug?.trim() ?? "";

  const [sideA, setSideA] = useState<SideState>(() => emptySide());
  const [sideB, setSideB] = useState<SideState>(() => emptySide());
  const [initialHydrated, setInitialHydrated] = useState(false);

  useEffect(() => {
    if (initialHydrated) return;
    const a = initialPlayerA?.trim() || "";
    const b = initialPlayerB?.trim() || "";
    if (!a && !b) {
      setInitialHydrated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      async function resolveSlug(slug: string): Promise<SearchHit | null> {
        const q = slug.replace(/-/g, " ").trim();
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(q.length >= 2 ? q : slug)}&pageSize=48`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as {
          rows?: Array<{
            slug: string;
            name: string;
            positionName: string | null;
            clubName: string | null;
          }>;
        };
        const hit = (json.rows ?? []).find((r) => r.slug === slug || r.slug.startsWith(`${slug}-`));
        if (!hit) {
          return {
            slug,
            name:
              slug
                .split("-")
                .filter((p) => !/^[a-z0-9]{6,}$/i.test(p))
                .join(" ")
                .replace(/\b\w/g, (c) => c.toUpperCase()) || slug,
            position: null,
            clubName: null,
          };
        }
        return {
          slug: hit.slug,
          name: hit.name,
          position: hit.positionName,
          clubName: hit.clubName,
        };
      }

      try {
        const [hitA, hitB] = await Promise.all([
          a ? resolveSlug(a) : Promise.resolve(null),
          b ? resolveSlug(b) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (hitA) {
          setSideA({ playerSlug: hitA.slug, picked: hitA });
        }
        if (hitB) {
          setSideB({ playerSlug: hitB.slug, picked: hitB });
        }
      } finally {
        if (!cancelled) setInitialHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPlayerA, initialPlayerB, initialHydrated]);

  const canCompare = Boolean(
    sideA.playerSlug && sideB.playerSlug && sideA.playerSlug !== sideB.playerSlug,
  );

  const pickFromSearch = (side: Side, hit: SearchHit) => {
    const next: SideState = { playerSlug: hit.slug, picked: hit };
    if (side === "a") setSideA(next);
    else setSideB(next);
  };

  const renderSide = (side: Side) => {
    const state = side === "a" ? sideA : sideB;
    const other = side === "a" ? sideB : sideA;
    const heading =
      anchoredMode && side === "b" ? "Player B" : `Player ${side.toUpperCase()}`;

    return (
      <div className="rounded-xl border border-[var(--pr-mc-border)] bg-[var(--pr-mc-panel)] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pr-mc-grey)] m-0">
          {heading}
        </p>

        <PlayerSearchField
          otherSlug={other.playerSlug}
          selectedSlug={state.playerSlug}
          label="Search players"
          onPick={(hit) => pickFromSearch(side, hit)}
        />

        {state.playerSlug && state.picked ? (
          <p className="m-0 text-xs text-[var(--pr-mc-muted)]">
            Selected:{" "}
            <span className="text-[var(--pr-mc-text)]">{playerLabel(state.picked)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {anchoredMode ? (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          Comparing against{" "}
          <strong className="text-[var(--pr-mc-text)]">
            {anchoredDisplayName || sideA.picked?.name || initialPlayerA}
          </strong>
          . Search or pick Player B from the list.
        </p>
      ) : (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          Pick Player A and Player B from the lists — search by name if you need to narrow them
          down.
        </p>
      )}

      {anchoredMode ? (
        <div className="grid gap-4 max-w-xl">{renderSide("b")}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {renderSide("a")}
          {renderSide("b")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canCompare ? (
          <Link
            href={`/players/compare?player=${encodeURIComponent(sideA.playerSlug)}&opponent=${encodeURIComponent(sideB.playerSlug)}`}
            className="cms-btn cms-btn--primary touch-target"
          >
            Open full compare
          </Link>
        ) : (
          <button type="button" className="cms-btn cms-btn--primary touch-target" disabled>
            {anchoredMode ? "Select an opponent" : "Select two players to compare"}
          </button>
        )}
        {sideA.playerSlug && sideB.playerSlug && sideA.playerSlug === sideB.playerSlug ? (
          <p className="m-0 text-sm text-amber-200">Pick two different players.</p>
        ) : null}
        {hubSlug ? (
          <Link
            href={`/competitions/${encodeURIComponent(hubSlug)}/stats`}
            className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline"
          >
            Back to player stats
          </Link>
        ) : anchoredMode && initialPlayerA ? (
          <Link
            href={`/players/${encodeURIComponent(initialPlayerA)}`}
            className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline"
          >
            Back to profile
          </Link>
        ) : (
          <Link href="/players" className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline">
            Browse all players
          </Link>
        )}
      </div>

      {canCompare ? (
        <ComparePlayersResult slugA={sideA.playerSlug} slugB={sideB.playerSlug} />
      ) : null}
    </div>
  );
}
