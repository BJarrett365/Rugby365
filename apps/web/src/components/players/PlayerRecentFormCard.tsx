import type { PlayerFormResult } from "@/lib/player-form-engine";

function FormScoreRing({
  score,
  label,
}: {
  score: number | null;
  label: string | null;
}) {
  const size = 132;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const empty = score == null;
  const pct = empty ? 0 : Math.max(0, Math.min(100, (score / 10) * 100));
  const offset = c * (1 - pct / 100);

  return (
    <div
      className={`pr-player-v2__form-ring${empty ? " pr-player-v2__form-ring--empty" : ""}`}
      aria-label={
        score != null
          ? `Form score ${score.toFixed(1)} out of 10${label ? `, ${label}` : ""}`
          : "Form score unavailable"
      }
    >
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="pr-player-v2__form-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        {!empty ? (
          <circle
            className="pr-player-v2__form-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <div className="pr-player-v2__form-ring-value">
        <span className="pr-player-v2__form-ring-kicker">Form Score</span>
        <strong>
          {score != null ? score.toFixed(1) : "—"}
          {score != null ? <span>/10</span> : null}
        </strong>
        <em>{label ?? (empty ? "Building" : "")}</em>
      </div>
    </div>
  );
}

export type PlayerRecentFormCardProps = {
  form: PlayerFormResult;
};

/** RECENT FORM widget — display only; scoring lives in PlayerFormEngine. */
export function PlayerRecentFormCard({ form }: PlayerRecentFormCardProps) {
  const n = form.appearancesEligible;
  // Oldest → newest (left → right), matching approved form strip reading order.
  const strip = [...form.resultStrip].reverse();

  return (
    <div className="pr-player-v2__card pr-player-v2__widget-card pr-player-v2__form-card">
      <div className="pr-player-v2__card-head">
        <h2>
          Recent Form
          <span className="pr-player-v2__card-head-muted">
            {n > 0 ? `(Last ${n})` : "(No apps)"}
          </span>
        </h2>
      </div>

      {strip.length > 0 ? (
        <div className="pr-player-v2__form-strip pr-player-v2__form-strip--squares" aria-label="Team results">
          {strip.map((r, i) => (
            <span
              key={`${r}-${i}`}
              className={`pr-player-v2__form-chip pr-player-v2__form-chip--square ${
                r === "W"
                  ? "pr-player-v2__form-chip--w"
                  : r === "L"
                    ? "pr-player-v2__form-chip--l"
                    : "pr-player-v2__form-chip--d"
              }`}
            >
              {r}
            </span>
          ))}
        </div>
      ) : (
        <p className="pr-player-v2__empty">No recent team results yet.</p>
      )}

      <div className="pr-player-v2__form-body">
        <FormScoreRing score={form.formScore} label={form.formLabel} />

        <dl className="pr-player-v2__form-metrics">
          {form.metricDisplays.map((m) => (
            <div key={m.key} className="pr-player-v2__form-metric-row">
              <dt>{m.label}</dt>
              <dd>{m.display}</dd>
            </div>
          ))}
        </dl>
      </div>

      {form.formScore == null && form.matchesUsed === 0 && strip.length > 0 ? (
        <p className="pr-player-v2__widget-warn">
          Team results shown for context — player form score needs match ratings.
        </p>
      ) : null}
    </div>
  );
}
