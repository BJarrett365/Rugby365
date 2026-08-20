"use client";

import { useMemo, useState } from "react";
import { formatGbpCompact } from "@/lib/player-value-math";
import {
  buildValueTrendYTicks,
  formatValueTrendYAxisLabel,
  resolveValueTrendEmptyState,
  resolveValueTrendHelperText,
  type MarketValueTimelinePoint,
} from "@/lib/player-market-value-trend-utils";

export type R365ValueTrendChartPoint = MarketValueTimelinePoint;

export type R365ValueTrendChartProps = {
  points: R365ValueTrendChartPoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  state?: "OK" | "LIMITED" | "INSUFFICIENT";
  currency?: "GBP";
  rangeMonths?: number;
  showArea?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  emptyState?: string | null;
  limitedHistory?: boolean;
  className?: string;
  hideCaptionAndLegend?: boolean;
};

const CHART_GREEN = "#54b989";
const CHART_BG = "#0c2a32";

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function xFor(dateMs: number, startMs: number, endMs: number, width: number): number {
  const t = endMs === startMs ? 0 : (dateMs - startMs) / (endMs - startMs);
  return t * width;
}

export { buildValueTrendYTicks, formatValueTrendYAxisLabel };

function formatXAxisLabel(d: Date): string {
  const month = d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${month} '${year}`;
}

function formatPctLabel(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  if (pct === 0) return "→ 0%";
  return pct > 0 ? `▲ +${Math.abs(pct)}%` : `▼ −${Math.abs(pct)}%`;
}

function snapshotTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  const t = type.toUpperCase();
  if (t === "LIVE") return "LIVE";
  if (t === "BACKFILLED" || t === "RECONSTRUCTED") return "BACKFILLED";
  return t;
}

type PlottedPoint = {
  x: number;
  y: number;
  p: R365ValueTrendChartPoint;
};

