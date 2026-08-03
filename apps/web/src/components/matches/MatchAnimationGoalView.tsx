"use client";

type GoalMode = "try" | "conversion" | "miss";
type FlightPhase = "idle" | "kicking" | "success" | "miss";
type PitchPhase = "attack" | "defence" | "neutral";

type Props = {
  teamColour: string;
  teamName: string;
  mode: GoalMode;
  flight: FlightPhase;
  reducedMotion?: boolean;
  headline?: string | null;
  /** Team name line under headline. */
  teamLabel?: string | null;
  /** e.g. "#10 Fin Smith" */
  playerLabel?: string | null;
  /** Optional assist line for tries. */
  assistLabel?: string | null;
  /** Pitch floor colour: attack = bright green, defence = darker teal. */
  pitchPhase?: PitchPhase;
};

/**
 * Front-on goal posts camera — clean TRY / CONVERSION / MISS sequences.
 * Try: dashed line under the crossbar, then TRY + name (+ assist).
 * Conversion: ball + path between the posts above the crossbar.
 */
export function MatchAnimationGoalView({
  teamColour,
  teamName,
  mode,
  flight,
  reducedMotion = false,
  headline,
  teamLabel,
  playerLabel,
  assistLabel = null,
  pitchPhase = "attack",
}: Props) {
  const showFlags = mode === "miss" || flight === "miss";
  const ballClass =
    mode === "conversion" || mode === "miss"
      ? `pr-ma-goal__ball pr-ma-goal__ball--${flight}${reducedMotion ? " pr-ma-goal__ball--static" : ""}`
      : "pr-ma-goal__ball pr-ma-goal__ball--try";
  const who = playerLabel ?? teamName;
  const grassId = `pr-ma-goal-grass-${pitchPhase}`;
  const skyId = `pr-ma-goal-sky-${pitchPhase}`;
  const showTryLine = mode === "try";
  const showConversionPath = mode === "conversion" || mode === "miss";

  return (
    <div
      className={`pr-ma-goal pr-ma-goal--${pitchPhase}`}
      role="img"
      aria-label={
        showFlags
          ? `Conversion missed by ${who}. Red flags.`
          : mode === "try"
            ? `Try awarded to ${who}. Front view of the goal posts.`
            : `Conversion by ${who}. Ball between the posts.`
      }
    >
      <svg viewBox="0 0 100 62" className="pr-ma-goal__svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
            {pitchPhase === "defence" ? (
              <>
                <stop offset="0%" stopColor="#0a1218" />
                <stop offset="55%" stopColor="#12252c" />
                <stop offset="100%" stopColor="#1a3a40" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#0d1f22" />
                <stop offset="55%" stopColor="#16363b" />
                <stop offset="100%" stopColor="#1b5e20" />
              </>
            )}
          </linearGradient>
          <linearGradient id={grassId} x1="0" y1="0" x2="0" y2="1">
            {pitchPhase === "defence" ? (
              <>
                <stop offset="0%" stopColor="#1a4a45" />
                <stop offset="100%" stopColor="#0f2e2c" />
              </>
            ) : pitchPhase === "neutral" ? (
              <>
                <stop offset="0%" stopColor="#246b2a" />
                <stop offset="100%" stopColor="#164a1a" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor="#43a047" />
                <stop offset="45%" stopColor="#2e7d32" />
                <stop offset="100%" stopColor="#1b5e20" />
              </>
            )}
          </linearGradient>
          <linearGradient id="pr-ma-goal-crowd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1a3a" />
            <stop offset="100%" stopColor="#121018" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="100" height="62" fill={`url(#${skyId})`} />
        <rect x="0" y="0" width="100" height="28" fill="url(#pr-ma-goal-crowd)" opacity="0.85" />
        {Array.from({ length: 40 }, (_, i) => (
          <circle
            key={i}
            cx={4 + (i % 10) * 10}
            cy={4 + Math.floor(i / 10) * 5}
            r="0.7"
            fill={i % 3 === 0 ? "#7e57c2" : "#455a64"}
            opacity="0.55"
          />
        ))}

        <path d="M0 38 L50 28 L100 38 L100 62 L0 62 Z" fill={`url(#${grassId})`} />
        {pitchPhase === "attack" ? (
          <path d="M50 28 L100 38 L100 62 L50 50 Z" fill="rgba(129, 199, 132, 0.22)" />
        ) : null}
        {pitchPhase === "defence" ? (
          <path d="M0 38 L50 28 L50 50 L0 62 Z" fill="rgba(0, 0, 0, 0.18)" />
        ) : null}
        <path
          d="M8 62 L50 34 L92 62"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.4"
        />
        <line
          x1="20"
          y1="50"
          x2="80"
          y2="50"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.3"
        />

        <g className="pr-ma-goal__posts">
          <rect x="32" y="14" width="2.2" height="36" rx="0.4" fill="#f5f5f5" />
          <rect x="65.8" y="14" width="2.2" height="36" rx="0.4" fill="#f5f5f5" />
          <rect x="32" y="22" width="36" height="2" rx="0.3" fill="#f5f5f5" />
          <rect x="32" y="48" width="2.2" height="2" fill={teamColour} />
          <rect x="65.8" y="48" width="2.2" height="2" fill={teamColour} />
        </g>

        {showTryLine ? (
          <path
            className={
              reducedMotion
                ? "pr-ma-goal__try-path"
                : "pr-ma-goal__try-path pr-ma-goal__try-path--run"
            }
            d="M 50 48 Q 50 36 50 26"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.55"
            strokeDasharray="1.6 0.9"
          />
        ) : null}

        {showConversionPath ? (
          <path
            className={
              reducedMotion
                ? "pr-ma-goal__conv-path"
                : "pr-ma-goal__conv-path pr-ma-goal__conv-path--fly"
            }
            d="M 50 46 Q 50 28 50 16"
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="0.5"
            strokeDasharray="1.5 0.9"
          />
        ) : null}

        {showFlags ? (
          <g className="pr-ma-goal__flags" aria-hidden>
            <g className="pr-ma-goal__flag pr-ma-goal__flag--left">
              <line x1="28" y1="16" x2="28" y2="30" stroke="#b71c1c" strokeWidth="0.6" />
              <polygon points="28,16 36,19 28,22" fill="#e53935" />
            </g>
            <g className="pr-ma-goal__flag pr-ma-goal__flag--right">
              <line x1="72" y1="16" x2="72" y2="30" stroke="#b71c1c" strokeWidth="0.6" />
              <polygon points="72,16 64,19 72,22" fill="#e53935" />
            </g>
          </g>
        ) : null}

        <ellipse
          className={ballClass}
          cx={flight === "miss" || mode === "miss" ? 78 : 50}
          cy={
            mode === "try"
              ? 44
              : flight === "kicking"
                ? 30
                : flight === "success"
                  ? 16
                  : flight === "miss" || mode === "miss"
                    ? 20
                    : 40
          }
          rx="2.2"
          ry="1.5"
          fill="#f5f0e6"
          stroke="#3e2723"
          strokeWidth="0.3"
        />

        {flight === "success" && mode === "conversion" ? (
          <rect
            x="34.5"
            y="14"
            width="31"
            height="10"
            fill="rgba(231, 188, 99, 0.22)"
            rx="1"
          />
        ) : null}
      </svg>

      <div className="pr-ma-goal__copy">
        {headline ? <p className="pr-ma-goal__headline">{headline}</p> : null}
        {teamLabel ? (
          <p className="pr-ma-goal__team-line" style={{ color: teamColour }}>
            {teamLabel}
          </p>
        ) : null}
        {playerLabel ? <p className="pr-ma-goal__player">{playerLabel}</p> : null}
        {assistLabel ? <p className="pr-ma-goal__assist">{assistLabel}</p> : null}
      </div>
    </div>
  );
}
