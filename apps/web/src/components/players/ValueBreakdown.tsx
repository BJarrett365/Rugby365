import type { PlayerValueFactor } from "@/lib/player-value-math";

export type ValueBreakdownProps = {
  factors: PlayerValueFactor[];
  className?: string;
};

/** Horizontal contribution bars for market-value factors. */
export function ValueBreakdown({ factors, className }: ValueBreakdownProps) {
  if (!factors.length) {
    return <p className="pr-mc-transfers-muted">No value factors yet.</p>;
  }

  const maxAbs = Math.max(...factors.map((f) => Math.abs(f.pct)), 1);

  return (
    <ul className={`pr-value-breakdown ${className ?? ""}`.trim()}>
      {factors.map((f) => {
        const width = Math.max(4, (Math.abs(f.pct) / maxAbs) * 100);
        return (
          <li key={`${f.key}-${f.label}`} className={f.pct < 0 ? "is-down" : "is-up"}>
            <div className="pr-value-breakdown__row">
              <span className="pr-value-breakdown__label">{f.label}</span>
              <span className="pr-value-breakdown__pct">
                {f.pct >= 0 ? "+" : ""}
                {f.pct}%
              </span>
            </div>
            <div className="pr-value-breakdown__track" aria-hidden>
              <span
                className="pr-value-breakdown__fill"
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="pr-value-breakdown__note">{f.note}</p>
          </li>
        );
      })}
    </ul>
  );
}
