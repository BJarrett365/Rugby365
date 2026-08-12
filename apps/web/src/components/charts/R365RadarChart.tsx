"use client";

import { useId, useMemo, useState } from "react";
import type { RadarAxisKey, RadarMetricValue } from "@/lib/player-intelligence-position-config";

export type R365RadarChartSeries = {
  id: string;
  label: string;
  /** Scores aligned to axes order; null = missing (not plotted as 0). */
  values: Array<number | null>;
  color: string;
  dashed?: boolean;
  fillOpacity?: number;
};

export type R365RadarChartProps = {
  axes: Array<{ key: string; label: string }>;
  series: R365RadarChartSeries[];
  /** When false, rings/axes only — no player polygon. */
  drawPolygon?: boolean;
  emptyState?: string | null;
  emptyHelper?: string | null;
  /** Show numeric player scores at axis tips (first solid series). */
  showScoreLabels?: boolean;
  className?: string;
  size?: number;
};

const CHART_GREEN = "#54b989";
const CHART_BLUE = "#5b8fd9";

function polar(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + Math.cos(angle) * r,
    y: cy + Math.sin(angle) * r,
  };
}

/**
 * Shared spider/radar chart for Rugby365 performance profiles.
 * Null scores are skipped in the polygon (gap) rather than forced to centre.
 */
export function R365RadarChart({
  axes,
  series,
  drawPolygon = true,
  emptyState = null,
  emptyHelper = null,
  showScoreLabels = true,
  className,
  size = 280,
}: R365RadarChartProps) {
  const uid = useId().replace(/:/g, "");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const n = axes.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.32;
  const labelR = radius + 28;

  const axisAngles = useMemo(
    () => axes.map((_, i) => (Math.PI * 2 * i) / n - Math.PI / 2),
    [axes, n],
  );

  const ringScales = [0.25, 0.5, 0.75, 1];

  const playerSeries = series.find((s) => !s.dashed) ?? series[0] ?? null;

  return (
    <div className={`r365-radar ${className ?? ""}`.trim()}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="r365-radar__svg"
        role="img"
        aria-label="Performance radar"
      >
        {ringScales.map((scale) => (
          <polygon
            key={`ring-${scale}`}
            className="r365-radar__ring"
            points={axisAngles
              .map((angle) => {
                const p = polar(cx, cy, radius * scale, angle);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(" ")}
          />
        ))}

        {axisAngles.map((angle, i) => {
          const tip = polar(cx, cy, radius, angle);
          return (
            <line
              key={`axis-${axes[i]!.key}`}
              className="r365-radar__axis"
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
            />
          );
        })}

        {drawPolygon
          ? series.map((s) => {
              const pts = axisAngles.map((angle, i) => {
                const v = s.values[i];
                if (v == null || !Number.isFinite(v)) return null;
                const pct = Math.max(0, Math.min(100, v)) / 100;
                return polar(cx, cy, radius * pct, angle);
              });
              const defined = pts.filter(Boolean) as Array<{ x: number; y: number }>;
              if (defined.length < 3) return null;
              // Only connect consecutive defined points; if any null, draw open polyline segments.
              const hasGap = pts.some((p) => p == null);
              const pathD = hasGap
                ? pts
                    .map((p, i) => {
                      if (!p) return null;
                      const prev = i > 0 ? pts[i - 1] : null;
                      return `${prev ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
                    })
                    .filter(Boolean)
                    .join(" ")
                : `M ${defined.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L ")} Z`;

              return (
                <g key={s.id}>
                  {!hasGap && (s.fillOpacity ?? 0) > 0 ? (
                    <path
                      d={pathD}
                      fill={s.color}
                      fillOpacity={s.fillOpacity}
                      stroke="none"
                    />
                  ) : null}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.dashed ? 1.6 : 2.2}
                    strokeDasharray={s.dashed ? "5 4" : undefined}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {pts.map((p, i) =>
                    p ? (
                      <circle
                        key={`${s.id}-dot-${axes[i]!.key}`}
                        cx={p.x}
                        cy={p.y}
                        r={s.dashed ? 2.5 : 3.4}
                        fill={s.color}
                        stroke="#0c2a32"
                        strokeWidth={1.2}
                        onMouseEnter={() => setHoveredKey(axes[i]!.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                      />
                    ) : null,
                  )}
                </g>
              );
            })
          : null}

        {axes.map((axis, i) => {
          const angle = axisAngles[i]!;
          const lp = polar(cx, cy, labelR, angle);
          const score = playerSeries?.values[i] ?? null;
          const anchor =
            Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
          return (
            <g key={`label-${axis.key}`}>
              <text
                x={lp.x}
                y={score != null && showScoreLabels ? lp.y - 8 : lp.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                className="r365-radar__label"
              >
                {axis.label}
              </text>
              {showScoreLabels && score != null ? (
                <text
                  x={lp.x}
                  y={lp.y + 8}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="r365-radar__score"
                  fill={CHART_GREEN}
                >
                  {Math.round(score)}
                  {hoveredKey === axis.key ? "" : ""}
                </text>
              ) : showScoreLabels ? (
                <text
                  x={lp.x}
                  y={lp.y + 8}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="r365-radar__score r365-radar__score--empty"
                >
                  —
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {series.length > 0 ? (
        <div className="r365-radar__legend">
          {series.map((s) => (
            <div key={s.id} className="r365-radar__legend-item">
              <span
                className={`r365-radar__legend-swatch${s.dashed ? " r365-radar__legend-swatch--dashed" : ""}`}
                style={{ ["--swatch" as string]: s.color }}
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {emptyState ? (
        <div className="r365-radar__empty" aria-live="polite">
          <strong>{emptyState}</strong>
          {emptyHelper ? <span>{emptyHelper}</span> : null}
        </div>
      ) : null}

      {/* gradient id reserved for future fills */}
      <svg width={0} height={0} aria-hidden>
        <defs>
          <linearGradient id={`r365-radar-fill-${uid}`}>
            <stop offset="0%" stopColor={CHART_GREEN} stopOpacity="0.25" />
            <stop offset="100%" stopColor={CHART_GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export function buildR365RadarSeriesFromMetrics(input: {
  playerName: string;
  metrics: RadarMetricValue[];
  peerScores?: Partial<Record<RadarAxisKey, number | null>> | null;
  peerLabel?: string | null;
}): R365RadarChartSeries[] {
  const player: R365RadarChartSeries = {
    id: "player",
    label: input.playerName,
    values: input.metrics.map((m) => m.score),
    color: CHART_GREEN,
    fillOpacity: 0.12,
  };
  const out = [player];
  if (input.peerScores && input.peerLabel) {
    out.push({
      id: "peer",
      label: input.peerLabel,
      values: input.metrics.map((m) => {
        const v = input.peerScores?.[m.key];
        return v == null || !Number.isFinite(v) ? null : v;
      }),
      color: CHART_BLUE,
      dashed: true,
      fillOpacity: 0,
    });
  }
  return out;
}

export { CHART_GREEN as R365_RADAR_PLAYER_COLOR, CHART_BLUE as R365_RADAR_PEER_COLOR };
