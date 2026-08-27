import type { PlayerOverviewRatingPoint } from "@/lib/public-player-overview-v2-service";

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

type SeriesKey = "overall" | "form" | "attack" | "defence" | "kicking" | "playmaking" | "physical";

const SERIES: Array<{ key: SeriesKey; label: string; color: string; dashed?: boolean }> = [
  { key: "overall", label: "Overall", color: "#22c55e" },
  { key: "form", label: "Form", color: "#f59e0b", dashed: true },
  { key: "attack", label: "Attack", color: "#38bdf8" },
  { key: "defence", label: "Defence", color: "#a78bfa" },
  { key: "kicking", label: "Kicking", color: "#fb7185" },
  { key: "playmaking", label: "Playmaking", color: "#2dd4bf" },
  { key: "physical", label: "Physical", color: "#e7bc63" },
];

function seriesValue(p: PlayerOverviewRatingPoint, key: SeriesKey): number | null {
  const raw =
    key === "overall"
      ? p.overall
      : key === "form"
        ? p.form
        : key === "attack"
          ? p.attack
          : key === "defence"
            ? p.defence
            : key === "kicking"
              ? p.kicking
              : key === "playmaking"
                ? p.playmaking
                : p.physical;
  return raw != null && Number.isFinite(raw) ? raw : null;
}

/** Multi-series rating history — overall + form + key dims when present. Never invents points. */
export function PlayerRatingHistoryChart({ points }: { points: PlayerOverviewRatingPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="pr-player-v2__empty">
        Not enough rated matches yet to plot a rating history chart.
      </p>
    );
  }

  const width = 640;
  const height = 200;
  const padX = 28;
  const padY = 18;

  const activeSeries = SERIES.filter((s) => points.some((p) => seriesValue(p, s.key) != null));
  const values = activeSeries.flatMap((s) =>
    points.map((p) => seriesValue(p, s.key)).filter((v): v is number => v != null),
  );
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 100;
  const span = max - min || 1;

  const xAt = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * (width - padX * 2);
  const yAt = (v: number) => height - padY - ((v - min) / span) * (height - padY * 2);

  const first = points[0]!;
  const last = points[points.length - 1]!;

  return (
    <div className="pr-player-v2__chart pr-player-v2__chart--multi">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rating history over time">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = padY + t * (height - padY * 2);
          const val = max - t * span;
          return (
            <g key={t}>
              <line
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                className="pr-player-v2__chart-grid"
              />
              <text x={4} y={y + 3} className="pr-player-v2__chart-axis">
                {val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {activeSeries.map((series) => {
          const coords = points
            .map((p, i) => {
              const v = seriesValue(p, series.key);
              if (v == null) return null;
              return { x: xAt(i), y: yAt(v), v, date: p.date };
            })
            .filter((c): c is { x: number; y: number; v: number; date: string | null } => c != null);
          if (coords.length === 0) return null;
          const path = coords
            .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
            .join(" ");
          return (
            <g key={series.key}>
              <path
                d={path}
                fill="none"
                stroke={series.color}
                strokeWidth={series.key === "overall" ? 2.4 : 1.6}
                strokeDasharray={series.dashed ? "5 4" : undefined}
                opacity={series.key === "overall" ? 1 : 0.85}
              />
              {coords.map((c) => (
                <circle
                  key={`${series.key}-${c.date}-${c.v}`}
                  cx={c.x}
                  cy={c.y}
                  r={series.key === "overall" ? 3.2 : 2.2}
                  fill={series.color}
                  stroke="#0b1220"
                  strokeWidth={1}
                >
                  <title>
                    {series.label}: {c.v.toFixed(1)} · {formatShortDate(c.date)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="pr-player-v2__chart-legend">
        {activeSeries.map((s) => (
          <span key={s.key} className="pr-player-v2__chart-leg">
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="pr-player-v2__chart-meta">
        <span>
          {formatShortDate(first.date)} · {first.overall.toFixed(1)}
        </span>
        <span>
          {points.length} snapshots
        </span>
        <span>
          {formatShortDate(last.date)} · {last.overall.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
