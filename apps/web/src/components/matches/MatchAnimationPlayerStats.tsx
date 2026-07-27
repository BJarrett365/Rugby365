"use client";

import type {
  AnimationCategoryLeader,
  AnimationStatChip,
  MatchAnimationPlayerStats,
} from "@/lib/match-animation-player-stats";

type TeamInfo = {
  name: string;
  shortName: string;
  colour: string;
};

/** Five-tab leaders strip: Attack / Defence / Kicking / Errors / Carries. */
export function MatchAnimationPlayerStatsLeaders({
  leaders,
  home,
  away,
}: {
  leaders: AnimationCategoryLeader[];
  home: TeamInfo;
  away: TeamInfo;
}) {
  if (leaders.length === 0) return null;

  return (
    <section className="pr-ma-pstats" aria-label="Player stats leaders">
      <p className="pr-ma-pstats__label">Player data</p>
      <ul className="pr-ma-pstats__grid">
        {leaders.map((leader) => {
          const team = leader.teamSide === "away" ? away : home;
          return (
            <li key={leader.category} className="pr-ma-pstats__card">
              <span className="pr-ma-pstats__cat">{leader.categoryLabel}</span>
              <span className="pr-ma-pstats__name" style={{ color: team.colour }}>
                {leader.playerName}
              </span>
              <span className="pr-ma-pstats__val">
                <strong>{leader.value}</strong> {leader.metricLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Contextual chips for the player currently featured on the animation. */
export function MatchAnimationPlayerStatChips({
  chips,
  title = "Match stats",
}: {
  chips: AnimationStatChip[];
  title?: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="pr-ma-chips" aria-label={title}>
      {chips.map((chip) => (
        <span
          key={`${chip.category}-${chip.metric}`}
          className="pr-ma-chips__item"
          data-category={chip.category}
        >
          <span className="pr-ma-chips__cat">{chip.categoryLabel}</span>
          <span className="pr-ma-chips__val">
            <strong>{chip.value}</strong> {chip.metricLabel}
          </span>
        </span>
      ))}
    </div>
  );
}

export function hasAnimationPlayerStats(
  bundle: MatchAnimationPlayerStats | null | undefined,
): boolean {
  return Boolean(bundle && (bundle.leaders.length > 0 || bundle.players.length > 0));
}
