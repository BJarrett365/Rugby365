import Link from "next/link";
import type { MatchBettingPrediction } from "@/lib/match-betting-intelligence-types";

/**
 * Compact win-probability strip for the Match Centre header.
 * Sourced from Planet Rugby Betting Intelligence prediction output.
 */
export function MatchHeaderWinProbability({
  homeName,
  awayName,
  prediction,
}: {
  homeName: string;
  awayName: string;
  prediction: MatchBettingPrediction;
}) {
  const { homeWinPct, drawPct, awayWinPct, confidencePct, lean } = prediction;
  const leanLabel =
    lean === "home" ? homeName : lean === "away" ? awayName : lean === "draw" ? "Draw" : null;

  return (
    <div className="pr-mc-header__winprob" aria-label="Win probability">
      <div className="pr-mc-header__winprob-head">
        <span className="pr-mc-header__winprob-title">
          Win probability
          {leanLabel ? (
            <span className="pr-mc-header__winprob-lean"> · Lean {leanLabel}</span>
          ) : null}
          <span className="pr-mc-header__winprob-conf"> · {confidencePct}% conf.</span>
        </span>
        <Link href="?tab=betting" className="pr-mc-header__winprob-link">
          Betting Intelligence
        </Link>
      </div>
      <div className="pr-mc-header__winprob-labels">
        <span>
          {homeName} <strong>{homeWinPct}%</strong>
        </span>
        <span>
          Draw <strong>{drawPct}%</strong>
        </span>
        <span>
          {awayName} <strong>{awayWinPct}%</strong>
        </span>
      </div>
      <div className="pr-mc-header__winprob-track" aria-hidden>
        <span className="pr-mc-header__winprob-home" style={{ width: `${homeWinPct}%` }} />
        <span className="pr-mc-header__winprob-draw" style={{ width: `${drawPct}%` }} />
        <span className="pr-mc-header__winprob-away" style={{ width: `${awayWinPct}%` }} />
      </div>
    </div>
  );
}
