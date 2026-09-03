"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CoachRatingTrendPoint,
  CoachRatingTrendsBundle,
  CoachTrendFilter,
} from "@/lib/coach-rating-trends-types";
import { COACH_TREND_FILTER_LABELS } from "@/lib/coach-rating-trends-types";

type Props = {
  slug: string;
  initial: CoachRatingTrendsBundle;
  compact?: boolean;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtAxis(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function signed(n: number | null | undefined): string {
  if (n == null) return "—";
  return n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1);
}

function resultColor(result: string | null): string {
  if (result === "W") return "#22c55e";
  if (result === "D") return "#f59e0b";
  if (result === "L") return "#ef4444";
  return "#22c55e";
}

export function CoachRatingTrendsCard({ slug, initial, compact = true }: Props) {
  const [filter, setFilter] = useState<CoachTrendFilter>(initial?.summary?.filter ?? "last_24");
  const [bundle, setBundle] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const points = bundle?.points ?? [];
  const summary = bundle?.summary ?? {
    current: null,
    rangeChange: null,
    high: null,
    low: null,
    trend: "stable" as const,
    trendLabel: "Stable",
    trendVersion: "",
    pointCount: 0,
    filter,
    filterLabel: COACH_TREND_FILTER_LABELS[filter],
  };
  const active = points.find((p) => p.id === activeId) ?? null;

  const chart = useMemo(
    () => (points.length >= 2 ? buildChart(points, compact) : null),
    [points, compact],
  );

  async function onFilterChange(next: CoachTrendFilter) {
    setFilter(next);
    setBusy(true);
    setActiveId(null);
    try {
      const res = await fetch(
        `/api/public/coaches/${encodeURIComponent(slug)}/rating-trends?filter=${next}`,
      );
      if (res.ok) {
        const data = (await res.json()) as CoachRatingTrendsBundle;
        setBundle(data);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pr-coach-card pr-coach-card--fill pr-coach-trends">
      <div className="pr-coach-card__head">
        <h2>Rating Trends</h2>
        <div className="pr-coach-trends__head-actions">
          <label className="pr-coach-trends__filter">
            <span className="sr-only">Range</span>
            <select
              value={filter}
              disabled={busy}
              onChange={(e) => onFilterChange(e.target.value as CoachTrendFilter)}
            >
              {(Object.keys(COACH_TREND_FILTER_LABELS) as CoachTrendFilter[]).map((key) => (
                <option key={key} value={key}>
                  {COACH_TREND_FILTER_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          {compact ? (
            <Link className="pr-coach-card__link" href={`/coaches/${slug}/stats#rating-trends`}>
              View full trends &gt;
            </Link>
          ) : null}
        </div>
      </div>

      {!chart || points.length < 2 ? (
        <p className="pr-coach-empty">
          {points.length === 0
            ? "No match-linked rating history yet. Trends appear as eligible matches are rated."
            : "Need at least two match-linked rating points."}
        </p>
      ) : (
        <div className="pr-coach-trends__body">
          <div className={`pr-coach-trends__stats${compact ? "" : " pr-coach-trends__stats--wide"}`}>
            <div>
              <div className="pr-coach-trends__stat-label">Current</div>
              <div className="pr-coach-trends__stat-value">
                {summary.current != null ? summary.current.toFixed(1) : "—"}
              </div>
            </div>
            <div>
              <div className="pr-coach-trends__stat-label">Change</div>
              <div
                className={`pr-coach-trends__stat-value ${
                  summary.rangeChange != null && summary.rangeChange > 0
                    ? "up"
                    : summary.rangeChange != null && summary.rangeChange < 0
                      ? "down"
                      : ""
                }`}
              >
                {summary.rangeChange != null && summary.rangeChange > 0 ? "▲ " : ""}
                {summary.rangeChange != null && summary.rangeChange < 0 ? "▼ " : ""}
                {signed(summary.rangeChange)}
              </div>
            </div>
            <div>
              <div className="pr-coach-trends__stat-label">High</div>
              <div className="pr-coach-trends__stat-value">
                {summary.high != null ? summary.high.toFixed(1) : "—"}
              </div>
            </div>
            {!compact ? (
              <div>
                <div className="pr-coach-trends__stat-label">Low</div>
                <div className="pr-coach-trends__stat-value">
                  {summary.low != null ? summary.low.toFixed(1) : "—"}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pr-coach-trends__chart-wrap">
            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="pr-coach-trends__svg"
              role="img"
              aria-label="Rugby365 Coach Rating over selected matches"
            >
              {chart.yTicks.map((t) => (
                <g key={t.v}>
                  <line
                    x1={chart.padL}
                    x2={chart.width - chart.padR}
                    y1={t.y}
                    y2={t.y}
                    className="pr-coach-trends__grid"
                  />
                  <text x={chart.padL - 6} y={t.y + 3} textAnchor="end" className="pr-coach-trends__axis">
                    {t.v}
                  </text>
                </g>
              ))}
              {chart.areaPath ? (
                <path d={chart.areaPath} className="pr-coach-trends__area" />
              ) : null}
              <path d={chart.path} fill="none" className="pr-coach-trends__line" />
              {chart.coords.map((c) => (
                <circle
                  key={c.p.id}
                  cx={c.x}
                  cy={c.y}
                  r={c.p.majorMatchLabel ? 4 : 2.75}
                  fill={resultColor(c.p.result)}
                  stroke={c.p.id === activeId ? "#fff" : "rgba(0,0,0,0.35)"}
                  strokeWidth={c.p.id === activeId ? 1.5 : 0.75}
                  className="pr-coach-trends__point"
                  onMouseEnter={() => setActiveId(c.p.id)}
                  onFocus={() => setActiveId(c.p.id)}
                  onClick={() => setActiveId(c.p.id === activeId ? null : c.p.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${fmtDate(c.p.matchDate)} rating ${c.p.rating}`}
                />
              ))}
              {chart.xLabels.map((l) => (
                <text
                  key={`${l.i}-${l.label}`}
                  x={l.x}
                  y={chart.height - 6}
                  textAnchor={l.anchor}
                  className="pr-coach-trends__axis"
                >
                  {l.label}
                </text>
              ))}
            </svg>
            {active ? (
              <div className="pr-coach-trends__tooltip-layer">
                <TrendTooltip point={active} />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function TrendTooltip({ point }: { point: CoachRatingTrendPoint }) {
  const drivers = [...point.contributions]
    .filter((c) => c.contribution != null && Math.abs(c.contribution) >= 0.01)
    .sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0))
    .slice(0, 6);

  return (
    <div className="pr-coach-trends__tooltip">
      {point.majorMatchLabel ? (
        <div className="pr-coach-trends__tooltip-major">🏆 {point.majorMatchLabel}</div>
      ) : null}
      <div className="pr-coach-trends__tooltip-title">
        {(point.teamName ?? "Team").toUpperCase()} {point.scoreFor ?? "—"}–{point.scoreAgainst ?? "—"}{" "}
        {(point.opponentName ?? "Opponent").toUpperCase()}
      </div>
      <div className="pr-coach-trends__tooltip-meta">
        {fmtDate(point.matchDate)}
        {point.competitionName ? ` · ${point.competitionName}` : ""}
      </div>
      <div className="pr-coach-trends__tooltip-grid">
        <div>
          <span>Rugby365 Rating</span>
          <strong>
            {point.previousRating != null ? `${point.previousRating.toFixed(1)} → ` : ""}
            {point.rating.toFixed(1)}
          </strong>
        </div>
        <div>
          <span>Change</span>
          <strong className={point.change != null && point.change > 0 ? "up" : point.change != null && point.change < 0 ? "down" : ""}>
            {point.change != null && point.change > 0 ? "▲ " : ""}
            {signed(point.change)}
          </strong>
        </div>
        <div>
          <span>Power Index</span>
          <strong>
            {point.powerIndexChange != null && point.powerIndex != null
              ? `${(point.powerIndex - point.powerIndexChange).toFixed(1)} → `
              : ""}
            {point.powerIndex != null ? point.powerIndex.toFixed(1) : "—"}
          </strong>
        </div>
        <div>
          <span>Result</span>
          <strong>{point.result ?? "—"}</strong>
        </div>
        {point.confidence != null ? (
          <div>
            <span>Confidence</span>
            <strong>{point.confidence}%</strong>
          </div>
        ) : null}
      </div>
      {drivers.length ? (
        <div className="pr-coach-trends__drivers">
          <div className="pr-coach-trends__drivers-title">Rating drivers</div>
          <ul>
            {drivers.map((d) => (
              <li key={d.key}>
                <span>{d.label ?? d.key}</span>
                <span className={(d.contribution ?? 0) >= 0 ? "up" : "down"}>
                  {signed(d.contribution ?? null)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {point.intelligence.filter((m) => m.previousScore != null && m.score != null).length ? (
        <div className="pr-coach-trends__drivers">
          <div className="pr-coach-trends__drivers-title">Intelligence change</div>
          <ul>
            {point.intelligence
              .filter((m) => m.previousScore != null && m.score != null)
              .slice(0, 6)
              .map((m) => (
                <li key={m.key}>
                  <span>{m.label ?? m.key}</span>
                  <span>
                    {m.previousScore!.toFixed(0)} → {m.score!.toFixed(0)}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function buildChart(points: CoachRatingTrendPoint[], compact: boolean) {
  if (points.length < 2) {
    return null;
  }
  const width = compact ? 320 : 640;
  const height = compact ? 132 : 220;
  const padL = 26;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const vals = points.map((p) => p.rating);
  const minRating = Math.min(...vals);
  const maxRating = Math.max(...vals);
  const minV = Math.max(0, Math.floor((minRating - 4) / 10) * 10);
  const maxV = Math.min(100, Math.ceil((maxRating + 4) / 10) * 10);
  const span = Math.max(maxV - minV, 10);

  const times = points.map((p) => Date.parse(p.matchDate ?? ""));
  const validTimes = times.filter((t) => !Number.isNaN(t));
  const minT = validTimes.length ? Math.min(...validTimes) : 0;
  const maxT = validTimes.length ? Math.max(...validTimes) : 1;
  const timeSpan = Math.max(maxT - minT, 1);

  const coords = points.map((p, i) => {
    const t = Date.parse(p.matchDate ?? "");
    const x =
      validTimes.length > 1 && !Number.isNaN(t)
        ? padL + ((t - minT) / timeSpan) * (width - padL - padR)
        : padL + (i / Math.max(points.length - 1, 1)) * (width - padL - padR);
    const y = padT + (1 - (p.rating - minV) / span) * (height - padT - padB);
    return { x, y, p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const baseline = height - padB;
  const areaPath =
    coords.length >= 2
      ? `${path} L${coords[coords.length - 1]!.x.toFixed(1)},${baseline} L${coords[0]!.x.toFixed(1)},${baseline} Z`
      : "";

  const yTicks: Array<{ v: number; y: number }> = [];
  for (let v = minV; v <= maxV; v += 10) {
    yTicks.push({
      v,
      y: padT + (1 - (v - minV) / span) * (height - padT - padB),
    });
  }

  // Space labels by pixel distance so clustered match dates don't collide.
  const minLabelGap = compact ? 56 : 72;
  const candidates = [0, ...coords.map((_, i) => i).slice(1, -1), coords.length - 1];
  const chosen: number[] = [];
  for (const i of candidates) {
    const x = coords[i]!.x;
    if (chosen.every((j) => Math.abs(x - coords[j]!.x) >= minLabelGap)) {
      chosen.push(i);
    }
  }
  if (!chosen.includes(0)) chosen.unshift(0);
  if (!chosen.includes(coords.length - 1)) chosen.push(coords.length - 1);

  const xLabels = [...new Set(chosen)]
    .sort((a, b) => a - b)
    .map((i, idx, arr) => ({
      i,
      x: coords[i]!.x,
      label: fmtAxis(points[i]!.matchDate),
      anchor: (idx === 0 ? "start" : idx === arr.length - 1 ? "end" : "middle") as
        | "start"
        | "middle"
        | "end",
    }));

  return { width, height, padL, padR, path, areaPath, coords, yTicks, xLabels };
}
