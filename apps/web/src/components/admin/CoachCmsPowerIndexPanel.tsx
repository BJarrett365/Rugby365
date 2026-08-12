"use client";

import { useMemo } from "react";
import type { CoachPowerIndexResult } from "@/lib/coach-power-index-engine";

type Props = {
  powerIndex: number | null | undefined;
  previousPowerIndex?: number | null;
  powerIndexChange?: number | null;
  detail?: CoachPowerIndexResult | null;
  mismatches?: Array<{
    key: string;
    intelligenceScore: number;
    powerIndexScore: number;
  }> | null;
  modelVersion?: string | null;
  lastCalculated?: string | null;
  busy?: boolean;
  onRecalculate?: () => void;
};

function dash(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function signed(n: number | null | undefined): string {
  if (n == null) return "—";
  return n > 0 ? `+${n}` : String(n);
}

export function CoachCmsPowerIndexPanel({
  powerIndex,
  previousPowerIndex,
  powerIndexChange,
  detail,
  mismatches,
  modelVersion,
  lastCalculated,
  busy,
  onRecalculate,
  publicSlug,
}: Props & { publicSlug?: string | null }) {
  const inputs = useMemo(() => detail?.contributions ?? [], [detail]);
  const modifiers = useMemo(() => detail?.modifiers ?? [], [detail]);
  const mismatchList = mismatches?.length ? mismatches : detail?.mismatches ?? [];

  return (
    <div className="cms-card space-y-3 border border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold m-0">POWER INDEX</h3>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            Derived from Coach Intelligence ({modelVersion ?? detail?.modelVersion ?? "coach-power-v1"}).
            Does not recalculate Attack/Defence independently.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicSlug ? (
            <>
              <a
                className="cms-btn cms-btn--secondary text-xs"
                href={`/coaches/${publicSlug}/power-index`}
                target="_blank"
                rel="noreferrer"
              >
                View public Power Index
              </a>
              <a
                className="cms-btn cms-btn--secondary text-xs"
                href="/coaches/power-index"
                target="_blank"
                rel="noreferrer"
              >
                Power Index board
              </a>
            </>
          ) : null}
          {onRecalculate ? (
            <button
              type="button"
              className="cms-btn cms-btn--primary text-xs"
              disabled={busy}
              onClick={onRecalculate}
            >
              {busy ? "Recalculating…" : "Recalculate Power Index"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Current Power Index</div>
          <div className="text-2xl font-semibold text-zinc-100">
            {powerIndex != null ? Math.round(powerIndex) : "—"}
            <span className="text-sm text-zinc-500 font-normal"> / 100</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Previous</div>
          <div className="text-zinc-100 font-medium">{dash(previousPowerIndex != null ? Math.round(previousPowerIndex) : null)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Change</div>
          <div className="text-zinc-100 font-medium">{signed(powerIndexChange)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Confidence</div>
          <div className="text-zinc-100 font-medium">
            {detail ? `${detail.confidence}% (${detail.confidenceBand})` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Data Coverage</div>
          <div className="text-zinc-100 font-medium">
            {detail ? `${detail.weightedCoverage}% weighted · ${detail.dataCoverage}% stats` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Matches Used</div>
          <div className="text-zinc-100 font-medium">{dash(detail?.matchesUsed)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Calculation Version</div>
          <div className="text-zinc-100 font-medium text-xs">{dash(modelVersion ?? detail?.modelVersion)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Last Calculated</div>
          <div className="text-zinc-100 font-medium text-xs">
            {dash(lastCalculated ?? detail?.calculatedAt)}
          </div>
        </div>
      </div>

      {detail && !detail.publishable ? (
        <p className="text-amber-300/90 text-xs m-0">
          INSUFFICIENT coverage ({detail.weightedCoverage}% &lt; 60%) — Power Index not published.
        </p>
      ) : null}

      {mismatchList.length > 0 ? (
        <div className="rounded border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          <strong>INTELLIGENCE SCORE MISMATCH</strong>
          <ul className="m-0 mt-1 pl-4">
            {mismatchList.map((m) => (
              <li key={m.key}>
                {m.key}: Intelligence {m.intelligenceScore} ≠ Power Index {m.powerIndexScore}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold m-0 mb-2">INPUTS</h4>
        {!inputs.length ? (
          <p className="text-sm text-zinc-500 m-0">No weighted inputs yet — recalculate after Intelligence is available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="px-2 py-2 font-medium">METRIC</th>
                  <th className="px-2 py-2 font-medium">SCORE</th>
                  <th className="px-2 py-2 font-medium">WEIGHT</th>
                  <th className="px-2 py-2 font-medium">CONTRIBUTION</th>
                  <th className="px-2 py-2 font-medium">TREND</th>
                  <th className="px-2 py-2 font-medium">CONFIDENCE</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((c) => (
                  <tr key={c.key} className="border-t border-zinc-800">
                    <td className="px-2 py-2 text-zinc-100 font-medium">{c.label}</td>
                    <td className="px-2 py-2 text-zinc-100">{Math.round(c.score)}</td>
                    <td className="px-2 py-2 text-zinc-400">{c.weight}%</td>
                    <td className="px-2 py-2 text-zinc-300">{c.contribution.toFixed(1)}</td>
                    <td className="px-2 py-2 text-zinc-400">
                      {c.trend == null || c.trend === 0
                        ? "—"
                        : c.trend > 0
                          ? `↑${c.trend}`
                          : `↓${Math.abs(c.trend)}`}
                    </td>
                    <td className="px-2 py-2 text-zinc-400">{c.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {detail?.excludedKeys?.length ? (
          <p className="text-xs text-zinc-500 m-0 mt-2">
            Excluded (renormalised): {detail.excludedKeys.join(", ")}
          </p>
        ) : null}
      </div>

      <div>
        <h4 className="text-sm font-semibold m-0 mb-2">MODIFIERS</h4>
        <div className="grid gap-1 sm:grid-cols-2 text-xs">
          {modifiers.map((m) => (
            <div
              key={m.key}
              className="flex justify-between gap-2 border-b border-zinc-900 py-1"
            >
              <span className="text-zinc-400">
                {m.label}
                {m.sourceScore != null ? ` (${Math.round(m.sourceScore)})` : ""}
              </span>
              <span className="text-zinc-100">{signed(m.effect)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 py-1 font-medium sm:col-span-2">
            <span className="text-zinc-300">Total Modifier</span>
            <span className="text-zinc-100">{signed(detail?.modifierTotal)}</span>
          </div>
          {detail?.baseScore != null ? (
            <div className="flex justify-between gap-2 py-1 text-zinc-500 sm:col-span-2">
              <span>Base (weighted) → Final</span>
              <span>
                {detail.baseScore} → {dash(powerIndex)}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
