import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { listPregameReadiness } from "@/lib/match-pregame-readiness-service";

export const dynamic = "force-dynamic";

function formatKickoff(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function MatchPregamePage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const hoursAhead = Number(sp.hours ?? "72");
  const gapsOnly = sp.all !== "1";
  const report = await listPregameReadiness({
    hoursAhead: Number.isFinite(hoursAhead) ? hoursAhead : 72,
    gapsOnly,
  });

  return (
    <>
      <PageHeader
        eyebrow="Match ops"
        title="Pre-game readiness"
        description="Check stadium, weather coordinates, referee and coaches are assigned before kickoff."
      />

      <div className="cms-card mb-4 flex flex-wrap items-center gap-3 justify-between">
        <p className="text-sm text-[var(--pr-grey)] mb-0">
          Next {report.hoursAhead}h · <strong className="text-white">{report.ready}</strong> ready ·{" "}
          <strong className="text-amber-300">{report.notReady}</strong> with gaps
          {gapsOnly ? " (showing gaps only)" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            className={`cms-btn ${gapsOnly ? "cms-btn--primary" : "cms-btn--secondary"}`}
            href="/admin/matches/pregame"
          >
            Gaps only
          </Link>
          <Link
            className={`cms-btn ${!gapsOnly ? "cms-btn--primary" : "cms-btn--secondary"}`}
            href="/admin/matches/pregame?all=1"
          >
            All upcoming
          </Link>
          <Link className="cms-btn cms-btn--secondary" href="/admin/matches?ops=1&opsBucket=pregame_not_ready">
            Today ops filter
          </Link>
        </div>
      </div>

      {report.fixtures.length === 0 ? (
        <div className="cms-card">
          <p className="text-sm text-[var(--pr-grey)] mb-0">
            {gapsOnly
              ? "No upcoming fixtures with missing stadium, weather, referee or coaches in this window."
              : "No upcoming scheduled fixtures in this window."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {report.fixtures.map((fx) => (
            <section key={fx.fixtureId} className="cms-card">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-[var(--pr-grey)] mb-1">
                    {fx.competitionName ?? "Competition"} · {formatKickoff(fx.kickoffAt)}
                  </p>
                  <h2 className="text-base font-semibold mt-0 mb-0">
                    {fx.homeTeamName} v {fx.awayTeamName}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded border ${
                      fx.readiness.ready
                        ? "border-emerald-500/40 text-emerald-300"
                        : "border-amber-500/40 text-amber-300"
                    }`}
                  >
                    {fx.readiness.readyCount}/{fx.readiness.totalCount} ready
                  </span>
                  <Link className="cms-btn cms-btn--secondary" href={fx.editHref}>
                    Fix in CMS
                  </Link>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {fx.readiness.checks.map((check) => (
                  <div
                    key={check.code}
                    className={`rounded border px-3 py-2 text-sm ${
                      check.ok
                        ? "border-[var(--pr-border)] text-[var(--pr-grey)]"
                        : "border-amber-500/40 bg-amber-500/5 text-amber-100"
                    }`}
                  >
                    <div className="font-medium text-white">
                      {check.ok ? "✓" : "✕"} {check.label}
                    </div>
                    <div className="text-xs mt-1 opacity-80">{check.detail}</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[var(--pr-grey)] mt-3 mb-0">
                Stadium: {fx.venueName ?? "—"} · Ref: {fx.refereeName ?? "—"} · Home coach:{" "}
                {fx.homeCoachName ?? "—"} · Away coach: {fx.awayCoachName ?? "—"}
              </p>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
