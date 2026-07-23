"use client";

import { useMemo, useState } from "react";
import {
  SDMS_PLAYER_STAT_CATEGORIES,
  type SdmsMatchPlayerStats,
  type SdmsPlayerStatCategory,
  type SdmsPlayerStatRow,
} from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import { PlayerProfileLink } from "./EntityProfileLinks";
import { TeamCrest } from "./TeamCrest";

type DetailCategory = SdmsPlayerStatCategory;

const CATEGORY_TABS: { id: DetailCategory; label: string }[] = [
  { id: "attack", label: "Attack" },
  { id: "defend", label: "Defence" },
  { id: "kicking", label: "Kicking" },
  { id: "errors", label: "Errors" },
  { id: "carries", label: "Carries" },
];

const COLS: Record<DetailCategory, { key: string; short: string }[]> = {
  attack: [
    { key: "offloads", short: "O" },
    { key: "passes", short: "P" },
    { key: "try_assists", short: "TA" },
    { key: "clean_breaks", short: "CB" },
    { key: "defenders_beaten", short: "DB" },
    { key: "metres", short: "M" },
  ],
  defend: [
    { key: "minutes_played", short: "Min" },
    { key: "tackles", short: "T" },
    { key: "turnovers_won", short: "TO" },
    { key: "missed_tackles", short: "MT" },
  ],
  kicking: [
    { key: "kicks", short: "K" },
    { key: "kicks_from_hand", short: "KH" },
    { key: "kick_from_hand_metres", short: "KM" },
    { key: "kick_possession_retained", short: "KR" },
  ],
  errors: [
    { key: "bad_passes", short: "BP" },
    { key: "dropped_catch", short: "DC" },
    { key: "handling_error", short: "HE" },
    { key: "turnovers_conceded", short: "TC" },
  ],
  carries: [
    { key: "runs", short: "R" },
    { key: "gain_line", short: "GL" },
    { key: "carries_metres", short: "CM" },
    { key: "carries_crossed_gain_line", short: "XGL" },
    { key: "carries_not_made_gain_line", short: "NGL" },
  ],
};

function mergePlayerRows(
  rowsByCategory: Partial<Record<SdmsPlayerStatCategory, SdmsPlayerStatRow[]>>,
): SdmsPlayerStatRow[] {
  const byId = new Map<string, SdmsPlayerStatRow>();
  for (const rows of Object.values(rowsByCategory)) {
    for (const row of rows ?? []) {
      const key = String(row.player_id ?? row.player_name ?? "");
      if (!key) continue;
      const prev = byId.get(key) ?? { player_id: row.player_id, player_name: row.player_name };
      byId.set(key, { ...prev, ...row });
    }
  }
  return [...byId.values()];
}

export function PlayerStatsDetailed({
  playerStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  entities,
  initialCategory,
}: {
  playerStats: SdmsMatchPlayerStats;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  entities: MatchEntityContext;
  initialCategory?: DetailCategory;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [category, setCategory] = useState<DetailCategory>(initialCategory ?? "attack");
  const [filter, setFilter] = useState<"all" | "starters" | "bench">("all");

  const rows = useMemo(() => {
    const sideStats = playerStats[side];
    const byCategory: Partial<Record<SdmsPlayerStatCategory, SdmsPlayerStatRow[]>> = {};
    for (const cat of SDMS_PLAYER_STAT_CATEGORIES) {
      byCategory[cat] = sideStats[cat]?.detail_list ?? [];
    }
    return mergePlayerRows(byCategory);
  }, [playerStats, side]);

  const cols = COLS[category];
  const teamName = side === "home" ? homeName : awayName;
  const teamImage = side === "home" ? homeImageUrl : awayImageUrl;

  // SDMS does not expose starter/bench on player-stats rows; filter stays UI-ready.
  const visible = filter === "all" ? rows : rows;

  return (
    <section className="pr-detailed" id="pr-player-detailed">
      <h2 className="pr-detailed__heading">Detailed</h2>

      <div className="pr-detailed__teams" role="tablist" aria-label="Team">
        <button
          type="button"
          role="tab"
          aria-selected={side === "home"}
          className={`pr-detailed__team${side === "home" ? " pr-detailed__team--active" : ""}`}
          onClick={() => setSide("home")}
        >
          {homeName}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === "away"}
          className={`pr-detailed__team${side === "away" ? " pr-detailed__team--active" : ""}`}
          onClick={() => setSide("away")}
        >
          {awayName}
        </button>
      </div>

      <div className="pr-detailed__filters" role="tablist" aria-label="Stat category">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={category === tab.id}
            className={`pr-detailed__filter${category === tab.id ? " pr-detailed__filter--active" : ""}`}
            onClick={() => setCategory(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pr-detailed__toolbar">
        <label className="pr-detailed__select">
          <span className="sr-only">Position filter</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="all">All</option>
            <option value="starters">Starters</option>
            <option value="bench">Replacements</option>
          </select>
        </label>
        <span className="pr-detailed__source">Source: {category}</span>
      </div>

      <div className="pr-detailed__table-wrap">
        <table className="pr-detailed__table">
          <thead>
            <tr>
              <th>
                <span className="pr-detailed__th-team">
                  <TeamCrest name={teamName} imageUrl={teamImage} size="sm" />
                  Player
                </span>
              </th>
              {cols.map((c) => (
                <th key={c.key} title={c.key.replace(/_/g, " ")}>
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 1} className="pr-detailed__empty">
                  No player stats for this team yet.
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr key={row.player_id ?? row.player_name ?? i}>
                  <td>
                    <span className="pr-detailed__player">
                      <span className="pr-detailed__num">{i + 1}</span>
                      <PlayerProfileLink
                        name={row.player_name ?? "—"}
                        externalId={row.player_id}
                        context={entities}
                      />
                    </span>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key}>{row[c.key] ?? 0}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
