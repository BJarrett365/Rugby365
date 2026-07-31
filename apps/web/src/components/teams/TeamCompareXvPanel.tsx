"use client";

import Link from "next/link";
import { PlayerBadge } from "@/components/players/PlayerBadge";
import type { TeamXvSlot } from "@/lib/team-compare-intelligence";
import type { TeamXvSummary } from "@/lib/team-compare-types";

const PITCH_SLOTS: Record<number, { top: string; left: string }> = {
  1: { top: "8%", left: "28%" },
  2: { top: "8%", left: "50%" },
  3: { top: "8%", left: "72%" },
  4: { top: "22%", left: "38%" },
  5: { top: "22%", left: "62%" },
  6: { top: "36%", left: "22%" },
  8: { top: "36%", left: "50%" },
  7: { top: "36%", left: "78%" },
  9: { top: "50%", left: "50%" },
  10: { top: "60%", left: "50%" },
  11: { top: "74%", left: "16%" },
  12: { top: "74%", left: "38%" },
  13: { top: "74%", left: "62%" },
  14: { top: "74%", left: "84%" },
  15: { top: "88%", left: "50%" },
};

function TeamXvPitch({
  teamName,
  slots,
  summary,
}: {
  teamName: string;
  slots: TeamXvSlot[];
  summary: TeamXvSummary;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="m-0 text-sm font-semibold text-[var(--pr-mc-text)]">{teamName}</h3>
        <p className="m-0 text-xs text-[var(--pr-mc-muted)]">
          XV {summary.valueLabel} · avg {summary.averageRating ?? "—"} · age{" "}
          {summary.averageAge ?? "—"} · {summary.filled}/15
        </p>
      </div>
      <div
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-[var(--pr-mc-border)]"
        style={{
          aspectRatio: "3 / 4",
          background:
            "linear-gradient(180deg, rgba(34, 90, 54, 0.95) 0%, rgba(22, 64, 40, 0.98) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-[8%] top-1/2 h-px bg-white/25"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/2 top-[8%] h-[84%] w-px bg-white/15"
          aria-hidden
        />
        {slots.map((slot) => {
          const pos = PITCH_SLOTS[slot.jersey];
          if (!pos) return null;
          const player = slot.player;
          return (
            <div
              key={slot.jersey}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: pos.top, left: pos.left }}
              title={player ? `${slot.jersey}. ${player.name}` : `${slot.jersey}. ${slot.label}`}
            >
              {player ? (
                <PlayerBadge
                  name={player.name}
                  rating={player.rating}
                  positionName={player.positionName}
                  marketValueLabel={player.marketValueLabel}
                  slug={player.slug}
                  size="micro"
                  compact
                />
              ) : (
                <div className="flex h-11 w-8 flex-col items-center justify-center rounded-md border border-white/20 bg-black/35 text-[10px] text-white/80">
                  <span className="font-bold">{slot.jersey}</span>
                  <span className="max-w-[2.5rem] truncate">{slot.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TeamCompareXvPanel({
  teamAName,
  teamBName,
  slotsA,
  slotsB,
  summaryA,
  summaryB,
}: {
  teamAName: string;
  teamBName: string;
  slotsA: TeamXvSlot[];
  slotsB: TeamXvSlot[];
  summaryA: TeamXvSummary;
  summaryB: TeamXvSummary;
}) {
  return (
    <div className="space-y-3">
      <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
        Modelled starting XVs from squad ratings and positions. Tap a badge for the player profile.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <TeamXvPitch teamName={teamAName} slots={slotsA} summary={summaryA} />
        <TeamXvPitch teamName={teamBName} slots={slotsB} summary={summaryB} />
      </div>
      <p className="m-0 text-center text-xs text-[var(--pr-mc-grey)]">
        <Link href="/players/compare" className="text-[var(--pr-mc-link,#54b989)] hover:underline">
          Open player compare
        </Link>{" "}
        to dig into individual matchups.
      </p>
    </div>
  );
}
