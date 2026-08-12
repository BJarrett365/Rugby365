import type { CoachRatingExplanation } from "@/lib/coach-rating-explain";

export function CoachWhyRatingPanel({ explanation }: { explanation: CoachRatingExplanation }) {
  return (
    <section className="pr-coach-card pr-coach-why">
      <div className="pr-coach-card__head">
        <h2>{explanation.headline}</h2>
      </div>
      <div className="pr-coach-why__grid">
        <div>
          <h3 className="pr-coach-why__title">Positive drivers</h3>
          {explanation.positiveDrivers.length ? (
            <ul className="pr-coach-list">
              {explanation.positiveDrivers.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="pr-coach-empty">No standout positive drivers yet.</p>
          )}
        </div>
        <div>
          <h3 className="pr-coach-why__title">Areas holding rating back</h3>
          {explanation.holdingBack.length ? (
            <ul className="pr-coach-list">
              {explanation.holdingBack.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="pr-coach-empty">No major drag factors flagged.</p>
          )}
        </div>
      </div>
      <p className="pr-coach-why__note">
        Explanation is generated from structured Rugby365 scores. It does not recalculate the
        Coach Rating.
      </p>
    </section>
  );
}
