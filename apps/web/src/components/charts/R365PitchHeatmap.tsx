"use client";

import { useId, useMemo, useState } from "react";
import {
  emptyPitchZoneCells,
  heatColor,
  zoneHeatIntensity,
  type PitchHeatmapCell,
} from "@/lib/public-player-spatial-stats-math";
import type { SpatialStatsCoverage } from "@/lib/public-player-spatial-stats-types";

export type { PitchHeatmapCell };

export type R365PitchHeatmapMode = "passing" | "kicking";

export type R365PitchHeatmapProps = {
  mode: R365PitchHeatmapMode;
  cells: PitchHeatmapCell[] | null;
  coverage: SpatialStatsCoverage;
  emptyMessage?: string | null;
  className?: string;
};

const VB = { w: 200, h: 248 };
const ATTACK_Y = 32;
const DEFENCE_Y = 212;
const FAR_LEFT = 48;
const FAR_RIGHT = 152;
const NEAR_LEFT = 16;
const NEAR_RIGHT = 184;
const INGOAL_FAR_Y = 14;
const INGOAL_NEAR_Y = 230;
const LINE = "rgba(255,255,255,0.42)";
const LINE_SOFT = "rgba(255,255,255,0.26)";
const LINE_FAINT = "rgba(255,255,255,0.16)";
const EMPTY_ZONE = "#14532d";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function edgeX(across: number, y: number): number {
  const t = (y - ATTACK_Y) / (DEFENCE_Y - ATTACK_Y);
  return lerp(lerp(FAR_LEFT, NEAR_LEFT, t), lerp(FAR_RIGHT, NEAR_RIGHT, t), across);
}

function pt(across: number, y: number): [number, number] {
  return [edgeX(across, y), y];
}

function poly(points: Array<[number, number]>): string {
  return points.map((p) => p.join(",")).join(" ");
}

function lineAtDepth(down: number): { x1: number; y1: number; x2: number; y2: number } {
  const y = lerp(ATTACK_Y, DEFENCE_Y, down);
  const [x1, y1] = pt(0, y);
  const [x2, y2] = pt(1, y);
  return { x1, y1, x2, y2 };
}

function zoneCorners(row: number, col: number): Array<[number, number]> {
  const y0 = lerp(ATTACK_Y, DEFENCE_Y, row / 3);
  const y1 = lerp(ATTACK_Y, DEFENCE_Y, (row + 1) / 3);
  const a0 = col / 3;
  const a1 = (col + 1) / 3;
  return [pt(a0, y0), pt(a1, y0), pt(a1, y1), pt(a0, y1)];
}

function centroid(points: Array<[number, number]>): [number, number] {
  const x = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const y = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return [x, y];
}

function coverageTooltip(coverage: SpatialStatsCoverage, mode: R365PitchHeatmapMode): string {
  if (coverage.method === "position") {
    const bits = [
      "Method: POSITION-BASED (not spatial coordinates)",
      `${coverage.totalEvents} passes · ${coverage.matchesUsed} matches used`,
      "Zones estimated from playing position until pass coordinates are available.",
    ];
    if (coverage.sources.length) bits.push(`Sources: ${coverage.sources.join(", ")}`);
    for (const note of coverage.notes) {
      if (
        note.startsWith("Method:") ||
        note.startsWith("Zones estimated") ||
        note.includes("matches used")
      ) {
        continue;
      }
      bits.push(note);
    }
    return bits.join(" · ");
  }
  const label = mode === "passing" ? "passes" : "kicks from hand";
  const bits = [
    `${coverage.eventsWithCoords} of ${coverage.totalEvents} ${label} with coordinates`,
    coverage.coveragePct != null ? `${coverage.coveragePct}% coordinate coverage` : null,
    `${coverage.matchesWithCoords} of ${coverage.matchesInScope} matches with coords`,
  ].filter(Boolean);
  if (coverage.sources.length) bits.push(`Sources: ${coverage.sources.join(", ")}`);
  if (coverage.notes[0]) bits.push(coverage.notes[0]!);
  return bits.join(" · ");
}

