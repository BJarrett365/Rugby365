import type { CareerStintGroup, CareerStintRow } from "@/lib/player-career-stint-utils";
import { groupCareerStints } from "@/lib/player-career-stint-utils";

function stat(value: number | null) {
  return value == null ? "—" : String(value);
}

function CareerTable({ group }: { group: CareerStintGroup }) {
  if (group.rows.length === 0) {
    return (
      <section className="mt-4">
        <h4 className="text-sm font-semibold text-zinc-200 m-0 mb-2">{group.label}</h4>
        <p className="text-sm text-zinc-500 m-0">No {group.label.toLowerCase()} career rows in Wikipedia archive.</p>
      </section>
    );
  }

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-zinc-200 m-0">{group.label}</h4>
        <p className="text-xs text-zinc-500 m-0">
          Total: <span className="font-mono text-zinc-300">{group.totals.apps}</span> apps ·{" "}
          <span className="font-mono text-emerald-400">{group.totals.points}</span> pts
        </p>
      </div>
      <table className="cms-table w-full text-xs">
        <thead>
          <tr>
            <th>Years</th>
            <th>Team</th>
            <th>Apps</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.id}>
              <td className="font-mono">{row.yearsLabel}</td>
              <td>{row.teamName}</td>
              <td className="font-mono">{stat(row.apps)}</td>
              <td className="font-mono">{stat(row.points)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function WikipediaCareerTables({ rows }: { rows: CareerStintRow[] }) {
  const groups = groupCareerStints(rows);
  return (
    <div>
      {groups.map((group) => (
        <CareerTable key={group.key} group={group} />
      ))}
    </div>
  );
}
