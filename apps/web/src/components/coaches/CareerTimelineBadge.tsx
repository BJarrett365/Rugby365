import { TeamCrest } from "@/components/matches/TeamCrest";

export type CareerTimelineBadgeKind =
  | "player"
  | "international_player"
  | "coach"
  | "head_coach"
  | "director_of_rugby"
  | "technical"
  | "management"
  | "team";

type Props = {
  teamName: string;
  crestUrl?: string | null;
  kind: CareerTimelineBadgeKind;
  isCurrent?: boolean;
  /** Optional small role marker shown outside the crest (e.g. HC / DoR) */
  roleMarker?: string | null;
  title?: string;
};

function kindIcon(kind: CareerTimelineBadgeKind): string {
  switch (kind) {
    case "player":
    case "international_player":
      return "jersey";
    case "technical":
      return "tactics";
    case "director_of_rugby":
    case "management":
      return "management";
    case "head_coach":
    case "coach":
      return "whistle";
    default:
      return "ball";
  }
}

/**
 * Compact shield-style career timeline badge.
 * Crest first; otherwise career-type icon on a dark green / gold shield.
 */
export function CareerTimelineBadge({
  teamName,
  crestUrl,
  kind,
  isCurrent = false,
  roleMarker = null,
  title,
}: Props) {
  const hasCrest = Boolean(crestUrl?.trim());
  const icon = kindIcon(kind);

  return (
    <span
      className={`pr-career-badge${isCurrent ? " is-current" : ""}${hasCrest ? " has-crest" : ""}`}
      title={title ?? teamName}
    >
      <span className="pr-career-badge__shield" aria-hidden={!hasCrest}>
        {hasCrest ? (
          <TeamCrest name={teamName} imageUrl={crestUrl} size="md" />
        ) : (
          <span className={`pr-career-badge__icon pr-career-badge__icon--${icon}`} />
        )}
      </span>
      {roleMarker ? <span className="pr-career-badge__marker">{roleMarker}</span> : null}
    </span>
  );
}

export function careerBadgeKindFromTimeline(input: {
  careerType: string;
  role?: string;
}): CareerTimelineBadgeKind {
  const role = (input.role || "").toLowerCase();
  if (input.careerType === "player") {
    return role.includes("international") ? "international_player" : "player";
  }
  if (input.careerType === "technical" || role.includes("technical")) return "technical";
  if (input.careerType === "management" || role.includes("director")) return "director_of_rugby";
  if (role.includes("head coach")) return "head_coach";
  if (input.careerType === "coach") return "coach";
  return "team";
}
