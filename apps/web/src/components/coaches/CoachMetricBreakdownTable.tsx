import { formatTrendArrow } from "@/lib/coach-rating-explain";

export type CoachBreakdownRow = {
  key: string;
  label: string;
  score: number | null;
  weight?: number | null;
  contribution?: number | null;
  trend?: number | null;
  confidence?: number | null;
  change?: number | null;
};

type Props = {
  rows: CoachBreakdownRow[];
  showConfidence?: boolean;
  showChange?: boolean;
};

export function CoachMetricBreakdownTable({
  rows,
  showConfidence = false,
  showChange = false,
}: Props) {
  if (!rows.length) {
    return <p className="pr-coach-empty">No breakdown available yet.</p>;
  }

  return (
    <div className="pr-coach-breakdown">
      <div
        className="pr-coach-breakdown__head"
        style={{
          gridTemplateColumns: showConfidence
            ? "minmax(0,1.6fr) 0.55fr 0.55fr 0.7fr 0.5fr 0.6fr"
            : showChange
              ? "minmax(0,1.6fr) 0.55fr 0.55fr 0.7fr 0.55fr"
              : "minmax(0,1.6fr) 0.55fr 0.55fr 0.7fr 0.5fr",
        }}
      >
        <span>Metric</span>
        <span>Score</span>
        <span>Weight</span>
        <span>Contribution</span>
        {showChange ? <span>Change</span> : <span>Trend</span>}
        {showConfidence ? <span>Confidence</span> : null}
      </div>
      <div className="pr-coach-breakdown__list">
        {rows.map((row) => (
          <div
            key={row.key}
            className="pr-coach-breakdown__row"
            style={{
              gridTemplateColumns: showConfidence
                ? "minmax(0,1.6fr) 0.55fr 0.55fr 0.7fr 0.5fr 0.6fr"
                : showChange
                  ? "minmax(0,1.6fr) 0.55fr 0.55fr 0.7fr 0.55fr"
                  : "minmax(0,1.6fr) 0.55fr 0.55fr 0.7fr 0.5fr",
            }}
          >
            <span className="pr-coach-breakdown__name">{row.label}</span>
            <span>{row.score != null ? Math.round(row.score) : "—"}</span>
            <span>{row.weight != null ? `${row.weight}%` : "—"}</span>
            <span>
              {row.contribution != null ? row.contribution.toFixed(1) : "—"}
            </span>
            {showChange ? (
              <span>
                {row.change == null || row.change === 0
                  ? "—"
                  : row.change > 0
                    ? `↑${row.change}`
                    : `↓${Math.abs(row.change)}`}
              </span>
            ) : (
              <span>{formatTrendArrow(row.trend)}</span>
            )}
            {showConfidence ? (
              <span>{row.confidence != null ? `${row.confidence}%` : "—"}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