export function R365ValueTrendChart({
  points,
  rangeStartIso,
  rangeEndIso,
  state,
  showArea = true,
  showGrid = true,
  showTooltip = true,
  emptyState,
  limitedHistory = false,
  className,
  hideCaptionAndLegend = false,
}: R365ValueTrendChartProps) {
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...points].sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [points],
  );

  const pointCount = sorted.length;
  const shouldPlotLine = pointCount >= 2;
  const shouldPlotArea = showArea && pointCount >= 3;
  const statusLabel = emptyState ?? resolveValueTrendEmptyState(pointCount);
  const helperText = resolveValueTrendHelperText(pointCount);
  const showLimitedNotice =
    pointCount > 0 &&
    pointCount < 6 &&
    (limitedHistory || state === "LIMITED" || state === "INSUFFICIENT" || statusLabel != null);

  const start = new Date(rangeStartIso);
  const end = new Date(rangeEndIso);
  const startMs = start.getTime();
  const endMs = end.getTime();

  const values = sorted.map((p) => p.marketValueGbp);
  const { min: yMin, max: yMax, ticks: yTicks } = buildValueTrendYTicks(values);
  const ySpan = Math.max(1, yMax - yMin);

  const w = 340;
  const h = 148;
  const marginLeft = 44;
  const marginRight = 6;
  const marginTop = 6;
  const marginBottom = 26;

  const plotX = marginLeft;
  const plotY = marginTop;
  const plotW = w - marginLeft - marginRight;
  const plotH = h - marginTop - marginBottom;
  const plotBottom = plotY + plotH;

  const yFor = (value: number) => plotBottom - ((value - yMin) / ySpan) * plotH;

  const pts: PlottedPoint[] = sorted.map((p) => {
    const ms = new Date(p.dateIso).getTime();
    const x = plotX + xFor(ms, startMs, endMs, plotW);
    const y = yFor(p.marketValueGbp);
    return { x, y, p };
  });

  const lineD = shouldPlotLine
    ? pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ")
    : null;
  const areaD =
    shouldPlotArea && lineD
      ? `${lineD} L ${pts[pts.length - 1]!.x.toFixed(1)} ${plotBottom.toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${plotBottom.toFixed(1)} Z`
      : null;

  const markerStepMonths = 6;
  const xTickDates: Date[] = [];
  const firstMarker = new Date(start);
  for (let i = 0; i <= 6; i++) xTickDates.push(addMonths(firstMarker, i * markerStepMonths));

  const visibleXTicks = xTickDates.filter((md) => {
    const ms = md.getTime();
    return ms >= startMs && ms <= endMs;
  });

  const gradientId = `r365ValueTrendFill-${rangeEndIso.slice(0, 10)}`;
  const hovered = pts.find((pt) => pt.p.dateIso === hoveredIso) ?? null;

  const firstVal = sorted[0] ?? null;
  const lastVal = sorted[sorted.length - 1] ?? null;

  return (
    <figure className={`pr-value-timeline r365-value-trend ${className ?? ""}`.trim()}>
      <div className="r365-value-trend__wrap">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="pr-value-timeline__svg"
          role="img"
          aria-label="Market value last 24 months"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_GREEN} stopOpacity="0.35" />
              <stop offset="100%" stopColor={CHART_GREEN} stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect x={plotX} y={plotY} width={plotW} height={plotH} className="pr-value-timeline__plot-bg" rx="2" />

          {showGrid
            ? yTicks.map((tick) => {
                const y = yFor(tick);
                return (
                  <g key={`y-${tick}`}>
                    <line
                      x1={plotX}
                      x2={plotX + plotW}
                      y1={y}
                      y2={y}
                      className="pr-value-timeline__grid-line"
                    />
                    <text
                      x={plotX - 6}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="pr-value-timeline__axis-label"
                    >
                      {formatValueTrendYAxisLabel(tick)}
                    </text>
                  </g>
                );
              })
            : null}

          {showGrid
            ? visibleXTicks.map((md) => {
                const ms = md.getTime();
                const x = plotX + xFor(ms, startMs, endMs, plotW);
                return (
                  <g key={`x-${ms}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={plotY}
                      y2={plotBottom}
                      className="pr-value-timeline__grid-line pr-value-timeline__grid-line--vertical"
                    />
                    <text
                      x={x}
                      y={plotBottom + 14}
                      textAnchor="middle"
                      className="pr-value-timeline__axis-label"
                    >
                      {formatXAxisLabel(md)}
                    </text>
                  </g>
                );
              })
            : null}

          <line
            x1={plotX}
            x2={plotX + plotW}
            y1={plotBottom}
            y2={plotBottom}
            className="pr-value-timeline__axis-line"
          />
          <line x1={plotX} x2={plotX} y1={plotY} y2={plotBottom} className="pr-value-timeline__axis-line" />

          {areaD ? <path d={areaD} fill={`url(#${gradientId})`} /> : null}
          {lineD ? (
            <path d={lineD} fill="none" stroke={CHART_GREEN} strokeWidth="2.5" strokeLinejoin="round" />
          ) : null}

          {pts.map((pt) => (
            <g key={pt.p.dateIso}>
              {showTooltip ? (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="12"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIso(pt.p.dateIso)}
                  onMouseLeave={() => setHoveredIso(null)}
                />
              ) : null}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={hoveredIso === pt.p.dateIso || pointCount === 1 ? 4.5 : 3.5}
                fill={CHART_GREEN}
                stroke={CHART_BG}
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>

        {showTooltip && hovered ? (
          <div
            className="r365-value-trend__tooltip"
            style={{
              left: `${Math.min(Math.max((hovered.x / w) * 100, 8), 92)}%`,
              top: `${Math.max((hovered.y / h) * 100 - 8, 4)}%`,
            }}
          >
            <div className="r365-value-trend__tooltip-date">
              {new Date(hovered.p.dateIso).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>
            <div className="r365-value-trend__tooltip-value">{formatGbpCompact(hovered.p.marketValueGbp)}</div>
            <div className="r365-value-trend__tooltip-row">
              <span>Change</span>
              <span>{formatPctLabel(hovered.p.changeSincePreviousPct)}</span>
            </div>
            <div className="r365-value-trend__tooltip-row">
              <span>OVR</span>
              <span>{hovered.p.overallRating != null ? Math.round(hovered.p.overallRating) : "—"}</span>
            </div>
            <div className="r365-value-trend__tooltip-row">
              <span>Potential</span>
              <span>
                {hovered.p.potentialRating != null ? Math.round(hovered.p.potentialRating) : "—"}
              </span>
            </div>
            <div className="r365-value-trend__tooltip-row">
              <span>Confidence</span>
              <span>{Math.round(hovered.p.confidence * 100)}%</span>
            </div>
            <div className="r365-value-trend__tooltip-row">
              <span>Club</span>
              <span>{hovered.p.clubName ?? "—"}</span>
            </div>
            <div className="r365-value-trend__tooltip-row">
              <span>Model</span>
              <span>{hovered.p.modelVersion ?? "—"}</span>
            </div>
            <div className="r365-value-trend__tooltip-row">
              <span>Type</span>
              <span>{snapshotTypeLabel(hovered.p.snapshotType)}</span>
            </div>
          </div>
        ) : null}
      </div>

      {showLimitedNotice && statusLabel ? (
        <div className="r365-value-trend__status" aria-live="polite">
          <span className="r365-value-trend__status-label">{statusLabel}</span>
          {helperText ? <span className="r365-value-trend__status-helper">{helperText}</span> : null}
        </div>
      ) : null}

      {hideCaptionAndLegend ? null : (
        <>
          <figcaption className="pr-value-timeline__years">
            {pointCount === 0 ? (
              <span className="pr-value-timeline__insufficient">
                {statusLabel ?? "INSUFFICIENT HISTORICAL SNAPSHOTS"}
              </span>
            ) : lastVal && firstVal && pointCount >= 2 ? (
              <>
                <span>
                  <em>
                    {new Date(firstVal.dateIso).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                  </em>
                  <strong>{formatGbpCompact(firstVal.marketValueGbp)}</strong>
                </span>
                <span aria-hidden>…</span>
                <span>
                  <em>
                    {new Date(lastVal.dateIso).toLocaleDateString("en-GB", {
                      month: "short",
                      year: "numeric",
                    })}
                  </em>
                  <strong>{formatGbpCompact(lastVal.marketValueGbp)}</strong>
                </span>
              </>
            ) : lastVal ? (
              <span>
                <em>
                  {new Date(lastVal.dateIso).toLocaleDateString("en-GB", {
                    month: "short",
                    year: "numeric",
                  })}
                </em>
                <strong>{formatGbpCompact(lastVal.marketValueGbp)}</strong>
              </span>
            ) : null}
          </figcaption>

          <p className="pr-value-timeline__legend">
            <span>LAST 24 MONTHS</span>
            <span>{lastVal ? `Latest ${formatGbpCompact(lastVal.marketValueGbp)}` : "Latest —"}</span>
          </p>
        </>
      )}
    </figure>
  );
}
