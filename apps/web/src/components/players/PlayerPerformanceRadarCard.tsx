"use client";

import { useMemo, useState } from "react";
import {
  R365RadarChart,
  buildR365RadarSeriesFromMetrics,
} from "@/components/charts/R365RadarChart";
import {
  buildRadarMetricValues,
  canDrawRadarPolygon,
  type RadarAxisKey,
  type RadarMetricValue,
} from "@/lib/player-intelligence-position-config";

export type PlayerPerformanceRadarPeriod = {
  id: string;
  label: string;
  metrics: RadarMetricValue[];
  peerScores?: Partial<Record<RadarAxisKey, number | null>> | null;
  peerLabel?: string | null;
  minRadarMetrics: number;
  modelNote?: string | null;
};

export type PlayerPerformanceRadarCardProps = {
  playerName: string;
  periods: PlayerPerformanceRadarPeriod[];
  defaultPeriodId?: string;
};

/** PERFORMANCE RADAR — position-aware spider; React display only. */
export function PlayerPerformanceRadarCard({
  playerName,
  periods,
  defaultPeriodId,
}: PlayerPerformanceRadarCardProps) {
  const initial = defaultPeriodId ?? periods[0]?.id ?? "current";
  const [periodId, setPeriodId] = useState(initial);
  const period = periods.find((p) => p.id === periodId) ?? periods[0] ?? null;

  const metrics = useMemo(() => {
    if (!period) return [];
    return period.metrics.length
      ? period.metrics
      : buildRadarMetricValues({
          axes: [],
          playerScores: {},
        });
  }, [period]);

  const validCount = metrics.filter((m) => m.score != null).length;
  const minRequired = period?.minRadarMetrics ?? 4;
  const drawPolygon = period ? canDrawRadarPolygon(metrics, minRequired) : false;

  const series = useMemo(() => {
    if (!period) return [];
    return buildR365RadarSeriesFromMetrics({
      playerName,
      metrics,
      peerScores: period.peerScores,
      peerLabel: period.peerLabel,
    });
  }, [period, playerName, metrics]);

  const emptyState = !period
    ? "PERFORMANCE PROFILE BUILDING"
    : !drawPolygon
      ? "PERFORMANCE PROFILE BUILDING"
      : null;
  const emptyHelper = !drawPolygon
    ? `${validCount}/${metrics.length || minRequired} intelligence metrics required.`
    : null;

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card">
      <div className="pr-player-v2__card-head">
        <h2>Performance Radar</h2>
        {periods.length > 0 ? (
          <label className="pr-player-v2__widget-select">
            <span className="sr-only">Season</span>
            <select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <R365RadarChart
        axes={metrics.map((m) => ({ key: m.key, label: m.label }))}
        series={series}
        drawPolygon={drawPolygon}
        emptyState={emptyState}
        emptyHelper={emptyHelper}
        className="pr-player-v2__widget-radar"
      />

      {period?.modelNote ? <p className="pr-player-v2__note">{period.modelNote}</p> : null}
    </div>
  );
}
