import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rdash-stat">
      {icon ? (
        <span className="rdash-stat__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div>
        <p className="rdash-stat__label">{label}</p>
        <p className="rdash-stat__value">{value}</p>
        {hint ? <p className="rdash-stat__hint">{hint}</p> : null}
      </div>
    </div>
  );
}
