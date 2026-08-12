"use client";

import { useMemo, useState } from "react";
import type { CoachDataCoverage } from "@/lib/coach-recalc-service";
import type {
  CoachCoverageGapRow,
  CoverageDataType,
} from "@/lib/coach-coverage-gaps-service";

type Props = {
  coachId: string;
  coverage: CoachDataCoverage | null;
  busy?: string;
  onRefreshLinks: () => void;
  onRecalcStats: () => void;
  onRecalcRating: () => void;
  onRecalcAll: () => void;
  onReloadCoverage: () => void;
};

type LayerKey = "matches" | "lineups" | "team_stats" | "player_ratings" | "historical_rankings";

function ratio(have: number, of: number): string {
  return `${have} / ${of}`;
}

function pct(have: number, of: number): number {
  if (of <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((100 * have) / of)));
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded bg-zinc-800">
      <div
        className="h-full rounded bg-emerald-500/80 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function CoachCmsDataCoveragePanel({
  coachId,
  coverage,
  busy,
  onRefreshLinks,
  onRecalcStats,
  onRecalcRating,
  onRecalcAll,
  onReloadCoverage,
}: Props) {
  const [openLayer, setOpenLayer] = useState<LayerKey | null>(null);
  const [gaps, setGaps] = useState<CoachCoverageGapRow[]>([]);
  const [gapsBusy, setGapsBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState("");

  const layers = useMemo(() => {
    if (!coverage) return [];
    return [
      {
        key: "matches" as const,
        label: "MATCHES",
        have: coverage.careerMatches,
        of: coverage.careerMatches,
      },
      {
        key: "lineups" as const,
        label: "LINEUPS",
        have: coverage.lineups.have,
        of: coverage.lineups.of,
      },
      {
        key: "team_stats" as const,
        label: "TEAM STATS",
        have: coverage.teamStats.have,
        of: coverage.teamStats.of,
      },
      {
        key: "player_ratings" as const,
        label: "PLAYER RATINGS",
        have: coverage.playerRatings.have,
        of: coverage.playerRatings.of,
      },
      {
        key: "historical_rankings" as const,
        label: "HISTORICAL RANKINGS",
        have: coverage.historicalRankings.have,
        of: coverage.historicalRankings.of,
      },
    ];
  }, [coverage]);

  async function loadGaps(layer: LayerKey) {
    setGapsBusy(true);
    try {
      const res = await fetch(
        `/api/admin/coaches/${coachId}/coverage-gaps?dataType=${encodeURIComponent(layer)}`,
      );
      const data = await res.json();
      setGaps(Array.isArray(data.gaps) ? data.gaps : []);
    } catch {
      setGaps([]);
    } finally {
      setGapsBusy(false);
    }
  }

  async function openGaps(layer: LayerKey) {
    if (openLayer === layer) {
      setOpenLayer(null);
      return;
    }
    setOpenLayer(layer);
    await loadGaps(layer);
  }

  async function runGapAction(
    gap: CoachCoverageGapRow,
    action: "backfill" | "check_source" | "ignore" | "unavailable",
  ) {
    setActionBusy(`${action}:${gap.fixtureId}`);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/coverage-gaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataType: openLayer,
          fixtureId: gap.fixtureId,
          action,
          date: gap.date,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.unavailable) {
        alert(data.error ?? data.message ?? "Action failed");
        return;
      }
      if (data.message && action === "check_source") {
        alert(data.message);
      }
      if (openLayer) await loadGaps(openLayer);
      onReloadCoverage();
    } finally {
      setActionBusy("");
    }
  }

  return (
    <div className="cms-card mb-4 border border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold m-0">Data coverage</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={Boolean(busy)}
            onClick={onReloadCoverage}
          >
            Refresh coverage
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy === "links"}
            onClick={onRefreshLinks}
          >
            {busy === "links" ? "Linking…" : "Refresh match links"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy === "stats"}
            onClick={onRecalcStats}
          >
            {busy === "stats" ? "…" : "Recalculate stats"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-xs"
            disabled={busy === "rating"}
            onClick={onRecalcRating}
          >
            {busy === "rating" ? "…" : "Recalculate rating"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary text-xs"
            disabled={busy === "all"}
            onClick={onRecalcAll}
          >
            {busy === "all" ? "Recalculating…" : "Recalculate all"}
          </button>
        </div>
      </div>
      <p className="text-sm text-zinc-500 mt-0 mb-3">
        Blank public cards come from missing underlying Rugby365 data — not missing editor text.
        Awards/medals stay CMS/verified facts.
      </p>
      {!coverage ? (
        <p className="text-sm text-zinc-500 m-0">Coverage not loaded.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-100 uppercase">
              {coverage.calcStatus}
            </span>
            {coverage.partialCareerRecord ? (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                PARTIAL CAREER RECORD
              </span>
            ) : null}
            {coverage.calcStaleReason ? (
              <span className="text-xs text-zinc-500">Stale: {coverage.calcStaleReason}</span>
            ) : null}
            <span className="text-xs text-zinc-400">
              Rating confidence {coverage.ratingConfidencePct}%
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {layers.map((layer) => {
              const missing = Math.max(0, layer.of - layer.have);
              return (
                <div key={layer.key} className="rounded border border-zinc-800 px-3 py-2">
                  <div className="text-zinc-500 text-xs tracking-wide">{layer.label}</div>
                  <div className="text-zinc-100 font-semibold">
                    {ratio(layer.have, layer.of)}
                  </div>
                  <ProgressBar value={pct(layer.have, layer.of)} />
                  {missing > 0 && layer.key !== "matches" ? (
                    <button
                      type="button"
                      className="mt-2 text-[11px] font-semibold text-amber-300 hover:underline"
                      onClick={() => void openGaps(layer.key)}
                    >
                      {openLayer === layer.key ? "HIDE MISSING" : `VIEW ${missing} MISSING`}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {openLayer ? (
            <div className="mt-4 rounded border border-zinc-800 overflow-hidden">
              <div className="px-3 py-2 bg-zinc-900/60 text-xs font-semibold text-zinc-300 uppercase">
                Missing — {openLayer.replace(/_/g, " ")}
              </div>
              {gapsBusy ? (
                <p className="text-sm text-zinc-500 px-3 py-3 m-0">Loading…</p>
              ) : gaps.length === 0 ? (
                <p className="text-sm text-zinc-500 px-3 py-3 m-0">No missing matches.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-zinc-500 text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Match</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Opponent</th>
                        <th className="px-3 py-2 font-medium">Competition</th>
                        <th className="px-3 py-2 font-medium">Missing</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaps.map((g) => (
                        <tr key={g.fixtureId} className="border-t border-zinc-800 align-top">
                          <td className="px-3 py-2 text-zinc-100">{g.match}</td>
                          <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{g.date ?? "—"}</td>
                          <td className="px-3 py-2 text-zinc-300">{g.opponent ?? "—"}</td>
                          <td className="px-3 py-2 text-zinc-400">{g.competition ?? "—"}</td>
                          <td className="px-3 py-2 text-zinc-300">{g.missingData}</td>
                          <td className="px-3 py-2 text-zinc-500 max-w-[14rem]">{g.availableSource}</td>
                          <td className="px-3 py-2 uppercase text-zinc-400">{g.status}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  ["backfill", "BACKFILL"],
                                  ["check_source", "CHECK SOURCE"],
                                  ["ignore", "IGNORE"],
                                  ["unavailable", "MARK UNAVAILABLE"],
                                ] as const
                              ).map(([action, label]) => (
                                <button
                                  key={action}
                                  type="button"
                                  className="cms-btn cms-btn--secondary text-[10px] px-1.5 py-0.5"
                                  disabled={Boolean(actionBusy)}
                                  onClick={() => void runGapAction(g, action)}
                                >
                                  {actionBusy === `${action}:${g.fixtureId}` ? "…" : label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// Keep type import used for editor tooling without unused-export noise.
export type { CoverageDataType };
