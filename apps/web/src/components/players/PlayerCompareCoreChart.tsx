"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompareMetric } from "@/lib/player-compare-metrics";
import type { CompareLitePlayer } from "@/lib/player-compare-lite-types";
import { formatGbpCompact } from "@/lib/player-value-math";
import type { MarketValueTimelinePoint } from "@/lib/player-market-value-trend-utils";
import type { ValueTimelineSummary } from "@/lib/player-value-timeline-utils";

type ValueTimelinePayload = {
  displayPoints: MarketValueTimelinePoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  summary: ValueTimelineSummary;
};

type ComparePayload = {
  playerA: CompareLitePlayer;
  playerB: CompareLitePlayer;
  metrics: CompareMetric[];
  valueTimelineA: ValueTimelinePayload;
  valueTimelineB: ValueTimelinePayload;
};

type Scope = "career" | "season";

type StatRow = {
  key: string;
  label: string;
  a: number | null;
  b: number | null;
  format?: "gbp" | "number" | "rating";
  higherIsBetter?: boolean;
};

/** Missing / unknown compare values display as 0. */
function nz(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? value : 0;
}

function fmtStat(value: number | null, format: StatRow["format"] = "number"): string {
  const n = nz(value);
  if (format === "gbp") return formatGbpCompact(n);
  if (format === "rating") return n.toFixed(1);
  if (Number.isInteger(n)) return n.toLocaleString("en-GB");
  return n.toFixed(1);
}

function pctDiff(a: number | null, b: number | null, higherIsBetter = true): number | null {
  const av = nz(a);
  const bv = nz(b);
  if (bv === 0) return av === 0 ? 0 : null;
  const raw = ((av - bv) / Math.abs(bv)) * 100;
  return Math.round((higherIsBetter ? raw : -raw) * 10) / 10;
}

