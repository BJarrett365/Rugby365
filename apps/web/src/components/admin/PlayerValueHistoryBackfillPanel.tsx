"use client";

import { useCallback, useEffect, useState } from "react";

type RangeOption = 6 | 12 | 24 | "career";

type PreviewPeriod = {
  monthKey: string;
  coveragePct: number;
  canCalculate: boolean;
  confidence: number;
  missingFactors: string[];
  skipReason: string | null;
  estimatedValueGbp: number | null;
};

type Preview = {
  periodsChecked: number;
  calculablePeriods: number;
  expectedSnapshots: number;
  avgConfidence: number | null;
  missingDataPeriods: string[];
  periods: PreviewPeriod[];
};

type Quality = {
  liveCount: number;
  backfilledCount: number;
  recalculatedCount: number;
  totalCount: number;
  earliest: string | null;
  latest: string | null;
  avgConfidence: number | null;
  coverage24mPct: number;
};

type Props = {
  playerId: string;
  onApplied?: () => void;
};

function formatGbp(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${n}`;
}

export function PlayerValueHistoryBackfillPanel({ playerId, onApplied }: Props) {
  const [range, setRange] = useState<RangeOption>(6);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [busy, setBusy] = useState<"preview" | "run" | "quality" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadQuality = useCallback(async () => {
    setBusy("quality");
    setError("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/value-history?view=quality`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load quality summary");
      setQuality(data.quality ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quality load failed");
    } finally {
      setBusy("");
    }
  }, [playerId]);

  useEffect(() => {
    void loadQuality();
  }, [loadQuality]);

  async function runPreview() {
    setBusy("preview");
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/value-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", range }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setPreview(data.preview ?? null);
      setMessage(
        `Preview ready: ${data.preview?.expectedSnapshots ?? 0} snapshot(s) expected from ${data.preview?.calculablePeriods ?? 0} calculable period(s).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy("");
    }
  }

  async function runBackfill() {
    if (
      !confirm(
        `Run BACKFILL VALUE HISTORY for ${range === "career" ? "CAREER" : `${range} MONTHS`}? This writes BACKFILLED snapshots only and will not overwrite LIVE.`,
      )
    ) {
      return;
    }
    setBusy("run");
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/value-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", range }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backfill failed");
      setQuality(data.result?.quality ?? null);
      setMessage(
        `Backfill complete: inserted ${data.result?.inserted ?? 0}, skipped ${data.result?.skipped ?? 0}.`,
      );
      // Refresh preview against new state
      const previewRes = await fetch(`/api/admin/players/${playerId}/value-history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", range }),
      });
      const previewData = await previewRes.json();
      if (previewRes.ok) setPreview(previewData.preview ?? null);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backfill failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="border-t border-white/10 pt-4 space-y-3">
      <div>
        <h4 className="font-semibold m-0 mb-1 text-sm uppercase tracking-wide">
          History: Backfill value history
        </h4>
        <p className="text-xs text-zinc-500 mt-0 mb-0">
          Reconstruct month-end market value snapshots from time-correct inputs. Preview first —
          never overwrites LIVE rows.
        </p>
      </div>

      {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}
      {message ? <p className="text-emerald-400 text-sm m-0">{message}</p> : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-xs text-zinc-400">Range</span>
          <select
            className="cms-select mt-1"
            value={String(range)}
            onChange={(e) => {
              const v = e.target.value;
              setRange(v === "career" ? "career" : (Number(v) as 6 | 12 | 24));
              setPreview(null);
            }}
          >
            <option value="6">6 MONTHS</option>
            <option value="12">12 MONTHS</option>
            <option value="24">24 MONTHS</option>
            <option value="career">CAREER</option>
          </select>
        </label>
        <button
          type="button"
          className="cms-btn cms-btn--secondary"
          disabled={busy !== ""}
          onClick={() => void runPreview()}
        >
          {busy === "preview" ? "Previewing…" : "Preview"}
        </button>
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={busy !== "" || !preview || (preview.expectedSnapshots ?? 0) < 1}
          onClick={() => void runBackfill()}
        >
          {busy === "run" ? "Running…" : "Run backfill"}
        </button>
      </div>

      {preview ? (
        <div className="rounded border border-zinc-800 px-3 py-2 text-sm space-y-2">
          <div className="grid gap-2 sm:grid-cols-4 text-xs">
            <div>
              <div className="text-zinc-500 uppercase">Periods checked</div>
              <div className="font-semibold">{preview.periodsChecked}</div>
            </div>
            <div>
              <div className="text-zinc-500 uppercase">Calculable</div>
              <div className="font-semibold">{preview.calculablePeriods}</div>
            </div>
            <div>
              <div className="text-zinc-500 uppercase">Expected snapshots</div>
              <div className="font-semibold text-emerald-300">{preview.expectedSnapshots}</div>
            </div>
            <div>
              <div className="text-zinc-500 uppercase">Avg confidence</div>
              <div className="font-semibold">
                {preview.avgConfidence != null
                  ? `${Math.round(preview.avgConfidence * 100)}%`
                  : "—"}
              </div>
            </div>
          </div>
          {preview.missingDataPeriods.length > 0 ? (
            <p className="text-xs text-zinc-500 m-0">
              Missing-data periods: {preview.missingDataPeriods.join(", ")}
            </p>
          ) : (
            <p className="text-xs text-zinc-500 m-0">No missing-data periods in range.</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 text-left">
                  <th className="py-1 pr-2">Month</th>
                  <th className="py-1 pr-2">Coverage</th>
                  <th className="py-1 pr-2">OK?</th>
                  <th className="py-1 pr-2">Est. value</th>
                  <th className="py-1">Skip / missing</th>
                </tr>
              </thead>
              <tbody>
                {preview.periods.map((p) => (
                  <tr key={p.monthKey} className="border-t border-zinc-900">
                    <td className="py-1 pr-2 font-medium">{p.monthKey}</td>
                    <td className="py-1 pr-2">{p.coveragePct}%</td>
                    <td className="py-1 pr-2">{p.canCalculate ? "YES" : "NO"}</td>
                    <td className="py-1 pr-2">{formatGbp(p.estimatedValueGbp)}</td>
                    <td className="py-1 text-zinc-500">
                      {p.skipReason ??
                        (p.missingFactors.length ? p.missingFactors.join(", ") : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {quality ? (
        <div className="rounded border border-zinc-800 px-3 py-2 text-xs grid gap-2 sm:grid-cols-3">
          <div>
            <div className="text-zinc-500 uppercase">LIVE</div>
            <div className="font-semibold text-sm">{quality.liveCount}</div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase">BACKFILLED</div>
            <div className="font-semibold text-sm">{quality.backfilledCount}</div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase">24m coverage</div>
            <div className="font-semibold text-sm">{quality.coverage24mPct}%</div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase">Earliest</div>
            <div className="font-semibold">
              {quality.earliest ? quality.earliest.slice(0, 10) : "—"}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase">Latest</div>
            <div className="font-semibold">
              {quality.latest ? quality.latest.slice(0, 10) : "—"}
            </div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase">Avg confidence</div>
            <div className="font-semibold">
              {quality.avgConfidence != null
                ? `${Math.round(quality.avgConfidence * 100)}%`
                : "—"}
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-zinc-600 m-0">
        Bulk admin filters stub: POST with action <code>bulk-stub</code> accepts playerIds /
        position / competitionId / range — per-player CMS run is the write path.
      </p>
    </div>
  );
}
