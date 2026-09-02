"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { R365TimeSeriesChart } from "@/components/charts/R365TimeSeriesChart";
import {
  RATING_HISTORY_METRIC_OPTIONS,
  RATING_HISTORY_Y_MAX,
  RATING_HISTORY_Y_MIN,
  buildRatingHistorySummary,
  buildRatingHistoryYTicks,
  extractRatingMetricSeries,
  type RatingHistoryMetricKey,
  type RatingHistoryPoint,
} from "@/lib/player-rating-history-utils";
import type { PlayerOverviewRatingPoint } from "@/lib/public-player-overview-v2-service";

export type PlayerRatingHistoryCardProps = {
  slug: string;
  points: PlayerOverviewRatingPoint[];
  /** Pre-extracted overall ability series from the service (preferred). */
  overallSeries?: RatingHistoryPoint[];
  fullHistoryHref?: string;
  showMetricSelect?: boolean;
};

function formatRating(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** RATING HISTORY — Overall Rating 0–100 timeline; React display only. */
export function PlayerRatingHistoryCard({
  slug,
  points,
  overallSeries,
  fullHistoryHref,
  showMetricSelect = true,
}: PlayerRatingHistoryCardProps) {
  const [metric, setMetric] = useState<RatingHistoryMetricKey>("overall");

  const series = useMemo(() => {
    if (metric === "overall" && overallSeries && overallSeries.length > 0) {
      return overallSeries;
    }
    return extractRatingMetricSeries(points, metric);
  }, [metric, points, overallSeries]);

  const summary = useMemo(() => buildRatingHistorySummary(series), [series]);

  const rangeStartIso =
    series[0]?.dateIso ??
    (() => {
      const d = new Date();
      d.setUTCFullYear(d.getUTCFullYear() - 5);
      return d.toISOString();
    })();
  const rangeEndIso = series[series.length - 1]?.dateIso ?? new Date().toISOString();

  const chartPoints = series.map((p) => ({
    dateIso: p.dateIso,
    value: p.value,
    label: p.opponentName ? `vs ${p.opponentName}` : p.competitionName,
    metaRows: [
      ...(p.change != null
        ? [
            {
              label: "Change",
              value: p.change > 0 ? `+${p.change.toFixed(1)}` : p.change.toFixed(1),
            },
          ]
        : []),
      ...(p.matchRating0to10 != null
        ? [{ label: "Match rating", value: `${p.matchRating0to10.toFixed(1)} / 10` }]
        : []),
      ...(p.competitionName ? [{ label: "Competition", value: p.competitionName }] : []),
      ...(p.majorMatchLabel ? [{ label: "Context", value: p.majorMatchLabel }] : []),
      ...(p.snapshotType ? [{ label: "Type", value: String(p.snapshotType).toUpperCase() }] : []),
    ],
  }));

  const yTicks = buildRatingHistoryYTicks(RATING_HISTORY_Y_MIN, RATING_HISTORY_Y_MAX, 10);
  const trendTone =
    summary.trend == null ? "" : summary.trend > 0 ? "is-up" : summary.trend < 0 ? "is-down" : "is-stable";

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card">
      <div className="pr-player-v2__card-head">
        <h2>Rating History</h2>
        <div className="pr-player-v2__widget-head-actions">
          {showMetricSelect ? (
            <label className="pr-player-v2__widget-select">
              <span className="sr-only">Rating metric</span>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as RatingHistoryMetricKey)}
              >
                {RATING_HISTORY_METRIC_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link className="pr-player-v2__card-link" href={fullHistoryHref ?? `/players/${slug}/rating`}>
            Full history &gt;
          </Link>
        </div>
      </div>

      <R365TimeSeriesChart
        points={chartPoints}
        rangeStartIso={rangeStartIso}
        rangeEndIso={rangeEndIso}
        yMin={RATING_HISTORY_Y_MIN}
        yMax={RATING_HISTORY_Y_MAX}
        yTicks={yTicks}
        formatY={(v) => String(v)}
        showArea
        emptyState={summary.emptyState}
        emptyHelper={summary.emptyHelper}
        ariaLabel="Overall rating history"
        className="pr-player-v2__widget-chart"
      />

      <div className="pr-player-v2__widget-footer">
        <div>
          <span>Best</span>
          <strong className="is-up">{summary.best != null ? formatRating(summary.best) : "—"}</strong>
        </div>
        <div>
          <span>Average</span>
          <strong>{summary.average != null ? formatRating(summary.average) : "—"}</strong>
        </div>
        <div>
          <span>Lowest</span>
          <strong>{summary.lowest != null ? formatRating(summary.lowest) : "—"}</strong>
        </div>
        <div>
          <span>Trend</span>
          <strong className={trendTone}>{summary.trendLabel}</strong>
        </div>
        <div>
          <span>Updated</span>
          <strong title={summary.updatedLabel}>{summary.updatedLabel}</strong>
        </div>
      </div>
    </div>
  );
}
