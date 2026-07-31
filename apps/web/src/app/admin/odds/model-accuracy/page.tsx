import Link from "next/link";
import { BettingIntelAccuracyChart } from "@/components/admin/BettingIntelAccuracyChart";
import { PageHeader } from "@/components/shell/PageHeader";
import { buildBettingIntelAccuracyReport } from "@/lib/betting-intel-accuracy-service";

export const metadata = {
  title: "Model accuracy · Odds · Rugby365 CMS",
};

export const dynamic = "force-dynamic";

export default async function BettingIntelModelAccuracyPage() {
  const report = await buildBettingIntelAccuracyReport({ days: 60, limit: 200 });

  return (
    <>
      <PageHeader
        eyebrow="Odds · Betting Intelligence"
        title="Model pick accuracy"
        description="Tracks whether the fixtures-board win-probability lean (higher %) matched the final result. Same lightweight model as Match Centre Betting Intelligence."
      />

      <section className="cms-card bi-acc-summary">
        <div>
          <span className="bi-acc-summary__label">Graded</span>
          <strong>{report.graded}</strong>
          <em>of {report.sampled} finished (non-draw)</em>
        </div>
        <div>
          <span className="bi-acc-summary__label">Correct</span>
          <strong className="bi-acc-summary__ok">{report.correct}</strong>
        </div>
        <div>
          <span className="bi-acc-summary__label">Wrong</span>
          <strong className="bi-acc-summary__bad">{report.wrong}</strong>
        </div>
        <div>
          <span className="bi-acc-summary__label">Accuracy</span>
          <strong>{report.accuracyPct != null ? `${report.accuracyPct}%` : "—"}</strong>
          <em>
            <code>{report.modelVersion}</code>
          </em>
        </div>
      </section>

      <section className="cms-card mt-4">
        <h2 className="text-base font-semibold mb-1">Win / loss over time</h2>
        <p className="text-sm text-zinc-500 mb-3">
          Bars = daily correct (green) vs wrong (red). Gold markers = cumulative accuracy %.
        </p>
        <BettingIntelAccuracyChart series={report.series} />
      </section>

      <section className="cms-card mt-4 overflow-x-auto">
        <h2 className="text-base font-semibold mb-3">Recent graded matches</h2>
        {report.recent.length === 0 ? (
          <p className="text-sm text-zinc-500">No graded results yet.</p>
        ) : (
          <table className="cms-table w-full text-sm">
            <thead>
              <tr>
                <th>Match</th>
                <th>Score</th>
                <th>Model</th>
                <th>Lean</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {report.recent.map((row) => (
                <tr key={row.fixtureId}>
                  <td>
                    <Link href={`/admin/matches/${row.fixtureId}/edit`} className="cms-link">
                      {row.homeName} v {row.awayName}
                    </Link>
                    {row.competitionName ? (
                      <div className="text-zinc-500 text-xs">{row.competitionName}</div>
                    ) : null}
                  </td>
                  <td>
                    {row.homeScore}–{row.awayScore}
                  </td>
                  <td>
                    {row.homeWinPct}%–{row.awayWinPct}%
                  </td>
                  <td>{row.favored === "home" ? row.homeName : row.awayName}</td>
                  <td>
                    <span
                      className={
                        row.correct ? "bi-acc-pill bi-acc-pill--ok" : "bi-acc-pill bi-acc-pill--bad"
                      }
                    >
                      {row.correct ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
