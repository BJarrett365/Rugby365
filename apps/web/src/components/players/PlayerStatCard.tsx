export type PlayerStatCardProps = {
  label: string;
  value: string | number | null | undefined;
  hint?: string | null;
  className?: string;
};

export function PlayerStatCard({ label, value, hint, className }: PlayerStatCardProps) {
  return (
    <div className={`pr-player-stat-card ${className ?? ""}`.trim()}>
      <span className="pr-player-stat-card__label">{label}</span>
      <strong className="pr-player-stat-card__value">
        {value == null || value === "" ? "—" : value}
      </strong>
      {hint ? <span className="pr-player-stat-card__hint">{hint}</span> : null}
    </div>
  );
}
