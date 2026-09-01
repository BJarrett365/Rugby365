"use client";

import { FormDots } from "@/components/competitions/FormDots";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { rankingCountryFlagUrl } from "@/lib/player-ranking-engine";
import { parseStandingForm } from "@/lib/standing-form";

type StandingRow = {
  rank: number;
  teamName: string;
  teamSlug: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsDiff: number;
  bonusPoints: number;
  points: number;
  form: string | null;
  teamImageUrl?: string | null;
};

export function LeagueTable({
  rows,
  showForm = true,
  compact = false,
}: {
  rows: StandingRow[];
  showForm?: boolean;
  compact?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500 m-0">No standings data yet. Sync from SDMS in CMS.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm league-table">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
            <th className="py-2 pr-2 w-8">#</th>
            <th className="py-2 pr-3">Team</th>
            {showForm && !compact && <th className="py-2 pr-3">Form</th>}
            <th className="py-2 pr-2 text-center">P</th>
            <th className="py-2 pr-2 text-center">W</th>
            {!compact && <th className="py-2 pr-2 text-center">D</th>}
            <th className="py-2 pr-2 text-center">L</th>
            {!compact && <th className="py-2 pr-2 text-center">PD</th>}
            {!compact && <th className="py-2 pr-2 text-center">BP</th>}
            <th className="py-2 pr-2 text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const bonus = parseStandingForm(r.form);
            const bonusTitle =
              bonus.tryBonusPoints != null || bonus.losingBonusPoints != null
                ? `Try bonus ${bonus.tryBonusPoints ?? 0} · Losing bonus ${bonus.losingBonusPoints ?? 0}`
                : undefined;
            return (
            <tr key={r.teamSlug} className="border-b border-zinc-800/60">
              <td className="py-2.5 pr-2 font-mono text-zinc-500">{r.rank}</td>
              <td className="py-2.5 pr-3 font-medium text-zinc-100">
                <span className="inline-flex items-center gap-2">
                  <TeamCrest
                    name={r.teamName}
                    imageUrl={r.teamImageUrl || rankingCountryFlagUrl(r.teamName)}
                    size="xs"
                  />
                  {r.teamName}
                </span>
              </td>
              {showForm && !compact && (
                <td className="py-2.5 pr-3">
                  <FormDots form={r.form} slots={5} pad />
                </td>
              )}
              <td className="py-2.5 pr-2 text-center font-mono tabular-nums">{r.played}</td>
              <td className="py-2.5 pr-2 text-center font-mono tabular-nums">{r.won}</td>
              {!compact && (
                <td className="py-2.5 pr-2 text-center font-mono tabular-nums">{r.draw}</td>
              )}
              <td className="py-2.5 pr-2 text-center font-mono tabular-nums">{r.lost}</td>
              {!compact && (
                <td className="py-2.5 pr-2 text-center font-mono tabular-nums">
                  {r.pointsDiff > 0 ? `+${r.pointsDiff}` : r.pointsDiff}
                </td>
              )}
              {!compact && (
                <td className="py-2.5 pr-2 text-center font-mono tabular-nums" title={bonusTitle}>
                  {r.bonusPoints}
                </td>
              )}
              <td className="py-2.5 pr-2 text-center font-mono tabular-nums font-semibold text-zinc-100">
                {r.points}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
