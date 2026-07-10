"use client";

import type { MatchRatingDisplay } from "@/lib/match-rating-service";
import { CareerRatingBadge, MatchRatingBadge, SelectionTrendChip } from "./MatchRatingBadge";

export function PlayerMatchPerformancePanel({
  rating,
  onClose,
}: {
  rating: MatchRatingDisplay;
  onClose?: () => void;
}) {
  return (
    <aside className="match-player-rating cms-card" aria-label={`${rating.playerName} ratings`}>
      <header className="match-player-rating__header">
        <div>
          <p className="match-player-rating__eyebrow">Rugby365 ratings (separate signals)</p>
          <h3 className="match-player-rating__title">{rating.playerName}</h3>
          <div className="match-player-rating__stack">
            <div>
              <span className="match-player-rating__label">Career Rating ({rating.careerModel})</span>
              <CareerRatingBadge value={rating.careerRating} />
              <span className="text-zinc-500 text-xs"> Overall quality</span>
            </div>
            <div>
              <span className="match-player-rating__label">Match Rating ({rating.matchModel})</span>
              <MatchRatingBadge rating={rating} showPrefix />
              <span className="text-zinc-500 text-xs"> This match only</span>
            </div>
            <div>
              <span className="match-player-rating__label">Form (from Match Ratings)</span>
              <span className="match-rating-badge match-rating-badge--form">{rating.formLabel}</span>
            </div>
          </div>
          {rating.isRugby365Potm && (
            <p className="match-player-rating__potm">Rugby365 Player of the Match</p>
          )}
          {rating.isOfficialPotm && (
            <p className="match-player-rating__potm match-player-rating__potm--official">
              Official Player of the Match
            </p>
          )}
        </div>
        {onClose && (
          <button type="button" className="cms-btn cms-btn--secondary" onClick={onClose}>
            Close
          </button>
        )}
      </header>

      {rating.ratingStatus === "provisional" && (
        <p className="match-player-rating__status">
          Provisional Match Rating — stats may still update before full time.
        </p>
      )}
      {rating.ratingExplanation && (
        <p className="match-player-rating__explain">{rating.ratingExplanation}</p>
      )}

      <div className="match-player-rating__trends">
        <div>
          <span className="match-player-rating__label">Performance trend</span>
          <span>{rating.performanceTrendLabel}</span>
          {rating.previousRating != null && (
            <span className="text-zinc-400"> (prev Match {rating.previousRating.toFixed(1)})</span>
          )}
        </div>
        <div>
          <span className="match-player-rating__label">Selection trend</span>
          <SelectionTrendChip rating={rating} />
          <span className="text-zinc-400">
            {" "}
            {rating.selectionPreviousRole ?? "—"} → {rating.selectionCurrentRole ?? "—"}
          </span>
        </div>
      </div>

      {rating.positiveImpacts.length > 0 && (
        <section>
          <h4>Positive impact</h4>
          <ul>
            {rating.positiveImpacts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {rating.deductions.length > 0 && (
        <section>
          <h4>Deductions</h4>
          <ul>
            {rating.deductions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {rating.matchContext.length > 0 && (
        <section>
          <h4>Match context</h4>
          <ul>
            {rating.matchContext.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