function zoneTooltip(cell: PitchHeatmapCell): string {
  const parts = [cell.label];
  if (cell.count > 0) parts.push(`${cell.count} events`);
  if (cell.percent != null) parts.push(`${cell.percent}%`);
  return parts.join(" · ");
}

export function R365PitchHeatmap({
  mode,
  cells,
  coverage,
  emptyMessage,
  className,
}: R365PitchHeatmapProps) {
  const grassId = `r365-pitch-grass-${useId().replace(/:/g, "")}`;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const hasData = cells != null && cells.some((c) => c.count > 0);
  const legendLow = mode === "passing" ? "Few Passes" : "Few Kicks";
  const legendHigh = mode === "passing" ? "Most Passes" : "Most Kicks";
  const ariaLabel = hasData
    ? `${mode} zone heatmap`
    : `${mode} zone pitch — no spatial coordinates for this period`;

  const gridCells = useMemo(() => {
    const base = emptyPitchZoneCells();
    if (!cells) return base;
    return base.map((fallback, i) => cells[i] ?? fallback);
  }, [cells]);

  return (
    <div
      className={`r365-pitch-heatmap${hasData ? "" : " is-empty"}${className ? ` ${className}` : ""}`}
      title={coverageTooltip(coverage, mode)}
    >
      <div className="r365-pitch-heatmap__pitch">
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <linearGradient id={grassId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0b3d1f" />
              <stop offset="100%" stopColor="#166534" />
            </linearGradient>
          </defs>
          <polygon
            points={poly([
              pt(0, INGOAL_FAR_Y),
              pt(1, INGOAL_FAR_Y),
              pt(1, INGOAL_NEAR_Y),
              pt(0, INGOAL_NEAR_Y),
            ])}
            fill={`url(#${grassId})`}
          />
          {gridCells.map((cell) => {
            const row = Math.floor(cell.index / 3);
            const col = cell.index % 3;
            const corners = zoneCorners(row, col);
            const [cx, cy] = centroid(corners);
            const intensity = hasData ? zoneHeatIntensity(gridCells, cell.index) : 0;
            const fill = hasData ? heatColor(mode, intensity) : EMPTY_ZONE;
            const isActive = hasData && activeIndex === cell.index;
            return (
              <g
                key={cell.key}
                className={`r365-pitch-heatmap__zone${isActive ? " is-active" : ""}`}
                tabIndex={hasData ? 0 : undefined}
                role={hasData ? "button" : undefined}
                aria-label={hasData ? zoneTooltip(cell) : undefined}
                onMouseEnter={hasData ? () => setActiveIndex(cell.index) : undefined}
                onMouseLeave={hasData ? () => setActiveIndex(null) : undefined}
                onFocus={hasData ? () => setActiveIndex(cell.index) : undefined}
                onBlur={hasData ? () => setActiveIndex(null) : undefined}
              >
                {hasData ? <title>{zoneTooltip(cell)}</title> : null}
                <polygon
                  points={poly(corners)}
                  fill={fill}
                  stroke={isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.22)"}
                  strokeWidth={isActive ? 1.2 : 0.7}
                />
                {hasData && cell.percent != null && cell.count > 0 ? (
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="13"
                    fontWeight="800"
                    style={{ pointerEvents: "none" }}
                  >
                    {cell.percent}%
                  </text>
                ) : null}
              </g>
            );
          })}
          <PitchMarkings />
        </svg>
        {!hasData && emptyMessage ? (
          <p className="r365-pitch-heatmap__overlay">{emptyMessage}</p>
        ) : null}
      </div>
      <div className="r365-pitch-heatmap__legend" aria-hidden>
        <span>{legendLow}</span>
        <i className={`r365-pitch-heatmap__scale is-${mode}`} />
        <span>{legendHigh}</span>
      </div>
    </div>
  );
}

function PitchMarkings() {
  const halfway = lineAtDepth(0.5);
  const twentyTwoFar = lineAtDepth(0.22);
  const twentyTwoNear = lineAtDepth(0.78);
  const outline = poly([
    pt(0, INGOAL_FAR_Y),
    pt(1, INGOAL_FAR_Y),
    pt(1, INGOAL_NEAR_Y),
    pt(0, INGOAL_NEAR_Y),
  ]);
  const tryAttack = lineAtDepth(0);
  const tryDefence = lineAtDepth(1);
  const leftTouch = poly([pt(0, INGOAL_FAR_Y), pt(0, INGOAL_NEAR_Y)]);
  const rightTouch = poly([pt(1, INGOAL_FAR_Y), pt(1, INGOAL_NEAR_Y)]);

  const goalFar = poly([
    pt(0.39, INGOAL_FAR_Y),
    pt(0.61, INGOAL_FAR_Y),
    pt(0.61, ATTACK_Y),
    pt(0.39, ATTACK_Y),
  ]);
  const goalNear = poly([
    pt(0.39, DEFENCE_Y),
    pt(0.61, DEFENCE_Y),
    pt(0.61, INGOAL_NEAR_Y),
    pt(0.39, INGOAL_NEAR_Y),
  ]);

  return (
    <g className="r365-pitch-heatmap__markings" pointerEvents="none">
      <polygon points={outline} fill="none" stroke={LINE} strokeWidth="1.15" />
      <polyline points={leftTouch} fill="none" stroke={LINE} strokeWidth="1.15" />
      <polyline points={rightTouch} fill="none" stroke={LINE} strokeWidth="1.15" />
      <line {...tryAttack} stroke={LINE} strokeWidth="1.05" />
      <line {...tryDefence} stroke={LINE} strokeWidth="1.05" />
      <line {...halfway} stroke={LINE} strokeWidth="0.95" />
      <line {...lineAtDepth(1 / 3)} stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" />
      <line {...lineAtDepth(2 / 3)} stroke="rgba(255,255,255,0.22)" strokeWidth="0.7" />
      <line
        x1={pt(1 / 3, ATTACK_Y)[0]}
        y1={pt(1 / 3, ATTACK_Y)[1]}
        x2={pt(1 / 3, DEFENCE_Y)[0]}
        y2={pt(1 / 3, DEFENCE_Y)[1]}
        stroke={LINE_FAINT}
        strokeWidth="0.55"
      />
      <line
        x1={pt(2 / 3, ATTACK_Y)[0]}
        y1={pt(2 / 3, ATTACK_Y)[1]}
        x2={pt(2 / 3, DEFENCE_Y)[0]}
        y2={pt(2 / 3, DEFENCE_Y)[1]}
        stroke={LINE_FAINT}
        strokeWidth="0.55"
      />
      <line {...twentyTwoFar} stroke={LINE_SOFT} strokeWidth="0.75" />
      <line {...twentyTwoNear} stroke={LINE_SOFT} strokeWidth="0.75" />
      <polygon points={goalFar} fill="none" stroke={LINE_FAINT} strokeWidth="0.65" />
      <polygon points={goalNear} fill="none" stroke={LINE_FAINT} strokeWidth="0.65" />
      <GoalPosts across={0.5} y={ATTACK_Y} intoInGoal={-5.5} />
      <GoalPosts across={0.5} y={DEFENCE_Y} intoInGoal={5.5} />
    </g>
  );
}

function GoalPosts({
  across,
  y,
  intoInGoal,
}: {
  across: number;
  y: number;
  intoInGoal: number;
}) {
  const width = 0.045;
  const [lx, ly] = pt(across - width, y);
  const [rx, ry] = pt(across + width, y);
  const [ltx, lty] = pt(across - width, y + intoInGoal);
  const [rtx, rty] = pt(across + width, y + intoInGoal);
  return (
    <g stroke={LINE_SOFT} strokeWidth="0.85" fill="none">
      <line x1={lx} y1={ly} x2={ltx} y2={lty} />
      <line x1={rx} y1={ry} x2={rtx} y2={rty} />
      <line x1={ltx} y1={lty} x2={rtx} y2={rty} />
    </g>
  );
}
