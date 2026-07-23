"use client";

import { useMemo, useState } from "react";
import type { PlayerRadarBundle, RadarSpoke } from "@/lib/player-radar-build";
import { RADAR_TYPE_LABELS, type RadarType } from "@/lib/player-radar-metrics";

const TYPE_ORDER: RadarType[] = [
  "overall",
  "attack",
  "defence",
  "carrying",
  "set_piece",
  "physical",
  "kicking",
  "discipline",
];

function formatSpokeValue(spoke: RadarSpoke): string {
  if (spoke.playerValue == null || !Number.isFinite(spoke.playerValue)) return "—";
  if (spoke.format === "percent") return `${spoke.playerValue.toFixed(0)}%`;
  if (spoke.format === "count") return spoke.playerValue.toFixed(0);
  return spoke.playerValue.toFixed(1);
}

function formatAvg(spoke: RadarSpoke, which: "position" | "competition"): string {
  const v = which === "position" ? spoke.positionAverage : spoke.competitionAverage;
  if (v == null || !Number.isFinite(v)) return "—";
  if (spoke.format === "percent") return `${v.toFixed(0)}%`;
  if (spoke.format === "count") return v.toFixed(0);
  return v.toFixed(1);
}

export function PlayerPerformanceRadar({
  radar,
  playerName,
  compact = false,
}: {
  radar: PlayerRadarBundle;
  playerName: string;
  compact?: boolean;
}) {
  const [type, setType] = useState<RadarType>(radar.defaultType || "overall");
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const view = radar.radars[type] ?? radar.radars.overall;
  const spokes = view?.spokes ?? [];
  const plottable = spokes.filter((s) => s.percentile != null);

  const size = compact ? 200 : 320;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * (compact ? 0.32 : 0.36);

  const points = useMemo(() => {
    const plot = spokes.filter((s) => s.percentile != null);
    const n = Math.max(plot.length, 1);
    return plot.map((spoke, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const pct = Math.max(0, Math.min(100, spoke.percentile ?? 0));
      const r = (pct / 100) * radius;
      return {
        spoke,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        lx: cx + Math.cos(angle) * (radius + (compact ? 14 : 22)),
        ly: cy + Math.sin(angle) * (radius + (compact ? 14 : 22)),
        ax: cx + Math.cos(angle) * radius,
        ay: cy + Math.sin(angle) * radius,
      };
    });
  }, [spokes, cx, cy, radius, compact]);

  if (!radar.enabled) {
    return <p className="pr-mc-transfers-muted">Performance radar is not published for this player.</p>;
  }

  if (!view || plottable.length < 3) {
    return (
      <div className="pr-perf-radar pr-perf-radar--empty">
        <p className="pr-mc-transfers-muted">
          {view?.summary ||
            `${playerName} does not yet have enough position-comparable minutes for a radar.`}
        </p>
      </div>
    );
  }

  const polygon = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const hovered = hoverKey ? points.find((p) => p.spoke.key === hoverKey) : null;
  const availableTypes = TYPE_ORDER.filter((t) => {
    const r = radar.radars[t];
    if (!r) return false;
    if (r.unavailableReason === "awaiting_source_metrics") return !compact;
    return (r.spokes?.filter((s) => s.percentile != null).length ?? 0) >= 3 || t === type;
  });

  return (
    <figure className={`pr-perf-radar${compact ? " pr-perf-radar--compact" : ""}`}>
      {!compact ? (
        <p className="pr-perf-radar__title">{radar.title}</p>
      ) : (
        <p className="pr-perf-radar__title pr-perf-radar__title--compact">{radar.positionLabel}</p>
      )}

      {!compact ? (
        <div className="pr-perf-radar__types" role="tablist" aria-label="Radar type">
          {availableTypes.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={type === t}
              className={`pr-perf-radar__type${type === t ? " is-active" : ""}`}
              onClick={() => setType(t)}
            >
              {RADAR_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pr-perf-radar__stage">
        <svg
          className="pr-perf-radar__svg"
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label={`${playerName} ${view.typeLabel} radar: ${view.summary}`}
        >
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <polygon
              key={scale}
              className="pr-perf-radar__ring"
              points={points
                .map((_, i) => {
                  const n = points.length;
                  const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                  const r = radius * scale;
                  return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
                })
                .join(" ")}
            />
          ))}
          {points.map((p) => (
            <line
              key={`axis-${p.spoke.key}`}
              className="pr-perf-radar__axis"
              x1={cx}
              y1={cy}
              x2={p.ax}
              y2={p.ay}
            />
          ))}
          <polygon className="pr-perf-radar__shape" points={polygon} />
          {points.map((p) => (
            <g key={p.spoke.key}>
              <circle
                className={`pr-perf-radar__dot${hoverKey === p.spoke.key ? " is-hover" : ""}`}
                cx={p.x}
                cy={p.y}
                r={hoverKey === p.spoke.key ? 5 : 3.5}
                onMouseEnter={() => setHoverKey(p.spoke.key)}
                onMouseLeave={() => setHoverKey(null)}
                onFocus={() => setHoverKey(p.spoke.key)}
                onBlur={() => setHoverKey(null)}
                tabIndex={0}
                role="img"
                aria-label={`${p.spoke.label}: ${formatSpokeValue(p.spoke)}, ${p.spoke.percentile}th percentile`}
              />
              {!compact ? (
                <text
                  className="pr-perf-radar__label"
                  x={p.lx}
                  y={p.ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {p.spoke.label}
                </text>
              ) : null}
            </g>
          ))}
          {[25, 50, 75, 99].map((pct, i) => (
            <text
              key={pct}
              className="pr-perf-radar__scale"
              x={cx + 4}
              y={cy - radius * (pct / 100)}
            >
              {i === 3 ? "99" : String(pct)}
            </text>
          ))}
        </svg>

        {hovered && !compact ? (
          <div className="pr-perf-radar__tooltip" role="status">
            <strong>{hovered.spoke.label}</strong>
            <dl>
              <div>
                <dt>Player</dt>
                <dd>{formatSpokeValue(hovered.spoke)}</dd>
              </div>
              <div>
                <dt>Position avg</dt>
                <dd>{formatAvg(hovered.spoke, "position")}</dd>
              </div>
              <div>
                <dt>Competition avg</dt>
                <dd>{formatAvg(hovered.spoke, "competition")}</dd>
              </div>
              <div>
                <dt>Percentile</dt>
                <dd>{hovered.spoke.percentile ?? "—"}</dd>
              </div>
              <div>
                <dt>Rank</dt>
                <dd>
                  {hovered.spoke.rank != null
                    ? `${hovered.spoke.rank} / ${hovered.spoke.sampleSize}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Sample</dt>
                <dd>{hovered.spoke.sampleSize}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>

      <figcaption className="pr-perf-radar__written">
        {type === radar.defaultType ? radar.summary : view.summary}
      </figcaption>

      {!compact ? (
        <div className="pr-perf-radar__seo">
          <h4 className="pr-perf-radar__seo-heading">
            {view.typeLabel} metrics — {radar.title}
          </h4>
          <div className="pr-player-table-wrap">
            <table className="pr-mc-transfers-table pr-player-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Player</th>
                  <th scope="col">Position avg</th>
                  <th scope="col">Percentile</th>
                  <th scope="col">Rank</th>
                </tr>
              </thead>
              <tbody>
                {spokes.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td>{formatSpokeValue(s)}</td>
                    <td>{formatAvg(s, "position")}</td>
                    <td>{s.percentile != null ? `${s.percentile}` : "—"}</td>
                    <td>
                      {s.rank != null ? `${s.rank} / ${s.sampleSize}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pr-player-footnote">
            Rates are per 80 minutes where applicable. Ranked among {radar.cohortSize}{" "}
            {radar.positionLabel.toLowerCase()} with at least {radar.minMinutes} minutes
            {radar.competitionLabel ? ` in ${radar.competitionLabel}` : ""}.
            {radar.future.playerVsPlayer
              ? ""
              : " Player-vs-player and season-vs-season comparison coming later."}
          </p>
        </div>
      ) : null}
    </figure>
  );
}
