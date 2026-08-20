"use client";

import { useMemo, useState } from "react";
import type { CoachIntelligenceMetric } from "@/lib/coach-intelligence-engine";

type Props = {
  metrics: CoachIntelligenceMetric[] | null | undefined;
  modelVersion?: string | null;
  busy?: boolean;
  onRecalculate?: () => void;
};

function dash(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export function CoachCmsIntelligencePanel({
  metrics,
  modelVersion,
  busy,
  onRecalculate,
}: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rows = useMemo(() => metrics ?? [], [metrics]);
  const selected = rows.find((m) => m.key === openKey) ?? null;

  return (
    <div className="cms-card space-y-3 border border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold m-0">Coach Intelligence</h3>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            Deterministic scores from Rugby365 tenure data ({modelVersion ?? "coach-intelligence-v1"}).
            Score ≠ confidence.
          </p>
        </div>
        {onRecalculate ? (
          <button
            type="button"
            className="cms-btn cms-btn--primary text-xs"
            disabled={busy}
            onClick={onRecalculate}
          >
            {busy ? "Recalculating…" : "Recalculate Intelligence"}
          </button>
        ) : null}
      </div>

      {!rows.length ? (
        <p className="text-sm text-zinc-500 m-0">
          No intelligence scores yet — recalculate ratings after match data is linked.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-zinc-500 text-left">
              <tr>
                <th className="px-2 py-2 font-medium">METRIC</th>
                <th className="px-2 py-2 font-medium">SCORE</th>
                <th className="px-2 py-2 font-medium">CONFIDENCE</th>
                <th className="px-2 py-2 font-medium">MATCHES</th>
                <th className="px-2 py-2 font-medium">DATA COVERAGE</th>
                <th className="px-2 py-2 font-medium">WORLD RANK</th>
                <th className="px-2 py-2 font-medium">TREND</th>
                <th className="px-2 py-2 font-medium">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.key}
                  className="border-t border-zinc-800 cursor-pointer hover:bg-zinc-900/50"
                  onClick={() => setOpenKey(openKey === m.key ? null : m.key)}
                >
                  <td className="px-2 py-2 text-zinc-100 font-medium">{m.label}</td>
                  <td className="px-2 py-2 text-zinc-100">
                    {m.score != null ? Math.round(m.score) : "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-300">{m.confidence}%</td>
                  <td className="px-2 py-2 text-zinc-400">{m.sampleSize}</td>
                  <td className="px-2 py-2 text-zinc-400">{m.dataCoverage}%</td>
                  <td className="px-2 py-2 text-zinc-300">
                    {m.worldRank != null ? `#${m.worldRank}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-zinc-400">
                    {m.trend == null || m.trend === 0
                      ? "—"
                      : m.trend > 0
                        ? `↑${m.trend}`
                        : `↓${Math.abs(m.trend)}`}
                  </td>
                  <td className="px-2 py-2 text-zinc-400 uppercase">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="rounded border border-zinc-800 px-3 py-3 text-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="m-0 font-semibold text-zinc-100">{selected.label}</h4>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:underline"
              onClick={() => setOpenKey(null)}
            >
              Close
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div>
              <div className="text-zinc-500">Score</div>
              <div className="text-zinc-100 font-semibold">
                {selected.score != null ? selected.score : "—"}
              </div>
            </div>
            <div>
              <div className="text-zinc-500">Confidence</div>
              <div className="text-zinc-100">{selected.confidence}%</div>
            </div>
            <div>
              <div className="text-zinc-500">Coverage</div>
              <div className="text-zinc-100">{selected.dataCoverage}%</div>
            </div>
            <div>
              <div className="text-zinc-500">Matches used</div>
              <div className="text-zinc-100">{selected.sampleSize}</div>
            </div>
            <div>
              <div className="text-zinc-500">Period</div>
              <div className="text-zinc-100">{selected.period}</div>
            </div>
            <div>
              <div className="text-zinc-500">Model</div>
              <div className="text-zinc-100">{selected.modelVersion}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500 mb-1">Components</div>
            <div className="grid gap-1 sm:grid-cols-2 text-xs">
              {Object.entries(selected.components).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-zinc-900 py-0.5">
                  <span className="text-zinc-400">{k.replace(/_/g, " ")}</span>
                  <span className="text-zinc-100">{dash(v)}</span>
                </div>
              ))}
              {!Object.keys(selected.components).length ? (
                <span className="text-zinc-500">No component breakdown</span>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            <div>
              <div className="text-zinc-500 mb-1">Available inputs</div>
              <div className="text-zinc-300">
                {selected.availableInputs.length
                  ? selected.availableInputs.join(", ")
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">Missing inputs</div>
              <div className="text-amber-300/90">
                {selected.missingInputs.length ? selected.missingInputs.join(", ") : "None"}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500">
            Last calculated: {selected.calculatedAt}
          </div>
        </div>
      ) : (
        <p className="text-xs text-zinc-500 m-0">Click a metric for calculation drilldown.</p>
      )}
    </div>
  );
}
