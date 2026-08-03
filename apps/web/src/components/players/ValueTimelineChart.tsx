import type { PublicPlayerValue } from "@/lib/player-value-service";
import { formatGbpCompact } from "@/lib/player-value-math";

export type ValueTimelineChartProps = {
  timeline: PublicPlayerValue["timeline"];
  currentValueGbp?: number | null;
  peakValueGbp?: number | null;
  className?: string;
};

/** Simple SVG line chart for market value history (analytics style). */
export function ValueTimelineChart({
  timeline,
  currentValueGbp,
  peakValueGbp,
  className,
}: ValueTimelineChartProps) {
  if (!timeline.length) {
    return <p className="pr-mc-transfers-muted">No value timeline yet.</p>;
  }

  const values = timeline.map((t) => t.marketValueGbp);
  const max = Math.max(...values, currentValueGbp ?? 0, peakValueGbp ?? 0, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const w = 320;
  const h = 120;
  const pad = 12;

  const points = timeline.map((t, i) => {
    const x = pad + (i / Math.max(timeline.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((t.marketValueGbp - min) / span) * (h - pad * 2);
    return { x, y, ...t };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <figure className={`pr-value-timeline ${className ?? ""}`.trim()}>
      <svg viewBox={`0 0 ${w} ${h}`} className="pr-value-timeline__svg" role="img" aria-label="Market value timeline">
        <defs>
          <linearGradient id="prValueLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#54b989" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#54b989" stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 ? (
          <path
            d={`${path} L ${points[points.length - 1]!.x} ${h - pad} L ${points[0]!.x} ${h - pad} Z`}
            fill="url(#prValueLine)"
          />
        ) : null}
        <path d={path} fill="none" stroke="#54b989" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p) => (
          <circle key={p.year} cx={p.x} cy={p.y} r="3.5" fill="#54b989" stroke="#0c2a32" strokeWidth="1.5" />
        ))}
      </svg>
      <figcaption className="pr-value-timeline__years">
        {timeline.map((t) => (
          <span key={t.year}>
            <em>{t.year}</em>
            <strong>{formatGbpCompact(t.marketValueGbp)}</strong>
          </span>
        ))}
      </figcaption>
      {(currentValueGbp != null || peakValueGbp != null) && (
        <p className="pr-value-timeline__legend">
          {currentValueGbp != null ? <span>Current {formatGbpCompact(currentValueGbp)}</span> : null}
          {peakValueGbp != null ? <span>Highest {formatGbpCompact(peakValueGbp)}</span> : null}
        </p>
      )}
    </figure>
  );
}
