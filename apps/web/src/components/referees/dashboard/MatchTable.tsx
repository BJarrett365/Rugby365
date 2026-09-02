import Link from "next/link";
import type { RefereeMatchRow } from "@/lib/referee-dashboard-types";

export function MatchTable({
  rows,
  onViewAll,
}: {
  rows: RefereeMatchRow[];
  onViewAll?: () => void;
}) {
  if (!rows.length) {
    return <p className="rdash-state">No appointments listed.</p>;
  }
  return (
    <div className="rdash-table-wrap">
      <table className="rdash-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Match</th>
            <th>Competition</th>
            <th className="is-num">Rating</th>
            <th>Cards</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const fixture = row.href ? (
              <Link href={row.href}>{row.fixtureLabel}</Link>
            ) : (
              row.fixtureLabel
            );
            return (
              <tr key={row.id}>
                <td>{row.dateLabel}</td>
                <td>{fixture}</td>
                <td>{row.competition}</td>
                <td className="is-num">
                  {row.rating != null ? (
                    <span className="rdash-score">
                      {row.rating.toFixed(1)}
                      {row.isMock ? <span className="rdash-sr-only"> (sample rating)</span> : null}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span className="rdash-cards" title={`Yellow ${row.yellowCards ?? 0}, red ${row.redCards ?? 0}`}>
                    <span className="rdash-card-chip rdash-card-chip--y">
                      Y {row.yellowCards ?? 0}
                    </span>
                    <span className="rdash-card-chip rdash-card-chip--r">
                      R {row.redCards ?? 0}
                    </span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onViewAll ? (
        <button type="button" className="rdash-link-btn" onClick={onViewAll}>
          View all matches
        </button>
      ) : null}
    </div>
  );
}
