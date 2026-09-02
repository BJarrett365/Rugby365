export function RatingBadge({
  rating,
  max = 100,
  worldRank,
}: {
  rating: number;
  max?: number;
  worldRank?: number;
}) {
  return (
    <div className="rdash-rating">
      <p className="rdash-rating__kicker">Overall rating</p>
      <p className="rdash-rating__value">
        {rating.toFixed(1)}
        <span className="rdash-rating__max">/{max}</span>
      </p>
      {worldRank != null ? (
        <p className="rdash-rating__rank">World rank #{worldRank}</p>
      ) : null}
    </div>
  );
}
