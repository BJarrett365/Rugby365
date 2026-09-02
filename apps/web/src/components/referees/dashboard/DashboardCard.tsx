import type { ReactNode } from "react";
import type { DashboardSectionStatus } from "@/lib/referee-dashboard-types";

export function DashboardCard({
  title,
  kicker,
  status = "ready",
  className = "",
  children,
}: {
  title?: string;
  kicker?: string;
  status?: DashboardSectionStatus;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rdash-card ${className}`.trim()}>
      {title ? (
        <header className="rdash-card__head">
          {kicker ? <p className="rdash-card__kicker">{kicker}</p> : null}
          <h2 className="rdash-card__title">{title}</h2>
        </header>
      ) : null}
      {status === "loading" ? (
        <p className="rdash-state" role="status">
          Loading this panel…
        </p>
      ) : null}
      {status === "empty" ? (
        <p className="rdash-state">No records for this panel yet.</p>
      ) : null}
      {status === "error" ? (
        <p className="rdash-state rdash-state--error" role="alert">
          This panel could not be loaded.
        </p>
      ) : null}
      {status === "ready" ? children : null}
    </section>
  );
}
