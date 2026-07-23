/** Accessible rating sparkline + HTML table alternative. */

export type RatingPoint = {
  date: string | null;
  rating: number;
  opponentName: string | null;
  competitionName: string | null;
  fixtureSlug: string | null;
  resultLabel: string | null;
};

export function PlayerRatingChart({
  points,
  seasonLabel,
  compact = false,
}: {
  points: RatingPoint[];
  seasonLabel?: string | null;
  compact?: boolean;
}) {
  const rated = points.filter((p) => Number.isFinite(p.rating));
  if (rated.length === 0) {
    return <p className="pr-mc-transfers-muted">No rated appearances in this selection.</p>;
  }

  const width = compact ? 280 : 640;
  const height = compact ? 72 : 180;
  const pad = 12;
  const min = Math.min(...rated.map((p) => p.rating));
  const max = Math.max(...rated.map((p) => p.rating));
  const span = Math.max(max - min, 1);
  const avg = rated.reduce((s, p) => s + p.rating, 0) / rated.length;

  const coords = rated.map((p, i) => {
    const x = pad + (i / Math.max(rated.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((p.rating - min) / span) * (height - pad * 2);
    return { x, y, p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const avgY = height - pad - ((avg - min) / span) * (height - pad * 2);

  const summary = `${seasonLabel ? `${seasonLabel}: ` : ""}average rating ${avg.toFixed(0)} across ${rated.length} rated appearances (range ${min.toFixed(0)}–${max.toFixed(0)}).`;

  return (
    <div className={`pr-rating-chart${compact ? " pr-rating-chart--compact" : ""}`}>
      <p className="pr-rating-chart__summary">{summary}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
        className="pr-rating-chart__svg"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={avgY}
          y2={avgY}
          className="pr-rating-chart__avg"
        />
        <path d={path} className="pr-rating-chart__line" fill="none" />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={compact ? 2.5 : 3.5} className="pr-rating-chart__point" />
        ))}
      </svg>
      {!compact ? (
        <div className="pr-player-table-wrap">
          <table className="pr-mc-transfers-table pr-player-table">
            <caption className="sr-only">Match ratings data table</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Opponent</th>
                <th scope="col">Competition</th>
                <th scope="col">Result</th>
                <th scope="col">Rating</th>
              </tr>
            </thead>
            <tbody>
              {[...rated].reverse().map((p, i) => (
                <tr key={`${p.fixtureSlug ?? i}-${p.date}`}>
                  <td>{p.date ? p.date.slice(0, 10) : "—"}</td>
                  <td>
                    {p.fixtureSlug ? (
                      <a href={`/matches/${p.fixtureSlug}`}>{p.opponentName ?? "Match"}</a>
                    ) : (
                      p.opponentName ?? "—"
                    )}
                  </td>
                  <td>{p.competitionName ?? "—"}</td>
                  <td>{p.resultLabel ?? "—"}</td>
                  <td>{p.rating.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
