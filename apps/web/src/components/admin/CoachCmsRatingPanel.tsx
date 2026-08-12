"use client";

import { useMemo } from "react";
import type { CoachRatingResult } from "@/lib/coach-rating-engine";

type Props = {
  overallRating?: number | null;
  previousOverallRating?: number | null;
  overallRatingChange?: number | null;
  detail?: CoachRatingResult | null;
  worldRank?: number | null;
  previousWorldRank?: number | null;
  worldRankChange?: number | null;
  rankedOutOf?: number | null;
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

export function CoachCmsRatingPanel({
  overallRating,
  previousOverallRating,
  overallRatingChange,
  detail,
  worldRank,
  previousWorldRank,
  worldRankChange,
  rankedOutOf,
  modelVersion,
  lastCalculated,
  busy,
  onRecalculate,
  publicSlug,
}: Props & { publicSlug?: string | null }) {
  const inputs = useMemo(() => detail?.contributions ?? [], [detail]);

  return (
    <div className="cms-card space-y-3 border border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold m-0">COACH RATING</h3>
          <p className="text-xs text-zinc-500 m-0 mt-1">
            Overall coach quality ({modelVersion ?? detail?.modelVersion ?? "coach-rating-v1"}).
            Power Index is an input (40%) — not recalculated here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {publicSlug ? (
            <>
              <a
                className="cms-btn cms-btn--secondary text-xs"
                href={`/coaches/${publicSlug}/rating`}
                target="_blank"
                rel="noreferrer"
              >
                View public rating
              </a>
              <a
                className="cms-btn cms-btn--secondary text-xs"
                href="/rankings/coaches"
                target="_blank"
                rel="noreferrer"
              >
                World rankings
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
              {busy ? "Recalculating…" : "Recalculate Coach Rating"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4 text-sm">
        <div>
          <div className="text-xs text-zinc-500">Current Coach Rating</div>
          <div className="text-2xl font-semibold text-zinc-100">
            {overallRating != null ? overallRating.toFixed(1) : "—"}
            <span className="text-sm text-zinc-500 font-normal"> / 100</span>
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Previous</div>
          <div className="text-zinc-100 font-medium">
            {dash(previousOverallRating != null ? previousOverallRating.toFixed(1) : null)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Change</div>
          <div className="text-zinc-100 font-medium">{signed(overallRatingChange)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Confidence</div>
          <div className="text-zinc-100 font-medium">
            {detail ? `${detail.confidence}% (${detail.confidenceBand})` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Coverage</div>
          <div className="text-zinc-100 font-medium">
            {detail ? `${detail.weightedCoverage}% weighted` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Matches Used</div>
          <div className="text-zinc-100 font-medium">{dash(detail?.matchesUsed)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Version</div>
          <div className="text-zinc-100 font-medium text-xs">
            {dash(modelVersion ?? detail?.modelVersion)}
          </div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Last Calculated</div>
          <div className="text-zinc-100 font-medium text-xs">
            {dash(lastCalculated ?? detail?.calculatedAt)}
          </div>
        </div>
      </div>

      <div className="rounded border border-zinc-800 px-3 py-2">
        <h4 className="text-sm font-semibold m-0 mb-2">WORLD RANKING</h4>
        <div className="grid gap-2 sm:grid-cols-4 text-xs">
          <div>
            <div className="text-zinc-500">World Rank</div>
            <div className="text-zinc-100 font-semibold text-lg">
              {worldRank != null ? `#${worldRank}` : "—"}
              {rankedOutOf != null ? (
                <span className="text-zinc-500 text-xs font-normal"> / {rankedOutOf}</span>
              ) : null}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Previous Rank</div>
            <div className="text-zinc-100">{previousWorldRank != null ? `#${previousWorldRank}` : "—"}</div>
          </div>
          <div>
            <div className="text-zinc-500">Change</div>
            <div className="text-zinc-100">
              {worldRankChange == null
                ? "—"
                : worldRankChange > 0
                  ? `↑ ${worldRankChange}`
                  : worldRankChange < 0
                    ? `↓ ${Math.abs(worldRankChange)}`
                    : "— 0"}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Eligible</div>
            <div className="text-zinc-100">
              {detail?.eligibleForWorldRank ? "Yes" : "No"}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 m-0 mt-2">
          Ranked by Rugby365 Coach Rating (not raw win rate). Requires min matches, coverage, and
          confidence.
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold m-0 mb-2">WHY THIS RATING</h4>
        {!inputs.length ? (
          <p className="text-sm text-zinc-500 m-0">No inputs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-zinc-500 text-left">
                <tr>
                  <th className="px-2 py-2 font-medium">INPUT</th>
                  <th className="px-2 py-2 font-medium">SCORE</th>
                  <th className="px-2 py-2 font-medium">WEIGHT</th>
                  <th className="px-2 py-2 font-medium">CONTRIBUTION</th>
                  <th className="px-2 py-2 font-medium">SOURCE</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((c) => (
                  <tr key={c.key} className="border-t border-zinc-800">
                    <td className="px-2 py-2 text-zinc-100 font-medium">{c.label}</td>
                    <td className="px-2 py-2 text-zinc-100">{Math.round(c.score)}</td>
                    <td className="px-2 py-2 text-zinc-400">{c.weight}%</td>
                    <td className="px-2 py-2 text-zinc-300">{c.contribution.toFixed(1)}</td>
                    <td className="px-2 py-2 text-zinc-500">{c.source}</td>
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
    </div>
  );
}
