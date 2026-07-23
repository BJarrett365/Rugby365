"use client";

/** Circular percentage ring for tackle/kicking/ruck success displays. */
export function PrStatRing({
  label,
  homePct,
  awayPct,
  size = 72,
}: {
  label: string;
  homePct: number | null;
  awayPct: number | null;
  size?: number;
}) {
  if (homePct == null && awayPct == null) return null;

  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  function ring(pct: number | null, className: string) {
    const value = pct == null ? 0 : Math.max(0, Math.min(100, Math.round(pct)));
    const offset = c - (value / 100) * c;
    return (
      <svg width={size} height={size} className={className} aria-hidden>
        <circle
          className="pr-stat-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="pr-stat-ring__progress"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="pr-stat-ring__value">
          {pct == null ? "—" : `${value}%`}
        </text>
      </svg>
    );
  }

  return (
    <div className="pr-stat-rings">
      <p className="pr-stat-rings__label">{label}</p>
      <div className="pr-stat-rings__pair">
        <div className="pr-stat-rings__side">
          {ring(homePct, "pr-stat-ring pr-stat-ring--home")}
        </div>
        <div className="pr-stat-rings__side">
          {ring(awayPct, "pr-stat-ring pr-stat-ring--away")}
        </div>
      </div>
    </div>
  );
}

/** Convert a ratio (0–1 or 0–100) to a 0–100 percentage for display. */
export function ratioToPercent(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  if (value <= 1 && value >= 0) return value * 100;
  return value;
}

export function successRate(made: number, missed: number): number | null {
  const total = made + missed;
  if (total <= 0) return null;
  return (made / total) * 100;
}
