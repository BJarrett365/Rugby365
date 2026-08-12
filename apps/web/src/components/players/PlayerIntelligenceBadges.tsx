import type { PlayerProfileBadge } from "@/lib/player-badge-engine";

/** Non-emoji glyphs — UK sports-product polish, consistent with coach tone. */
const BADGE_ICONS: Record<PlayerProfileBadge["key"], string> = {
  international_star: "★",
  elite_kicker: "✦",
  game_manager: "◇",
  in_form: "▲",
  future_star: "✶",
  high_value_asset: "◆",
};

/**
 * Rule-driven intelligence badges for the Player Identity hero.
 * Max three — never hardcode per player.
 */
export function PlayerIntelligenceBadges({
  badges,
}: {
  badges: PlayerProfileBadge[];
}) {
  if (!badges.length) return null;
  return (
    <ul className="pr-pih__badges" aria-label="Player intelligence badges">
      {badges.slice(0, 3).map((b) => (
        <li key={b.key} className={`pr-pih__badge pr-pih__badge--${b.tone}`}>
          <span className="pr-pih__badge-icon" aria-hidden>
            {BADGE_ICONS[b.key] ?? "•"}
          </span>
          <span>{b.label}</span>
        </li>
      ))}
    </ul>
  );
}
