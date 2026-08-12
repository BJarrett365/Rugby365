"use client";

import { useMemo, useState } from "react";

export type R365TimeSeriesPoint = {
  dateIso: string;
  value: number;
  /** Optional tooltip fields — only rendered when present. */
  label?: string | null;
  secondary?: string | null;
  change?: number | null;
  metaRows?: Array<{ label: string; value: string }>;
};

export type R365TimeSeriesChartProps = {
  points: R365TimeSeriesPoint[];
  rangeStartIso: string;
  rangeEndIso: string;
  yMin: number;
  yMax: number;
  yTicks?: number[];
  formatY?: (v: number) => string;
  formatX?: (d: Date) => string;
  showArea?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  /** Plot line when ≥2 points; single point still shows a marker. */
  emptyState?: string | null;
  emptyHelper?: string | null;
  /** Optional value labels under year ticks (career value timeline). */
  yearValueLabels?: boolean;
  formatValueLabel?: (v: number) => string;
  className?: string;
  ariaLabel?: string;
  lineColor?: string;
};

const CHART_GREEN = "#54b989";
const CHART_BG = "#0c2a32";

function xFor(dateMs: number, startMs: number, endMs: number, width: number): number {
  const t = endMs === startMs ? 0 : (dateMs - startMs) / (endMs - startMs);
  return t * width;
}

function defaultFormatX(d: Date): string {
  return String(d.getUTCFullYear());
}

/**
 * Shared time-series line chart (rating history, career timelines, etc.).
 * Real date scale on X; fixed Y bounds — no micro-zoom.
 */
