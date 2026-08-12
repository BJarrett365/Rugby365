"use client";

import Link from "next/link";
import { R365TimeSeriesChart } from "@/components/charts/R365TimeSeriesChart";
import { formatGbpCompact } from "@/lib/player-value-math";
import {
  buildValueTrendYTicks,
  formatValueTrendYAxisLabel,
  type MarketValueTimelinePoint,
} from "@/lib/player-market-value-trend-utils";
import type { ValueTimelineSummary } from "@/lib/player-value-timeline-utils";

export type PlayerValueTimelineCardProps = {
  slug: string;
  displayPoints: MarketValueTimelinePoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  summary: ValueTimelineSummary;
  /** Must match Estimated Market Value card latest. */
  estimatedMarketValueGbp?: number | null;
};

function trendDisplay(summary: ValueTimelineSummary): { text: string; tone: string } {
  if (!summary.trend) return { text: "—", tone: "" };
  if (summary.trend === "Rising") return { text: "Rising ↑", tone: "is-up" };
  if (summary.trend === "Falling") return { text: "Falling ↓", tone: "is-down" };
  return { text: "Stable →", tone: "is-stable" };
}

/** Career / long-term VALUE TIMELINE card — React display only. */
export function PlayerValueTimelineCard({
  slug,
  displayPoints,
  rangeStartIso,
  rangeEndIso,
  summary,
  estimatedMarketValueGbp,
}: PlayerValueTimelineCardProps) {
  const values = displayPoints.map((p) => p.marketValueGbp);
  const { min: yMin, max: yMax, ticks } = buildValueTrendYTicks(values);
  const trend = trendDisplay(summary);

  const consistencyWarn =
    summary.currentGbp != null &&
    estimatedMarketValueGbp != null &&
    Math.abs(summary.currentGbp - estimatedMarketValueGbp) > 1
      ? "Timeline current ≠ Estimated Market Value"
      : null;

  const chartPoints = displayPoints.map((p) => ({
    dateIso: p.dateIso,
    value: p.marketValueGbp,
    metaRows: [
      ...(p.confidence != null
        ? [{ label: "Confidence", value: `${Math.round(p.confidence * 100)}%` }]
        : []),
      ...(p.clubName ? [{ label: "Club", value: p.clubName }] : []),
      ...(p.changeSincePreviousPct != null
        ? [
            {
              label: "Change",
              value:
                p.changeSincePreviousPct === 0
                  ? "0%"
                  : p.changeSincePreviousPct > 0
                    ? `+${p.changeSincePreviousPct}%`
                    : `${p.changeSincePreviousPct}%`,
            },
          ]
        : []),
      ...(p.snapshotType ? [{ label: "Type", value: String(p.snapshotType).toUpperCase() }] : []),
    ],
  }));

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card">
      <div className="pr-player-v2__card-head">
        <h2>Value Timeline</h2>
        <Link className="pr-player-v2__card-link" href={`/players/${slug}/stats`}>
          View full value history &gt;
        </Link>
      </div>

      <R365TimeSeriesChart
        points={chartPoints}
        rangeStartIso={rangeStartIso}
        rangeEndIso={rangeEndIso}
        yMin={yMin}
        yMax={yMax}
        yTicks={ticks}
        formatY={formatValueTrendYAxisLabel}
        formatValueLabel={formatGbpCompact}
        showArea
        yearValueLabels={displayPoints.length >= 2}
        emptyState={summary.emptyState}
        emptyHelper={summary.emptyHelper}
        ariaLabel="Career market value timeline"
        className="pr-player-v2__widget-chart"
      />

      {consistencyWarn ? <p className="pr-player-v2__widget-warn">{consistencyWarn}</p> : null}

      <div className="pr-player-v2__widget-footer">
        <div>
          <span>Current</span>
          <strong>{summary.currentGbp != null ? formatGbpCompact(summary.currentGbp) : "—"}</strong>
        </div>
        <div>
          <span>Highest</span>
          <strong>{summary.highestGbp != null ? formatGbpCompact(summary.highestGbp) : "—"}</strong>
        </div>
        <div>
          <span>Lowest</span>
          <strong>{summary.lowestGbp != null ? formatGbpCompact(summary.lowestGbp) : "—"}</strong>
        </div>
        <div>
          <span>Avg. Growth</span>
          <strong>{summary.avgGrowthLabel}</strong>
        </div>
        <div>
          <span>Trend</span>
          <strong className={trend.tone}>{trend.text}</strong>
        </div>
      </div>
    </div>
  );
}
