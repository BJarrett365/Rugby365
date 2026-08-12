"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { PlayerComparisonCardModel } from "@/lib/player-comparison-service";

type SearchHit = {
  slug: string;
  name: string;
  positionName: string | null;
  clubName: string | null;
  imageUrl: string | null;
};

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  return (
    <div className="pr-player-v2__cmp-avatar">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" />
      ) : (
        <span aria-hidden>{name.slice(0, 1)}</span>
      )}
    </div>
  );
}

function PeerPicker({
  leftSlug,
  currentSlug,
  currentName,
}: {
  leftSlug: string;
  currentSlug: string | null;
  currentName: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/players/search?q=${encodeURIComponent(q)}&pageSize=12`,
            { cache: "no-store" },
          );
          const json = (await res.json().catch(() => ({}))) as { rows?: SearchHit[] };
          if (cancelled) return;
          setHits((json.rows ?? []).filter((r) => r.slug && r.slug !== leftSlug));
        } catch {
          if (!cancelled) setHits([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, leftSlug]);

  function selectPeer(slug: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", slug);
    startTransition(() => {
      router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
    });
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="pr-player-v2__cmp-picker">
      <button
        type="button"
        className="pr-player-v2__cmp-picker-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{currentName ?? "Select peer"}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="pr-player-v2__cmp-picker-menu" role="listbox">
          <input
            type="search"
            value={query}
            placeholder="Search player…"
            className="pr-player-v2__cmp-picker-input"
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading ? (
            <p className="pr-player-v2__cmp-picker-empty">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="pr-player-v2__cmp-picker-empty">
              {query.trim().length < 2 ? "Type at least 2 letters" : "No players found"}
            </p>
          ) : (
            <ul>
              {hits.map((hit) => (
                <li key={hit.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={hit.slug === currentSlug}
                    onClick={() => selectPeer(hit.slug)}
                  >
                    {hit.name}
                    {hit.positionName ? ` · ${hit.positionName}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export type PlayerComparisonCardProps = {
  comparison: PlayerComparisonCardModel;
};

/** PLAYER COMPARISON widget — metrics from PlayerIntelligence dims. */
export function PlayerComparisonCard({ comparison }: PlayerComparisonCardProps) {
  const { left, right, metrics, peerSubtitle, fullCompareHref } = comparison;

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card pr-player-v2__cmp-card">
      <div className="pr-player-v2__card-head">
        <h2>
          Player Comparison
          <span className="pr-player-v2__card-head-muted">({peerSubtitle})</span>
        </h2>
      </div>

      <div className="pr-player-v2__cmp-heads">
        <div className="pr-player-v2__cmp-head pr-player-v2__cmp-head--left">
          <Avatar name={left.name} imageUrl={left.imageUrl} />
          <span className="pr-player-v2__cmp-name">{left.name}</span>
        </div>
        <div className="pr-player-v2__cmp-head pr-player-v2__cmp-head--right">
          {right ? (
            <>
              <PeerPicker
                leftSlug={left.slug}
                currentSlug={right.slug}
                currentName={right.name}
              />
              <Avatar name={right.name} imageUrl={right.imageUrl} />
            </>
          ) : (
            <span className="pr-player-v2__empty">No peer yet</span>
          )}
        </div>
      </div>

      <div className="pr-player-v2__cmp-rows" role="table" aria-label="Comparison metrics">
        {metrics.map((row) => {
          const leftPct = row.left != null ? Math.max(0, Math.min(100, row.left)) : 0;
          const rightPct = row.right != null ? Math.max(0, Math.min(100, row.right)) : 0;
          return (
            <div key={row.key} className="pr-player-v2__cmp-row" role="row">
              <span className="pr-player-v2__cmp-val pr-player-v2__cmp-val--left" role="cell">
                {row.left != null ? row.left : "—"}
              </span>
              <div className="pr-player-v2__cmp-bar-wrap pr-player-v2__cmp-bar-wrap--left" role="cell">
                <div
                  className="pr-player-v2__cmp-bar pr-player-v2__cmp-bar--left"
                  style={{ width: row.left != null ? `${leftPct}%` : "0%" }}
                />
              </div>
              <span className="pr-player-v2__cmp-label" role="cell">
                {row.label}
              </span>
              <div className="pr-player-v2__cmp-bar-wrap pr-player-v2__cmp-bar-wrap--right" role="cell">
                <div
                  className="pr-player-v2__cmp-bar pr-player-v2__cmp-bar--right"
                  style={{ width: row.right != null ? `${rightPct}%` : "0%" }}
                />
              </div>
              <span className="pr-player-v2__cmp-val pr-player-v2__cmp-val--right" role="cell">
                {row.right != null ? row.right : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <Link className="pr-player-v2__cmp-link" href={fullCompareHref}>
        View full comparison &gt;
      </Link>
    </div>
  );
}
