import Link from "next/link";
import type { PublicLegendCard } from "@/lib/public-legends-service";
import { TeamCrest } from "@/components/matches/TeamCrest";

export function LegendsGrid({ legends }: { legends: PublicLegendCard[] }) {
  if (legends.length === 0) {
    return (
      <p className="pr-mc-transfers-muted">
        No legends published yet. Seed the catalog from Admin → Legends.
      </p>
    );
  }

  return (
    <ul className="pr-legends-grid">
      {legends.map((legend) => (
        <li key={legend.legendId}>
          <Link href={`/players/${legend.slug}`} className="pr-legends-card">
            <TeamCrest
              name={legend.name}
              imageUrl={legend.badgeImageUrl ?? legend.imageUrl}
              size="md"
            />
            <span className="pr-legends-card__name">{legend.name}</span>
            <span className="pr-legends-card__meta">
              {[legend.countryName, legend.era, legend.legendLevelLabel]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {legend.legendScore != null ? (
              <span className="pr-legends-card__tags">
                Legend Score {legend.legendScore}
                {legend.allTimeRank != null ? ` · #${legend.allTimeRank} all-time` : ""}
              </span>
            ) : legend.collections.length > 0 ? (
              <span className="pr-legends-card__tags">
                {legend.collections.slice(0, 2).join(" · ")}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
