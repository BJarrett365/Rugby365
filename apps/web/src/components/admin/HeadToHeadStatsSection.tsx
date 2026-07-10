"use client";

import { useMemo, useState } from "react";
import type { HeadToHeadCompetitionRecord } from "@/lib/head-to-head-shared";
import { H2H_DATA_FROM_YEAR } from "@/lib/head-to-head-shared";

function formatStat(value: number | null) {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function StatRow({
  label,
  homeValue,
  awayValue,
}: {
  label: string;
  homeValue: number | null;
  awayValue: number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2 border-b border-zinc-800/80 last:border-b-0 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="text-zinc-100 text-right tabular-nums min-w-[3rem]">{formatStat(homeValue)}</span>
      <span className="text-zinc-100 text-right tabular-nums min-w-[3rem]">{formatStat(awayValue)}</span>
    </div>
  );
}

export function HeadToHeadStatsSection({
  homeTeam,
  awayTeam,
  slots,
  dataFromYear = H2H_DATA_FROM_YEAR,
  sourceLabel = "Planet Rugby SDMS",
}: {
  homeTeam: string;
  awayTeam: string;
  slots: HeadToHeadCompetitionRecord[];
  dataFromYear?: number;
  sourceLabel?: string;
}) {
  const availableSlots = useMemo(() => slots.filter((slot) => slot.hasData), [slots]);
  const [activeName, setActiveName] = useState<string | null>(null);

  const active =
    availableSlots.find((slot) => slot.competitionName === activeName) ??
    availableSlots[0] ??
    slots[0] ??
    null;

  if (!slots.length) {
    return <p className="text-sm text-zinc-500 m-0">No head-to-head stats imported yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => {
          const selected = active?.competitionName === slot.competitionName;
          return (
            <button
              key={slot.competitionName}
              type="button"
              disabled={!slot.hasData}
              onClick={() => setActiveName(slot.competitionName)}
              className={[
                "rounded-full px-3 py-1.5 text-xs touch-target border transition-colors",
                !slot.hasData
                  ? "border-zinc-800 text-zinc-600 cursor-not-allowed"
                  : selected
                    ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-300"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500",
              ].join(" ")}
            >
              {slot.competitionName}
            </button>
          );
        })}
      </div>

      {active?.hasData ? (
        <div className="cms-card--nested p-4">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-end pb-3 border-b border-zinc-800 mb-1">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Metric</span>
            <span className="text-xs uppercase tracking-wide text-zinc-500 text-right max-w-[8rem] truncate" title={homeTeam}>
              {homeTeam}
            </span>
            <span className="text-xs uppercase tracking-wide text-zinc-500 text-right max-w-[8rem] truncate" title={awayTeam}>
              {awayTeam}
            </span>
          </div>

          <StatRow label="Wins" homeValue={active.homeWins} awayValue={active.awayWins} />
          <StatRow label="Average tries" homeValue={active.homeAvgTries} awayValue={active.awayAvgTries} />
          <StatRow label="Average carries" homeValue={active.homeAvgCarries} awayValue={active.awayAvgCarries} />
          <StatRow label="Average tackles" homeValue={active.homeAvgTackles} awayValue={active.awayAvgTackles} />
        </div>
      ) : (
        <p className="text-sm text-zinc-500 m-0">
          No recorded meetings in this competition between {homeTeam} and {awayTeam}.
        </p>
      )}

      <p className="text-xs text-zinc-600 m-0">
        Data from {dataFromYear} · Source: {sourceLabel}
      </p>
    </div>
  );
}
