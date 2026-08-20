import type { PlayerOverviewRatingPoint } from "@/lib/public-player-overview-v2-service";

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

/** Real-points-only rating history sparkline — never interpolates fake data. */
export function PlayerRatingHistoryChart({ points }: { points: PlayerOverviewRatingPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="pr-player-v2__empty">
        Not enough rated matches yet to plot a rating history chart.
      </p>
    );
  }

  const width = 600;
  const height = 140;
  const padX = 10;
  const padY = 14;
  const values = points.map((p) => p.overall);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((p.overall - min) / span) * (height - padY * 2);
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]!.x.toFixed(1)},${height - padY} L${coords[0]!.x.toFixed(1)},${height - padY} Z`;

  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div className="pr-player-v2__chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rating history over time">
        <path className="pr-player-v2__chart-area" d={areaPath} />
        <path className="pr-player-v2__chart-line" d={linePath} />
        {coords.map((c) => (
          <circle key={`${c.date}-${c.overall}`} className="pr-player-v2__chart-dot" cx={c.x} cy={c.y} r={2.6} />
        ))}
      </svg>
      <div className="pr-player-v2__chart-meta">
        <span>
          {formatShortDate(first.date)} · {first.overall.toFixed(1)}
        </span>
        <span>
          {formatShortDate(last.date)} · {last.overall.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