function formatPct(pct: number | null): string {
  if (pct == null) return "—";
  if (pct === 0) return "0%";
  return pct > 0 ? `+${Math.round(pct)}%` : `${Math.round(pct)}%`;
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function buildStatRows(
  scope: Scope,
  playerA: CompareLitePlayer,
  playerB: CompareLitePlayer,
  metrics: CompareMetric[],
): StatRow[] {
  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const sa = playerA.season;
  const sb = playerB.season;

  if (scope === "season") {
    return [
      { key: "points", label: "Points", a: nz(sa.points), b: nz(sb.points) },
      { key: "tries", label: "Tries", a: nz(sa.tries), b: nz(sb.tries) },
      { key: "metres", label: "Metres", a: nz(sa.metres), b: nz(sb.metres) },
      { key: "tackles", label: "Tackles", a: nz(sa.tackles), b: nz(sb.tackles) },
      {
        key: "turnovers",
        label: "Turnovers Won",
        a: nz(sa.turnoversWon),
        b: nz(sb.turnoversWon),
      },
      { key: "apps", label: "Appearances", a: nz(sa.appearances), b: nz(sb.appearances) },
      { key: "assists", label: "Try Assists", a: nz(sa.tryAssists), b: nz(sb.tryAssists) },
      {
        key: "market",
        label: "Market Value",
        a: nz(playerA.marketValueGbp),
        b: nz(playerB.marketValueGbp),
        format: "gbp",
      },
    ];
  }

  return [
    { key: "points", label: "Points", a: nz(playerA.career.points), b: nz(playerB.career.points) },
    { key: "tries", label: "Tries", a: nz(playerA.career.tries), b: nz(playerB.career.tries) },
    {
      key: "conversions",
      label: "Conversions",
      a: nz(playerA.career.conversions),
      b: nz(playerB.career.conversions),
    },
    {
      key: "penalties",
      label: "Penalties",
      a: nz(playerA.career.penalties),
      b: nz(playerB.career.penalties),
    },
    {
      key: "dropGoals",
      label: "Drop Goals",
      a: nz(playerA.career.dropGoals),
      b: nz(playerB.career.dropGoals),
    },
    {
      key: "metres",
      label: "Metres",
      a: nz(byKey.get("metres")?.a ?? playerA.career.metres),
      b: nz(byKey.get("metres")?.b ?? playerB.career.metres),
    },
    {
      key: "tackles",
      label: "Tackles",
      a: nz(byKey.get("tackles")?.a ?? playerA.career.tackles),
      b: nz(byKey.get("tackles")?.b ?? playerB.career.tackles),
    },
    {
      key: "turnovers",
      label: "Turnovers Won",
      a: nz(byKey.get("turnovers")?.a ?? playerA.career.turnoversWon),
      b: nz(byKey.get("turnovers")?.b ?? playerB.career.turnoversWon),
    },
    {
      key: "apps",
      label: "Appearances",
      a: nz(playerA.career.appearances),
      b: nz(playerB.career.appearances),
    },
    { key: "caps", label: "Intl Caps", a: nz(playerA.caps), b: nz(playerB.caps) },
    {
      key: "market",
      label: "Market Value",
      a: nz(playerA.marketValueGbp),
      b: nz(playerB.marketValueGbp),
      format: "gbp",
    },
  ];
}

export function PlayerCompareCoreChart({
  slugA,
  slugB,
  nameA,
  nameB,
}: {
  slugA: string;
  slugB: string;
  nameA?: string;
  nameB?: string;
}) {
  const [data, setData] = useState<ComparePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("career");

  useEffect(() => {
    const a = slugA.trim();
    const b = slugB.trim();
    if (!a || !b || a === b) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/players/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as ComparePayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load comparison");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e instanceof Error ? e.message : "Failed to load comparison");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slugA, slugB]);

  const labelA = nameA || data?.playerA.name || slugA;
  const labelB = nameB || data?.playerB.name || slugB;
  const shortA = firstName(labelA);
  const shortB = firstName(labelB);

  const rows = useMemo(() => {
    if (!data) return [];
    return buildStatRows(scope, data.playerA, data.playerB, data.metrics);
  }, [data, scope]);

  const updatedLabel = useMemo(() => {
    const iso =
      data?.valueTimelineA.summary.currentIso ??
      data?.valueTimelineB.summary.currentIso ??
      null;
    return iso ? formatDateShort(iso) : null;
  }, [data]);

  if (!slugA || !slugB || slugA === slugB) return null;

  return (
    <section className="pr-compare-shot" aria-label="Core stats comparison">
      <header className="pr-compare-shot__header">
        <div>
          <p className="pr-compare-shot__kicker">Core stats comparison</p>
          <h2>
            {labelA} vs {labelB}
          </h2>
          <p className="pr-compare-shot__sub">
            Side-by-side {scope === "career" ? "career totals" : "season totals"}
          </p>
        </div>
        <label className="pr-compare-shot__scope">
          <span className="sr-only">Comparison scope</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="career">Career Totals</option>
            <option value="season">Season Totals</option>
          </select>
        </label>
      </header>

      <div className="pr-compare-shot__pills">
        <span className="pr-compare-shot__pill pr-compare-shot__pill--a">{labelA}</span>
        <span className="pr-compare-shot__pill pr-compare-shot__pill--b">{labelB}</span>
      </div>

      {loading ? <p className="pr-compare-shot__empty">Loading comparison…</p> : null}
      {error ? <p className="pr-compare-shot__error">{error}</p> : null}

      {data ? (
        <>
          <div className="pr-compare-shot__stats-head">
            <h3>
              Stat comparison <em>({scope === "career" ? "Career Totals" : "Season Totals"})</em>
            </h3>
            <div className="pr-compare-shot__line-legend">
              <span>
                <i className="pr-compare-shot__swatch pr-compare-shot__swatch--a" /> {shortA}
              </span>
              <span>
                <i className="pr-compare-shot__swatch pr-compare-shot__swatch--b" /> {shortB}
              </span>
              <span>
                <i className="pr-compare-shot__swatch pr-compare-shot__swatch--diff" /> % Difference
              </span>
            </div>
          </div>

          <div className="pr-compare-shot__grid">
            {rows.map((row) => {
              const max = Math.max(row.a ?? 0, row.b ?? 0, 1);
              const aPct = row.a != null && row.a > 0 ? Math.max(4, (row.a / max) * 100) : 0;
              const bPct = row.b != null && row.b > 0 ? Math.max(4, (row.b / max) * 100) : 0;
              const diff = pctDiff(row.a, row.b, row.higherIsBetter !== false);
              return (
                <article key={row.key} className="pr-compare-shot__tile">
                  <header>
                    <h4>{row.label}</h4>
                  </header>
                  <div className="pr-compare-shot__tile-vals">
                    <strong className="is-a">{fmtStat(row.a, row.format)}</strong>
                    <strong className="is-b">{fmtStat(row.b, row.format)}</strong>
                  </div>
                  <div className="pr-compare-shot__bars">
                    <div className="pr-compare-shot__bar-track">
                      <span
                        className="pr-compare-shot__bar-fill is-a"
                        style={{ width: `${aPct}%` }}
                      />
                    </div>
                    <div className="pr-compare-shot__bar-track">
                      <span
                        className="pr-compare-shot__bar-fill is-b"
                        style={{ width: `${bPct}%` }}
                      />
                    </div>
                  </div>
                  <p
                    className={`pr-compare-shot__diff${
                      diff != null && diff > 0 ? " is-up" : diff != null && diff < 0 ? " is-down" : ""
                    }`}
                  >
                    {formatPct(diff)}
                  </p>
                </article>
              );
            })}
          </div>

          <p className="pr-compare-shot__footnote">
            All values are approximate and based on available data.
            {updatedLabel ? ` Last updated: ${updatedLabel}.` : null}
          </p>
        </>
      ) : null}
    </section>
  );
}
