"use client";

import {
  leaderRowsFromPlayerStats,
  rankPlayerStatRows,
  type SdmsMatchPlayerStats,
  type SdmsPlayerStatCategory,
} from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import { PlayerProfileLink } from "./EntityProfileLinks";
import { TeamCrest } from "./TeamCrest";

const SNAPSHOT_METRICS: {
  metric: string;
  label: string;
  categories: SdmsPlayerStatCategory[];
  /** Map leader metric name → detail_list field fallback. */
  detailFallback?: string;
}[] = [
  { metric: "tackles", label: "Tackles", categories: ["defend", "attack"] },
  { metric: "carries", label: "Carries", categories: ["attack", "carries", "defend"] },
  { metric: "turnovers_won", label: "Turnovers Won", categories: ["defend", "attack"] },
  {
    metric: "running_metres",
    label: "Running Metres",
    categories: ["attack", "carries"],
    detailFallback: "metres",
  },
  { metric: "defenders_beaten", label: "Defenders Beaten", categories: ["attack", "defend"] },
  { metric: "clean_breaks", label: "Clean Breaks", categories: ["attack", "defend"] },
];

export function PlayerStatsSnapshot({
  playerStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  entities,
  onSeeMore,
}: {
  playerStats: SdmsMatchPlayerStats;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  entities: MatchEntityContext;
  onSeeMore?: (metric: string) => void;
}) {
  return (
    <section className="pr-snapshot">
      <h2 className="pr-snapshot__heading">Snapshot</h2>
      <div className="pr-snapshot__grid">
        {SNAPSHOT_METRICS.map(({ metric, label, categories, detailFallback }) => {
          let ranked = rankPlayerStatRows(
            leaderRowsFromPlayerStats(playerStats, metric, categories),
            metric,
            5,
          );

          if (ranked.length === 0 && detailFallback) {
            const detailRows = (["home", "away"] as const).flatMap((side) =>
              (playerStats[side].attack?.detail_list ?? []).map((row) => ({
                ...row,
                side,
                [metric]: row[detailFallback],
              })),
            );
            ranked = rankPlayerStatRows(detailRows, metric, 5);
          }

          return (
            <article key={metric} className="pr-snapshot-card">
              <h3 className="pr-snapshot-card__title">{label}</h3>
              <ol className="pr-snapshot-card__list">
                {ranked.length === 0 ? (
                  <li className="pr-snapshot-card__empty">No data</li>
                ) : (
                  ranked.map((p) => {
                    const side = (p as { side?: "home" | "away" }).side;
                    const crestName = side === "away" ? awayName : homeName;
                    const crestUrl = side === "away" ? awayImageUrl : homeImageUrl;
                    return (
                      <li key={`${metric}-${p.player_id ?? p.player_name}-${p.rank}`}>
                        <span className="pr-snapshot-card__rank">{p.rank}</span>
                        <TeamCrest name={crestName} imageUrl={crestUrl} size="sm" />
                        <span className="pr-snapshot-card__name">
                          <PlayerProfileLink
                            name={p.player_name ?? "—"}
                            externalId={p.player_id}
                            context={entities}
                          />
                        </span>
                        <strong className="pr-snapshot-card__value">{p.value}</strong>
                      </li>
                    );
                  })
                )}
              </ol>
              <button
                type="button"
                className="pr-snapshot-card__more"
                onClick={() => onSeeMore?.(metric)}
              >
                See More
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
