import Link from "next/link";

export type PlayerAiScoutSummaryCardProps = {
  slug: string;
  summary: string | null;
  strengths: string[];
  development: string[];
  bestRole: string | null;
  provisional: boolean;
  recommendationLabel?: string | null;
  rriScore?: number | null;
  rriBand?: string | null;
  title?: string;
  reportHref?: string;
  reportLabel?: string;
};

function titleCaseInsight(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** AI SCOUT SUMMARY — prose from AI when present; strengths/development always from structured dims. */
export function PlayerAiScoutSummaryCard({
  slug,
  summary,
  strengths,
  development,
  bestRole,
  provisional,
  recommendationLabel,
  rriScore,
  rriBand,
  title = "AI Scout Summary",
  reportHref,
  reportLabel = "Read full scout report >",
}: PlayerAiScoutSummaryCardProps) {
  const hasBody =
    Boolean(summary?.trim()) ||
    strengths.length > 0 ||
    development.length > 0 ||
    Boolean(bestRole?.trim());

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card pr-player-v2__scout-card">
      <div className="pr-player-v2__card-head">
        <h2>{title}</h2>
        {provisional && hasBody ? (
          <span className="pr-player-v2__scout-badge" title="Derived from structured intelligence scores">
            Provisional
          </span>
        ) : null}
      </div>

      {!hasBody ? (
        <p className="pr-player-v2__empty">
          AI scout summary not yet available for this player — check back once more scouting data
          has been recorded.
        </p>
      ) : (
        <div className="pr-player-v2__scout-body">
          {summary?.trim() ? <p className="pr-player-v2__scout-text">{summary.trim()}</p> : null}

          <dl className="pr-player-v2__scout-facts">
            {strengths.length > 0 ? (
              <div>
                <dt>Strengths</dt>
                <dd>{strengths.map(titleCaseInsight).join(", ")}</dd>
              </div>
            ) : null}
            {development.length > 0 ? (
              <div>
                <dt>Development</dt>
                <dd>{development.map(titleCaseInsight).join(", ")}</dd>
              </div>
            ) : null}
            {bestRole?.trim() ? (
              <div>
                <dt>Best Role</dt>
                <dd>{bestRole.trim()}</dd>
              </div>
            ) : null}
          </dl>

          {recommendationLabel || rriScore != null ? (
            <p className="pr-player-v2__scout-meta">
              {[recommendationLabel, rriScore != null ? `RRI ${rriScore}${rriBand ? ` (${rriBand})` : ""}` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      )}

      <div className="pr-player-v2__card-foot">
        <Link className="pr-player-v2__card-link" href={reportHref ?? `/players/${slug}/intelligence`}>
          {reportLabel}
        </Link>
      </div>
    </div>
  );
}
