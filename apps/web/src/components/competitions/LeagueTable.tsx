"use client";

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
};

function FormDots({ form }: { form: string | null }) {
  if (!form) return <span className="text-zinc-600">—</span>;
  return (
    <span className="inline-flex gap-0.5">
      {form.split("").map((c, i) => (
        <span
          key={`${c}-${i}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
            c === "W"
              ? "bg-emerald-600 text-white"
              : c === "L"
                ? "bg-red-600 text-white"
                : "bg-zinc-600 text-white"
          }`}
          title={c === "W" ? "Win" : c === "L" ? "Loss" : "Draw"}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

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
          {rows.map((r) => (
            <tr key={r.teamSlug} className="border-b border-zinc-800/60">
              <td className="py-2.5 pr-2 font-mono text-zinc-500">{r.rank}</td>
              <td className="py-2.5 pr-3 font-medium text-zinc-100">{r.teamName}</td>
              {showForm && !compact && (
                <td className="py-2.5 pr-3">
                  <FormDots form={r.form} />
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
                <td className="py-2.5 pr-2 text-center font-mono tabular-nums">{r.bonusPoints}</td>
              )}
              <td className="py-2.5 pr-2 text-center font-mono tabular-nums font-semibold text-zinc-100">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