export function R365TimeSeriesChart({
  points,
  rangeStartIso,
  rangeEndIso,
  yMin,
  yMax,
  yTicks,
  formatY = (v) => String(Math.round(v)),
  formatX = defaultFormatX,
  showArea = false,
  showGrid = true,
  showTooltip = true,
  emptyState = null,
  emptyHelper = null,
  yearValueLabels = false,
  formatValueLabel,
  className,
  ariaLabel = "Time series chart",
  lineColor = CHART_GREEN,
}: R365TimeSeriesChartProps) {
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...points].filter((p) => Number.isFinite(p.value)).sort((a, b) => a.dateIso.localeCompare(b.dateIso)),
    [points],
  );

  const start = new Date(rangeStartIso);
  const end = new Date(rangeEndIso);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const ySpan = Math.max(1, yMax - yMin);
  const ticks =
    yTicks ??
    Array.from({ length: 5 }, (_, i) => yMin + (ySpan * i) / 4).map((v) => Math.round(v));

  const w = 340;
  const h = yearValueLabels ? 168 : 148;
  const marginLeft = 36;
  const marginRight = 8;
  const marginTop = 8;
  const marginBottom = yearValueLabels ? 40 : 26;
  const plotX = marginLeft;
  const plotY = marginTop;
  const plotW = w - marginLeft - marginRight;
  const plotH = h - marginTop - marginBottom;
  const plotBottom = plotY + plotH;

  const yFor = (value: number) => plotBottom - ((value - yMin) / ySpan) * plotH;

  const pts = sorted.map((p) => {
    const ms = new Date(p.dateIso).getTime();
    return {
      x: plotX + xFor(ms, startMs, endMs, plotW),
      y: yFor(p.value),
      p,
    };
  });

  const shouldPlotLine = pts.length >= 2;
  const shouldPlotArea = showArea && pts.length >= 3;
  const lineD = shouldPlotLine
    ? pts.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(" ")
    : null;
  const areaD =
    shouldPlotArea && lineD
      ? `${lineD} L ${pts[pts.length - 1]!.x.toFixed(1)} ${plotBottom.toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${plotBottom.toFixed(1)} Z`
      : null;

  // Year ticks across range
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const yearTicks: number[] = [];
  for (let y = startYear; y <= endYear; y++) yearTicks.push(y);
  // Cap density
  const step = yearTicks.length > 8 ? Math.ceil(yearTicks.length / 6) : 1;
  const visibleYears = yearTicks.filter((_, i) => i % step === 0 || i === yearTicks.length - 1);

  const gradientId = `r365TsFill-${rangeEndIso.slice(0, 10)}`;
  const hovered = pts.find((pt) => pt.p.dateIso === hoveredIso) ?? null;

  // For year value labels: pick nearest point to mid-year
  const yearLabelRows = yearValueLabels
    ? visibleYears.map((year) => {
        const mid = Date.UTC(year, 6, 1);
        let best: (typeof pts)[number] | null = null;
        let bestDiff = Infinity;
        for (const pt of pts) {
          const diff = Math.abs(new Date(pt.p.dateIso).getTime() - mid);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = pt;
          }
        }
        // Only label if a point falls within that calendar year
        const inYear = pts.find((pt) => new Date(pt.p.dateIso).getUTCFullYear() === year) ?? null;
        const pick = inYear ?? (bestDiff < 200 * 86_400_000 ? best : null);
        return { year, point: pick };
      })
    : [];

  return (
    <figure className={`r365-timeseries ${className ?? ""}`.trim()}>
      <div className="r365-timeseries__wrap">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="r365-timeseries__svg"
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect x={plotX} y={plotY} width={plotW} height={plotH} className="r365-timeseries__plot-bg" rx="2" />

          {showGrid
            ? ticks.map((tick) => {
                const y = yFor(tick);
                return (
                  <g key={`y-${tick}`}>
                    <line
                      x1={plotX}
                      x2={plotX + plotW}
                      y1={y}
                      y2={y}
                      className="r365-timeseries__grid"
                    />
                    <text
                      x={plotX - 5}
                      y={y}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="r365-timeseries__axis-label"
                    >
                      {formatY(tick)}
                    </text>
                  </g>
                );
              })
            : null}

          {showGrid
            ? visibleYears.map((year) => {
                const ms = Date.UTC(year, 0, 1);
                if (ms < startMs || ms > endMs) return null;
                const x = plotX + xFor(ms, startMs, endMs, plotW);
                return (
                  <g key={`x-${year}`}>
                    <text
                      x={x}
                      y={plotBottom + 14}
                      textAnchor="middle"
                      className="r365-timeseries__axis-label"
                    >
                      {formatX(new Date(ms))}
                    </text>
                  </g>
                );
              })
            : null}

          {yearLabelRows.map(({ year, point }) => {
            if (!point) return null;
            const ms = Date.UTC(year, 0, 1);
            const x =
              ms >= startMs && ms <= endMs
                ? plotX + xFor(ms, startMs, endMs, plotW)
                : point.x;
            return (
              <text
                key={`yl-${year}`}
                x={x}
                y={plotBottom + 28}
                textAnchor="middle"
                className="r365-timeseries__value-label"
                fill={lineColor}
              >
                {formatValueLabel ? formatValueLabel(point.p.value) : formatY(point.p.value)}
              </text>
            );
          })}

          <line
            x1={plotX}
            x2={plotX + plotW}
            y1={plotBottom}
            y2={plotBottom}
            className="r365-timeseries__axis-line"
          />
          <line x1={plotX} x2={plotX} y1={plotY} y2={plotBottom} className="r365-timeseries__axis-line" />

          {areaD ? <path d={areaD} fill={`url(#${gradientId})`} /> : null}
          {lineD ? (
            <path d={lineD} fill="none" stroke={lineColor} strokeWidth="2.2" strokeLinejoin="round" />
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
                r={hoveredIso === pt.p.dateIso || pts.length === 1 ? 4.5 : 3.4}
                fill={lineColor}
                stroke={CHART_BG}
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>

        {showTooltip && hovered ? (
          <div
            className="r365-timeseries__tooltip"
            style={{
              left: `${Math.min(Math.max((hovered.x / w) * 100, 10), 90)}%`,
              top: `${Math.max((hovered.y / h) * 100 - 10, 4)}%`,
            }}
          >
            <div className="r365-timeseries__tooltip-date">
              {new Date(hovered.p.dateIso).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "UTC",
              })}
            </div>
            {hovered.p.label ? (
              <div className="r365-timeseries__tooltip-label">{hovered.p.label}</div>
            ) : null}
            <div className="r365-timeseries__tooltip-value">
              {formatValueLabel ? formatValueLabel(hovered.p.value) : formatY(hovered.p.value)}
            </div>
            {hovered.p.secondary ? (
              <div className="r365-timeseries__tooltip-secondary">{hovered.p.secondary}</div>
            ) : null}
            {hovered.p.metaRows?.map((row) => (
              <div key={row.label} className="r365-timeseries__tooltip-row">
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {emptyState ? (
        <div className="r365-timeseries__status" aria-live="polite">
          <span className="r365-timeseries__status-label">{emptyState}</span>
          {emptyHelper ? <span className="r365-timeseries__status-helper">{emptyHelper}</span> : null}
        </div>
      ) : null}
    </figure>
  );
}
