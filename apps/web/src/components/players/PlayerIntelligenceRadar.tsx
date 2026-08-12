import type { PlayerOverviewIntelligence } from "@/lib/public-player-overview-v2-service";

const AXES: Array<{ key: keyof PlayerOverviewIntelligence; label: string }> = [
  { key: "attack", label: "Attack" },
  { key: "playmaking", label: "Playmaking" },
  { key: "kicking", label: "Kicking" },
  { key: "gameManagement", label: "Game Mgmt" },
  { key: "defence", label: "Defence" },
  { key: "physical", label: "Physical" },
];

/** Lightweight fly-half intelligence radar — driven only by real player_ratings columns. */
export function PlayerIntelligenceRadar({
  intelligence,
}: {
  intelligence: PlayerOverviewIntelligence;
}) {
  const values = AXES.map((a) => ({
    ...a,
    value: typeof intelligence[a.key] === "number" ? (intelligence[a.key] as number) : null,
  }));
  const hasData = values.some((v) => v.value != null);

  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const n = AXES.length;

  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const pct = v.value == null ? 0 : Math.max(0, Math.min(100, v.value));
    const r = (pct / 100) * radius;
    return {
      ...v,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      lx: cx + Math.cos(angle) * (radius + 18),
      ly: cy + Math.sin(angle) * (radius + 18),
      ax: cx + Math.cos(angle) * radius,
      ay: cy + Math.sin(angle) * radius,
    };
  });

  const polygon = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="pr-player-v2__radar">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Fly-half intelligence radar">
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            className="pr-player-v2__radar-ring"
            points={points
              .map((_, i) => {
                const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                const r = radius * scale;
                return `${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`;
              })
              .join(" ")}
          />
        ))}
        {points.map((p) => (
          <line
            key={`axis-${p.key}`}
            className="pr-player-v2__radar-axis"
            x1={cx}
            y1={cy}
            x2={p.ax}
            y2={p.ay}
          />
        ))}
        {hasData ? <polygon className="pr-player-v2__radar-shape" points={polygon} /> : null}
        {points.map((p) => (
          <g key={p.key}>
            {p.value != null ? (
              <circle className="pr-player-v2__radar-dot" cx={p.x} cy={p.y} r={3.5} />
            ) : null}
            <text
              className="pr-player-v2__radar-label"
              x={p.lx}
              y={p.ly}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
      <div className="pr-player-v2__radar-legend">
        {values.map((v) => (
          <div key={v.key} className="pr-player-v2__radar-legend-row">
            <span>{v.label}</span>
            <span>{v.value != null ? v.value.toFixed(1) : "—"}</span>
          </div>
        ))}
      </div>
      {!hasData ? (
        <p className="pr-player-v2__empty">
          Not enough position-intelligence data yet to plot a radar.
        </p>
      ) : null}
    </div>
  );
}
