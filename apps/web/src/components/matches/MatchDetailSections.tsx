"use client";

import { useMemo, useState } from "react";
import type { SdmsKeyEvent } from "@rugby365/import-sdk";
import {
  rankPlayerStatRows,
  sdmsHomeAwayStatRows,
  type SdmsMatchPlayerStats,
  type SdmsMatchStatsBundle,
  type SdmsPlayerStatCategory,
  type SdmsPlayerStatRow,
} from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import { lookupPlayerLink, normalizeProviderPlayerName } from "@/lib/match-entity-context";
import { PlayerProfileLink } from "./EntityProfileLinks";

type ScoringEntry = { player_id?: string; player_name?: string; minute?: number; card_type?: string };

function formatPercent(value: number): string {
  if (value <= 1 && value >= 0) return `${Math.round(value * 100)}%`;
  return `${Math.round(value)}%`;
}

function formatEventTime(minute: number, second?: number): string {
  if (second && second > 0) return `${minute}'${String(second).padStart(2, "0")}`;
  return `${minute}'`;
}

function eventIconClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("try")) return "match-detail-event--try";
  if (t.includes("conversion")) return "match-detail-event--conversion";
  if (t.includes("penalty")) return "match-detail-event--penalty";
  if (t.includes("yellow")) return "match-detail-event--yellow";
  if (t.includes("red")) return "match-detail-event--red";
  if (t.includes("sub")) return "match-detail-event--sub";
  if (t.includes("half")) return "match-detail-event--period";
  return "";
}

function CompareBarRow({
  label,
  home,
  away,
  format,
}: {
  label: string;
  home: number;
  away: number;
  format?: "percent";
}) {
  const homeVal = format === "percent" ? home : home;
  const awayVal = format === "percent" ? away : away;
  const total = homeVal + awayVal || 1;
  const homePct = Math.round((homeVal / total) * 100);
  const awayPct = 100 - homePct;
  const homeLabel = format === "percent" ? formatPercent(home) : String(home);
  const awayLabel = format === "percent" ? formatPercent(away) : String(away);

  return (
    <div className="match-detail-compare">
      <div className="match-detail-compare__values">
        <span>{homeLabel}</span>
        <span className="match-detail-compare__label">{label}</span>
        <span>{awayLabel}</span>
      </div>
      <div className="match-detail-compare__bar">
        <span style={{ width: `${homePct}%` }} className="match-detail-compare__home" />
        <span style={{ width: `${awayPct}%` }} className="match-detail-compare__away" />
      </div>
    </div>
  );
}

