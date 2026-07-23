import Link from "next/link";
import type { CmsEntityLink, MatchEntityContext } from "@/lib/match-entity-context";
import { lookupPlayerLink, lookupTeamLink } from "@/lib/match-entity-context";

export function PlayerProfileLink({
  name,
  externalId,
  context,
  className,
}: {
  name: string;
  externalId?: string | null;
  context: MatchEntityContext;
  className?: string;
}) {
  const link = lookupPlayerLink(context, { externalId, name });
  if (!link) {
    return <span className={className}>{name}</span>;
  }
  return (
    <Link href={`/players/${link.slug}`} className={`match-entity-link${className ? ` ${className}` : ""}`}>
      {name}
    </Link>
  );
}

export function TeamProfileLink({
  name,
  externalId,
  link,
  className,
}: {
  name: string;
  externalId?: string | null;
  link?: CmsEntityLink | null;
  className?: string;
}) {
  const team = link ?? null;
  if (!team && externalId) {
    return <span className={className}>{name}</span>;
  }
  if (!team) {
    return <span className={className}>{name}</span>;
  }
  return (
    <Link href={`/admin/teams/${team.id}/edit`} className={`match-entity-link${className ? ` ${className}` : ""}`}>
      {name}
    </Link>
  );
}

export function TeamProfileLinkFromContext({
  name,
  externalId,
  context,
  side,
  className,
}: {
  name: string;
  externalId?: string | null;
  context: MatchEntityContext;
  side?: "home" | "away";
  className?: string;
}) {
  const link =
    side === "home"
      ? context.homeTeam
      : side === "away"
        ? context.awayTeam
        : lookupTeamLink(context, { externalId });
  return <TeamProfileLink name={name} externalId={externalId} link={link} className={className} />;
}
