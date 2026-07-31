"use client";

import Link from "next/link";
import type { TeamPositionBattle } from "@/lib/team-compare-intelligence";

export function TeamComparePositionBattles({
  teamAName,
  teamBName,
  battles,
  score,
}: {
  teamAName: string;
  teamBName: string;
  battles: TeamPositionBattle[];
  score: { a: number; b: number; draws: number };
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          Strongest player at each position (by Rugby365 rating).
        </p>
        <p className="m-0 text-sm font-semibold text-[var(--pr-mc-text)]">
          Position score · {teamAName} {score.a}–{score.b} {teamBName}
          {score.draws > 0 ? ` · ${score.draws} drawn` : ""}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--pr-mc-border)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--pr-mc-panel)] text-left text-xs uppercase tracking-wide text-[var(--pr-mc-grey)]">
              <th className="px-3 py-2 font-medium">Position</th>
              <th className="px-3 py-2 font-medium">{teamAName}</th>
              <th className="px-3 py-2 font-medium text-center">Edge</th>
              <th className="px-3 py-2 font-medium">{teamBName}</th>
              <th className="px-3 py-2 font-medium">Compare</th>
            </tr>
          </thead>
          <tbody>
            {battles.map((battle) => {
              const edge =
                battle.winner === "a"
                  ? teamAName
                  : battle.winner === "b"
                    ? teamBName
                    : battle.winner === "draw"
                      ? "Draw"
                      : "—";
              return (
                <tr
                  key={battle.key}
                  className="border-t border-[var(--pr-mc-border)] text-[var(--pr-mc-text)]"
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{battle.label}</span>
                    <span className="ml-2 text-xs text-[var(--pr-mc-grey)]">
                      #{battle.jerseyHint}
                    </span>
                  </td>
                  <td className={`px-3 py-2${battle.winner === "a" ? " text-[#54b989]" : ""}`}>
                    {battle.playerA ? (
                      <>
                        <Link
                          href={`/players/${battle.playerA.slug}`}
                          className="hover:underline"
                        >
                          {battle.playerA.name}
                        </Link>
                        <span className="ml-2 text-[var(--pr-mc-muted)]">
                          {battle.ratingA ?? "—"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--pr-mc-gold,#e7bc63)]">
                    {edge}
                  </td>
                  <td className={`px-3 py-2${battle.winner === "b" ? " text-[#5b8fd9]" : ""}`}>
                    {battle.playerB ? (
                      <>
                        <Link
                          href={`/players/${battle.playerB.slug}`}
                          className="hover:underline"
                        >
                          {battle.playerB.name}
                        </Link>
                        <span className="ml-2 text-[var(--pr-mc-muted)]">
                          {battle.ratingB ?? "—"}
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {battle.compareHref ? (
                      <Link
                        href={battle.compareHref}
                        className="text-[var(--pr-mc-link,#54b989)] hover:underline"
                      >
                        H2H
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