function StatSection({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; home: number; away: number; format?: "percent" }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="match-detail-stats-block cms-card">
      <h3 className="match-detail-section__title">{title}</h3>
      <div className="match-detail-compare-list">
        {rows.map((row) => (
          <CompareBarRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

function ScoringList({
  title,
  entries,
  entities,
}: {
  title: string;
  entries: ScoringEntry[];
  entities: MatchEntityContext;
}) {
  if (!entries.length) return null;
  return (
    <div className="match-detail-scoring-list">
      <h4 className="match-detail-scoring-list__title">{title}</h4>
      <ul>
        {entries.map((e, i) => {
          const displayName = normalizeProviderPlayerName(e.player_name ?? "") || "Unknown";
          return (
            <li key={`${e.player_id ?? i}-${e.minute ?? i}`}>
              <PlayerProfileLink name={displayName} externalId={e.player_id} context={entities} />
              {e.minute != null ? ` (${e.minute}')` : ""}
              {e.card_type ? ` · ${e.card_type}` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MatchSummaryPanel({
  homeName,
  awayName,
  matchStats,
  scoringDetail,
  entities,
}: {
  homeName: string;
  awayName: string;
  matchStats: SdmsMatchStatsBundle | null;
  scoringDetail: Record<string, unknown> | undefined;
  entities: MatchEntityContext;
}) {
  const summaryRows = sdmsHomeAwayStatRows(matchStats?.summary, {
    tries: "Tries",
    conversions: "Conversions",
    penalties: "Penalties",
    drop_goals: "Drop goals",
    carries: "Carries",
    metres: "Metres",
    tackles: "Tackles",
    turnovers_won: "Turnovers won",
  });

  const possessionRows = sdmsHomeAwayStatRows(matchStats?.possession, {
    overall_percentage: "Overall",
    first_half_percentage: "1st half",
    second_half_percentage: "2nd half",
  }).filter((r) => r.label.includes("Overall") || r.label.includes("half"));

  const territoryRows = sdmsHomeAwayStatRows(matchStats?.territory, {
    overall_percentage: "Overall",
    first_half_percentage: "1st half",
    second_half_percentage: "2nd half",
  }).filter((r) => r.label.includes("Overall") || r.label.includes("half"));

  const detail = scoringDetail ?? {};
  const homeScoring = {
    tries: (detail.home_tries as ScoringEntry[]) ?? [],
    conversions: (detail.home_conversions as ScoringEntry[]) ?? [],
    penalties: (detail.home_penalties as ScoringEntry[]) ?? [],
    cards: (detail.home_cards as ScoringEntry[]) ?? [],
  };
  const awayScoring = {
    tries: (detail.away_tries as ScoringEntry[]) ?? [],
    conversions: (detail.away_conversions as ScoringEntry[]) ?? [],
    penalties: (detail.away_penalties as ScoringEntry[]) ?? [],
    cards: (detail.away_cards as ScoringEntry[]) ?? [],
  };

  if (!matchStats && summaryRows.length === 0) {
    return <p className="match-detail-empty">Match summary is not available yet.</p>;
  }

  return (
    <section className="match-detail-section">
      <h2 className="match-detail-section__heading">Match summary</h2>
      <div className="match-detail-summary-grid">
        <StatSection title="Team totals" rows={summaryRows} />
        <StatSection title="Possession" rows={possessionRows} />
        <StatSection title="Territory" rows={territoryRows} />
      </div>
      {(homeScoring.tries.length > 0 ||
        awayScoring.tries.length > 0 ||
        homeScoring.cards.length > 0 ||
        awayScoring.cards.length > 0) && (
        <div className="match-detail-scoring cms-card">
          <h3 className="match-detail-section__title">Scoring &amp; discipline</h3>
          <div className="match-detail-scoring__teams">
            <div>
              <h4 className="match-detail-scoring__team">{homeName}</h4>
              <ScoringList title="Tries" entries={homeScoring.tries} entities={entities} />
              <ScoringList title="Conversions" entries={homeScoring.conversions} entities={entities} />
              <ScoringList title="Penalties" entries={homeScoring.penalties} entities={entities} />
              <ScoringList title="Cards" entries={homeScoring.cards} entities={entities} />
            </div>
            <div>
              <h4 className="match-detail-scoring__team">{awayName}</h4>
              <ScoringList title="Tries" entries={awayScoring.tries} entities={entities} />
              <ScoringList title="Conversions" entries={awayScoring.conversions} entities={entities} />
              <ScoringList title="Penalties" entries={awayScoring.penalties} entities={entities} />
              <ScoringList title="Cards" entries={awayScoring.cards} entities={entities} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function KeyEventsPanel({
  events,
  homeTeamId,
  entities,
}: {
  events: SdmsKeyEvent[];
  homeTeamId?: string;
  entities: MatchEntityContext;
}) {
  if (events.length === 0) {
    return <p className="match-detail-empty">Key events will appear once the match is under way.</p>;
  }

  const periods = useMemo(() => {
    const groups: { label: string; events: SdmsKeyEvent[] }[] = [];
    let current = "Match";
    for (const event of events) {
      const label = event.period || current;
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.events.push(event);
      else groups.push({ label, events: [event] });
      if (event.period) current = event.period;
    }
    return groups;
  }, [events]);

  return (
    <section className="match-detail-section">
      <h2 className="match-detail-section__heading">Key events</h2>
      {periods.map((group) => (
        <div key={group.label} className="match-detail-events cms-card">
          <h3 className="match-detail-events__period">{group.label}</h3>
          <ol className="match-detail-events__list">
            {group.events.map((e, i) => {
              const isHome = homeTeamId && e.team_id === homeTeamId;
              const player = e.player_name?.trim();
              return (
                <li
                  key={`${group.label}-${e.minute}-${e.type}-${i}`}
                  className={`match-detail-events__item ${eventIconClass(e.type)}${isHome ? " match-detail-events__item--home" : e.team_id ? " match-detail-events__item--away" : ""}`}
                >
                  <span className="match-detail-events__time">{formatEventTime(e.minute, e.second)}</span>
                  <span className="match-detail-events__type">{e.type}</span>
                  {player && (
                    <span className="match-detail-events__player">
                      <PlayerProfileLink
                        name={normalizeProviderPlayerName(player) || player}
                        externalId={e.player_id}
                        context={entities}
                      />
                    </span>
                  )}
                  {e.home_score != null && e.away_score != null && (
                    <span className="match-detail-events__score">
                      {e.home_score}–{e.away_score}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}

const TEAM_STAT_SECTIONS: { key: keyof SdmsMatchStatsBundle; title: string }[] = [
  { key: "attack", title: "Attack" },
  { key: "defence", title: "Defence" },
  { key: "kicking", title: "Kicking" },
  { key: "rucks", title: "Rucks" },
  { key: "set_piece", title: "Set piece" },
];

export function MatchTeamStatsPanel({
  matchStats,
}: {
  matchStats: SdmsMatchStatsBundle | null;
}) {
  if (!matchStats) {
    return <p className="match-detail-empty">Team stats are not available for this match yet.</p>;
  }

  return (
    <div className="match-detail-summary-grid">
      {TEAM_STAT_SECTIONS.map(({ key, title }) => (
        <StatSection
          key={key}
          title={title}
          rows={sdmsHomeAwayStatRows(matchStats[key] as Record<string, number>)}
        />
      ))}
    </div>
  );
}

const PLAYER_ATTACK_COLS = ["metres", "passes", "offloads", "try_assists", "clean_breaks", "defenders_beaten"];
const PLAYER_DEFEND_COLS = ["tackles", "turnovers_won", "missed_tackles"];
const PLAYER_KICKING_COLS = ["kicks", "kicks_from_hand", "kick_from_hand_metres", "kick_possession_retained"];

function playerStatColumns(category: SdmsPlayerStatCategory): string[] {
  if (category === "defend") return PLAYER_DEFEND_COLS;
  if (category === "kicking") return PLAYER_KICKING_COLS;
  return PLAYER_ATTACK_COLS;
}

function formatColLabel(col: string): string {
  return col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function PlayerStatsTable({
  rows,
  category,
  entities,
}: {
  rows: SdmsPlayerStatRow[];
  category: SdmsPlayerStatCategory;
  entities: MatchEntityContext;
}) {
  const cols = playerStatColumns(category);
  if (rows.length === 0) {
    return <p className="match-detail-empty match-detail-empty--inline">No player stats for this category.</p>;
  }

  return (
    <div className="match-detail-player-stats-table-wrap">
      <table className="match-detail-player-stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Min</th>
            {cols.map((col) => (
              <th key={col}>{formatColLabel(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.player_id ?? row.player_name}>
              <td>
                <PlayerProfileLink
                  name={row.player_name ?? "—"}
                  externalId={row.player_id}
                  context={entities}
                />
              </td>
              <td>{row.minutes_played ?? "—"}</td>
              {cols.map((col) => (
                <td key={col}>{row[col] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PlayerStatsPanel({
  playerStats,
  homeName,
  awayName,
  entities,
}: {
  playerStats: SdmsMatchPlayerStats | null;
  homeName: string;
  awayName: string;
  entities: MatchEntityContext;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const [category, setCategory] = useState<SdmsPlayerStatCategory>("attack");

  if (!playerStats) {
    return <p className="match-detail-empty">Player stats are not available for this match yet.</p>;
  }

  const bundle = playerStats[side][category];
  const rows = bundle?.detail_list ?? [];

  return (
    <section className="match-detail-section">
      <h2 className="match-detail-section__heading">Player stats</h2>
      <div className="match-detail-subtabs">
        <div className="match-detail-subtabs__group">
          <button
            type="button"
            className={`match-detail-subtabs__btn${side === "home" ? " match-detail-subtabs__btn--active" : ""}`}
            onClick={() => setSide("home")}
          >
            {homeName}
          </button>
          <button
            type="button"
            className={`match-detail-subtabs__btn${side === "away" ? " match-detail-subtabs__btn--active" : ""}`}
            onClick={() => setSide("away")}
          >
            {awayName}
          </button>
        </div>
        <div className="match-detail-subtabs__group">
          {(["attack", "defend", "kicking"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`match-detail-subtabs__btn${category === cat ? " match-detail-subtabs__btn--active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat === "defend" ? "Defence" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <PlayerStatsTable rows={rows} category={category} entities={entities} />
    </section>
  );
}

const KEY_PLAYER_LEADERS: Record<
  SdmsPlayerStatCategory,
  { metric: string; label: string }[]
> = {
  attack: [
    { metric: "metres", label: "Metres" },
    { metric: "defenders_beaten", label: "Defenders beaten" },
    { metric: "clean_breaks", label: "Clean breaks" },
  ],
  defend: [
    { metric: "tackles", label: "Tackles" },
    { metric: "turnovers_won", label: "Turnovers won" },
  ],
  kicking: [{ metric: "kick_from_hand_metres", label: "Kick metres" }],
};

export function KeyPlayerStatsPanel({
  playerStats,
  homeName,
  awayName,
  entities,
}: {
  playerStats: SdmsMatchPlayerStats | null;
  homeName: string;
  awayName: string;
  entities: MatchEntityContext;
}) {
  const [category, setCategory] = useState<SdmsPlayerStatCategory>("attack");

  if (!playerStats) {
    return null;
  }

  const leaders = KEY_PLAYER_LEADERS[category];
  const homeRows = playerStats.home[category]?.detail_list ?? [];
  const awayRows = playerStats.away[category]?.detail_list ?? [];

  return (
    <section className="match-detail-section">
      <h2 className="match-detail-section__heading">Key player stats</h2>
      <div className="match-detail-subtabs">
        <div className="match-detail-subtabs__group">
          {(["attack", "defend", "kicking"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`match-detail-subtabs__btn${category === cat ? " match-detail-subtabs__btn--active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat === "defend" ? "Defence" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="match-detail-key-players">
        {leaders.map(({ metric, label }) => (
          <div key={metric} className="match-detail-key-players__block cms-card">
            <h3 className="match-detail-section__title">{label}</h3>
            <div className="match-detail-key-players__cols">
              <div>
                <h4 className="match-detail-key-players__team">{homeName}</h4>
                <ol>
                  {rankPlayerStatRows(homeRows, metric).map((p) => (
                    <li key={`h-${p.player_id}-${metric}`}>
                      <span className="match-detail-key-players__rank">{p.rank}</span>
                      <span>
                        <PlayerProfileLink
                          name={p.player_name ?? "—"}
                          externalId={p.player_id}
                          context={entities}
                        />
                      </span>
                      <strong>{p.value}</strong>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <h4 className="match-detail-key-players__team">{awayName}</h4>
                <ol>
                  {rankPlayerStatRows(awayRows, metric).map((p) => (
                    <li key={`a-${p.player_id}-${metric}`}>
                      <span className="match-detail-key-players__rank">{p.rank}</span>
                      <span>
                        <PlayerProfileLink
                          name={p.player_name ?? "—"}
                          externalId={p.player_id}
                          context={entities}
                        />
                      </span>
                      <strong>{p.value}</strong>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
