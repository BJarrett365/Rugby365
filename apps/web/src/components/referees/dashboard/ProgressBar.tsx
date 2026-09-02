export function ProgressBar({
  value,
  max = 100,
  label,
  meta,
}: {
  value: number;
  max?: number;
  label: string;
  meta?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="rdash-bar">
      <div className="rdash-bar__meta">
        <span className="rdash-bar__label">
          {label}
          {meta ? <small>{meta}</small> : null}
        </span>
        <span className="rdash-bar__value">{value.toFixed(1)}</span>
      </div>
      <div
        className="rdash-bar__track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
      >
        <span className="rdash-bar__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
