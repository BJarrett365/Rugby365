"use client";

import { useMemo, useState } from "react";
import {
  rankPlayerStatRows,
  sdmsHomeAwayStatRows,
  type SdmsMatchPlayerStats,
  type SdmsMatchStatsBundle,
  type SdmsPlayerStatCategory,
  type SdmsPlayerStatRow,
} from "@rugby365/import-sdk";
import type { MatchEntityContext } from "@/lib/match-entity-context";
import {
  extractProviderScorerMinutes,
  formatProviderScorerMinutes,
  normalizeProviderPlayerName,
} from "@/lib/match-entity-context";
import {
  formatMatchEventMinute,
  type PublicKeyEvent,
} from "@/lib/match-key-events";
import { PlayerProfileLink } from "./EntityProfileLinks";
import {
  PrCompareStatCard,
  PrPossessionTerritoryCard,
  defenceRingsFromStats,
  kickingRingsFromStats,
  percentageRingsFromSection,
  rucksRingsFromStats,
  type CompareStatRow,
} from "./PrCompareStatCard";
import { PlayerStatsSnapshot } from "./PlayerStatsSnapshot";
import { PlayerStatsDetailed } from "./PlayerStatsDetailed";

type ScoringEntry = { player_id?: string; player_name?: string; minute?: number; card_type?: string };

/** Planet Rugby match-event icons from /content/themes/planet2/img/svg/match-events/ */
function eventIconSrc(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes("sent off") || (t.includes("red") && t.includes("card"))) {
    return "/match-events/player-sent-off.svg";
  }
  if (t.includes("yellow") || t.includes("sin bin") || t.includes("sinbin") || t.includes("carded")) {
    return "/match-events/player-carded.svg";
  }
  if (
    t.includes("sub") ||
    t.includes("replacement") ||
    t.includes("player on") ||
    t.includes("player off")
  ) {
    return "/match-events/player-on.svg";
  }
  if (t.includes("penalty try")) return "/match-events/penalty-try.svg";
  if (t.includes("missed") && t.includes("conversion")) return "/match-events/missed-conversion.svg";
  if (t.includes("missed") && t.includes("penalty")) return "/match-events/missed-penalty.svg";
  if (t.includes("conversion")) return "/match-events/conversion-scorer.svg";
  if (t.includes("penalty")) return "/match-events/penalty-scorer.svg";
  if (t.includes("drop")) return "/match-events/drop-goal-scorer.svg";
  if (t.includes("try")) return "/match-events/try.svg";
  return null;
}

function eventIconAlt(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("sent off") || (t.includes("red") && t.includes("card"))) return "Red card";
  if (t.includes("yellow") || t.includes("sin bin") || t.includes("sinbin") || t.includes("carded")) {
    return "Yellow card";
  }
  if (t.includes("sub") || t.includes("replacement") || t.includes("player on") || t.includes("player off")) {
    return "Substitution";
  }
  if (t.includes("penalty try")) return "Penalty try";
  if (t.includes("missed") && t.includes("conversion")) return "Missed conversion";
  if (t.includes("missed") && t.includes("penalty")) return "Missed penalty";
  if (t.includes("conversion")) return "Conversion";
  if (t.includes("penalty")) return "Penalty";
  if (t.includes("drop")) return "Drop goal";
  if (t.includes("try")) return "Try";
  return "Match event";
}

/** PR-style side label: tries show name only; kicks append Conversion/Penalty. */
function eventTypeLabel(type: string): string {
  const t = type.toLowerCase();
  if (!t.trim()) return "";
  if (t.includes("try") && !t.includes("penalty try") && !t.includes("conversion")) return "";
  if (t.includes("conversion")) return "Conversion";
  if (t.includes("penalty") && !t.includes("try")) return "Penalty";
  if (t.includes("drop")) return "Drop Goal";
  if (
    t.includes("sub") ||
    t.includes("replacement") ||
    t.includes("player on") ||
    t.includes("player off")
  ) {
    return "";
  }
  if (t.includes("yellow") || t.includes("sin bin") || t.includes("sinbin")) return "Yellow Card";
  if (t.includes("sent off") || (t.includes("red") && t.includes("card"))) return "Sent Off";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPeriodDivider(type: string, period?: string): boolean {
  const t = type.toLowerCase();
  if (t.includes("half end") || t.includes("half time") || t.includes("half-time")) return true;
  if (period && /half\s*time/i.test(period) && t.includes("half")) return true;
  return false;
}

function MirrorScorerList({
  title,
  homeEntries,
  awayEntries,
  entities,
}: {
  title: string;
  homeEntries: ScoringEntry[];
  awayEntries: ScoringEntry[];
  entities: MatchEntityContext;
}) {
  if (homeEntries.length === 0 && awayEntries.length === 0) return null;

  function sideList(entries: ScoringEntry[], side: "home" | "away") {
    if (entries.length === 0) {
      return <span className="pr-scorer-block__empty">—</span>;
    }
    return (
      <ul className={`pr-scorer-block__side pr-scorer-block__side--${side}`}>
        {entries.map((e, i) => {
          const displayName = normalizeProviderPlayerName(e.player_name ?? "") || "Unknown";
          const minutesLabel = formatProviderScorerMinutes(extractProviderScorerMinutes(e));
          return (
            <li key={`${side}-${e.player_id ?? i}-${minutesLabel || e.minute || i}`}>
              <PlayerProfileLink name={displayName} externalId={e.player_id} context={entities} />
              {minutesLabel ? <span className="pr-scorer-block__min">{minutesLabel}</span> : null}
              {e.card_type ? ` · ${e.card_type}` : ""}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="pr-scorer-block">
      <div className="pr-scorer-block__row">
        {sideList(homeEntries, "home")}
        <h4 className="pr-scorer-block__title">{title}</h4>
        {sideList(awayEntries, "away")}
      </div>
    </div>
  );
}

export function MatchDetailsCard({
  homeName,
  awayName,
  homeScore: _homeScore,
  awayScore: _awayScore,
  status: _status,
  scoringDetail,
  matchStats: _matchStats,
  entities,
  bonusPoints = null,
}: {
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  status: string;
  scoringDetail: Record<string, unknown> | undefined;
  matchStats: SdmsMatchStatsBundle | null;
  entities: MatchEntityContext;
  bonusPoints?: {
    tryBonusTotal: number;
    losingBonusTotal: number;
    homeTryBonusPoints: number;
    awayTryBonusPoints: number;
    homeLosingBonusPoints: number;
    awayLosingBonusPoints: number;
    rules: { tryBonusThreshold: number; losingBonusMargin: number };
  } | null;
}) {
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

  const hasScorers =
    homeScoring.tries.length > 0 ||
    awayScoring.tries.length > 0 ||
    homeScoring.conversions.length > 0 ||
    awayScoring.conversions.length > 0 ||
    homeScoring.penalties.length > 0 ||
    awayScoring.penalties.length > 0 ||
    homeScoring.cards.length > 0 ||
    awayScoring.cards.length > 0;

  const showBonus = bonusPoints != null;

  return (
    <section className="pr-mc-card">
      <h2 className="pr-mc-card__title">Match Details</h2>
      {showBonus ? (
        <div className="pr-bonus">
          <h3 className="pr-bonus__heading">Bonus Points</h3>
          <p className="pr-bonus__rules">
            Try bonus: {bonusPoints.rules.tryBonusThreshold}+ tries · Losing bonus: defeat by ≤
            {bonusPoints.rules.losingBonusMargin}
          </p>
          <div className="pr-bonus-tiles">
            <div className="pr-bonus-tile">
              <span className="pr-bonus-tile__label">Try</span>
              <div className="pr-bonus-tile__sides">
                <div>
                  <span className="pr-bonus-tile__value">{bonusPoints.homeTryBonusPoints}</span>
                  <span className="pr-bonus-tile__team">{homeName}</span>
                </div>
                <div>
                  <span className="pr-bonus-tile__value">{bonusPoints.awayTryBonusPoints}</span>
                  <span className="pr-bonus-tile__team">{awayName}</span>
                </div>
              </div>
            </div>
            <div className="pr-bonus-tile">
              <span className="pr-bonus-tile__label">Losing</span>
              <div className="pr-bonus-tile__sides">
                <div>
                  <span className="pr-bonus-tile__value">{bonusPoints.homeLosingBonusPoints}</span>
                  <span className="pr-bonus-tile__team">{homeName}</span>
                </div>
                <div>
                  <span className="pr-bonus-tile__value">{bonusPoints.awayLosingBonusPoints}</span>
                  <span className="pr-bonus-tile__team">{awayName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {hasScorers ? (
        <div className="pr-scorers">
          <div className="pr-scorers__heads" aria-hidden>
            <span>{homeName}</span>
            <span />
            <span>{awayName}</span>
          </div>
          <MirrorScorerList
            title="Tries"
            homeEntries={homeScoring.tries}
            awayEntries={awayScoring.tries}
            entities={entities}
          />
          <MirrorScorerList
            title="Conversions"
            homeEntries={homeScoring.conversions}
            awayEntries={awayScoring.conversions}
            entities={entities}
          />
          <MirrorScorerList
            title="Penalties"
            homeEntries={homeScoring.penalties}
            awayEntries={awayScoring.penalties}
            entities={entities}
          />
          <MirrorScorerList
            title="Cards"
            homeEntries={homeScoring.cards}
            awayEntries={awayScoring.cards}
            entities={entities}
          />
        </div>
      ) : (
        <p className="match-detail-empty match-detail-empty--inline">Scorers will appear once available.</p>
      )}
    </section>
  );
}

export function MatchSummaryPanel({
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  matchStats,
}: {
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  matchStats: SdmsMatchStatsBundle | null;
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
    overall_percentage: "Total",
    first_half_percentage: "First Half",
    second_half_percentage: "Second Half",
  }).filter((r) => /total|half|overall/i.test(r.label));

  const territoryRows = sdmsHomeAwayStatRows(matchStats?.territory, {
    overall_percentage: "Total",
    first_half_percentage: "First Half",
    second_half_percentage: "Second Half",
  }).filter((r) => /total|half|overall/i.test(r.label));

  if (!matchStats && summaryRows.length === 0) {
    return <p className="match-detail-empty">Match summary is not available yet.</p>;
  }

  const crest = {
    homeName,
    awayName,
    homeImageUrl,
    awayImageUrl,
  };

  return (
    <section className="match-detail-section">
      <PrCompareStatCard title="Match Summary" {...crest} rows={summaryRows} />
      {(possessionRows.length > 0 || territoryRows.length > 0) && (
        <div className="pr-stats-grid" style={{ marginTop: "1rem" }}>
          <PrPossessionTerritoryCard title="Possession" {...crest} rows={possessionRows} showPitch />
          <PrPossessionTerritoryCard title="Territory" {...crest} rows={territoryRows} showPitch />
        </div>
      )}
    </section>
  );
}

function KeyEventPlayers({
  event,
  entities,
}: {
  event: PublicKeyEvent;
  entities: MatchEntityContext;
}) {
  const onName = event.player_on?.trim();
  const offName = event.player_off?.trim();
  if (onName || offName) {
    return (
      <span className="pr-key-events__sub-lines">
        {onName ? (
          <span className="pr-key-events__sub-line">
            <PlayerProfileLink
              name={normalizeProviderPlayerName(onName) || onName}
              externalId={event.player_on_id ?? event.player_id}
              context={entities}
            />{" "}
            <span className="pr-key-events__type">On</span>
          </span>
        ) : null}
        {offName ? (
          <span className="pr-key-events__sub-line">
            <PlayerProfileLink
              name={normalizeProviderPlayerName(offName) || offName}
              externalId={event.player_off_id ?? undefined}
              context={entities}
            />{" "}
            <span className="pr-key-events__type">Off</span>
          </span>
        ) : null}
      </span>
    );
  }

  const player = event.player_name?.trim();
  if (!player) return null;
  const typeLabel = eventTypeLabel(event.type);
  return (
    <>
      <PlayerProfileLink
        name={normalizeProviderPlayerName(player) || player}
        externalId={event.player_id}
        context={entities}
      />
      {typeLabel ? <span className="pr-key-events__type">{typeLabel}</span> : null}
    </>
  );
}

export function KeyEventsPanel({
  events,
  homeTeamId,
  entities,
}: {
  events: PublicKeyEvent[];
  homeTeamId?: string;
  entities: MatchEntityContext;
}) {
  const rows = useMemo(() => {
    const out: Array<
      | { kind: "period"; label: string; key: string }
      | { kind: "event"; event: PublicKeyEvent; key: string }
    > = [];
    let halfDividerAdded = false;
    events.forEach((e, i) => {
      if (isPeriodDivider(e.type, e.period) && !halfDividerAdded) {
        out.push({ kind: "period", label: "Half Time", key: `period-${i}` });
        halfDividerAdded = true;
        return;
      }
      if (
        /half\s*start|full\s*time|kick\s*off/i.test(e.type) &&
        !e.player_name &&
        !e.player_on &&
        !e.player_off
      ) {
        return;
      }
      out.push({
        kind: "event",
        event: e,
        key: `${e.minute}-${e.type}-${e.player_on ?? e.player_off ?? e.player_name ?? i}-${i}`,
      });
    });
    return out;
  }, [events]);

  if (events.length === 0) {
    return <p className="match-detail-empty">Key events will appear once the match is under way.</p>;
  }

  return (
    <section className="pr-mc-card pr-key-events">
      <h2 className="pr-mc-card__title">Key Events</h2>
      <ol className="pr-key-events__list">
        {rows.map((row) => {
          if (row.kind === "period") {
            return (
              <li key={row.key} className="pr-key-events__item pr-key-events__item--period">
                <span className="pr-key-events__half">{row.label}</span>
              </li>
            );
          }
          const e = row.event;
          const isHome = Boolean(homeTeamId && e.team_id === homeTeamId);
          const isAway = Boolean(e.team_id && (!homeTeamId || e.team_id !== homeTeamId));
          const iconSrc = eventIconSrc(e.type);

          return (
            <li key={row.key} className="pr-key-events__item">
              <div className="pr-key-events__home">
                {isHome && (
                  <>
                    <KeyEventPlayers event={e} entities={entities} />
                    {e.home_score != null && e.away_score != null && (
                      <span className="pr-key-events__score">
                        {e.home_score}–{e.away_score}
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="pr-key-events__capsule">
                {iconSrc ? (
                  <img
                    className="pr-key-events__icon"
                    src={iconSrc}
                    alt={eventIconAlt(e.type)}
                    width={16}
                    height={16}
                  />
                ) : null}
                <span className="pr-key-events__time">{formatMatchEventMinute(e.minute)}</span>
              </div>
              <div className="pr-key-events__away">
                {isAway && (
                  <>
                    <KeyEventPlayers event={e} entities={entities} />
                    {e.home_score != null && e.away_score != null && (
                      <span className="pr-key-events__score">
                        {e.home_score}–{e.away_score}
                      </span>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function teamStatRows(section: Record<string, number> | undefined): CompareStatRow[] {
  return sdmsHomeAwayStatRows(section);
}

export function MatchTeamStatsPanel({
  matchStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
}: {
  matchStats: SdmsMatchStatsBundle | null;
  homeName?: string;
  awayName?: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
}) {
  if (!matchStats) {
    return <p className="match-detail-empty">Team stats are not available for this match yet.</p>;
  }

  const crest = {
    homeName: homeName ?? "Home",
    awayName: awayName ?? "Away",
    homeImageUrl,
    awayImageUrl,
  };

  const defence = matchStats.defence ?? {};
  const defenceRows = teamStatRows({
    ...defence,
    ...(matchStats.summary?.home_tackles != null
      ? { home_tackles: matchStats.summary.home_tackles, away_tackles: matchStats.summary.away_tackles ?? 0 }
      : {}),
  });

  return (
    <div className="pr-stats-grid">
      <PrCompareStatCard title="Attack" {...crest} rows={teamStatRows(matchStats.attack)} />
      <PrCompareStatCard
        title="Defence"
        {...crest}
        rows={defenceRows}
        rings={defenceRingsFromStats({
          ...defence,
          home_tackles: matchStats.summary?.home_tackles ?? defence.home_tackles ?? 0,
          away_tackles: matchStats.summary?.away_tackles ?? defence.away_tackles ?? 0,
        })}
      />
      <PrCompareStatCard
        title="Kicking"
        {...crest}
        rows={teamStatRows(matchStats.kicking)}
        rings={kickingRingsFromStats(matchStats.kicking)}
      />
      <PrCompareStatCard
        title="Rucks"
        {...crest}
        rows={teamStatRows(matchStats.rucks)}
        rings={rucksRingsFromStats(matchStats.rucks)}
      />
      <PrCompareStatCard
        title="Set Piece"
        {...crest}
        rows={teamStatRows(matchStats.set_piece)}
        rings={percentageRingsFromSection(matchStats.set_piece, "Set Piece Success", [
          "lineout_success_percentage",
          "scrum_success_percentage",
          "success_percentage",
        ])}
      />
      <PrPossessionTerritoryCard
        title="Possession"
        {...crest}
        rows={sdmsHomeAwayStatRows(matchStats.possession, {
          overall_percentage: "Total",
          first_half_percentage: "First Half",
          second_half_percentage: "Second Half",
        }).filter((r) => /total|half|overall/i.test(r.label))}
        showPitch
      />
      <PrPossessionTerritoryCard
        title="Territory"
        {...crest}
        rows={sdmsHomeAwayStatRows(matchStats.territory, {
          overall_percentage: "Total",
          first_half_percentage: "First Half",
          second_half_percentage: "Second Half",
        }).filter((r) => /total|half|overall/i.test(r.label))}
        showPitch
      />
    </div>
  );
}

const PLAYER_ATTACK_COLS = ["metres", "passes", "offloads", "try_assists", "clean_breaks", "defenders_beaten"];
const PLAYER_DEFEND_COLS = ["tackles", "turnovers_won", "missed_tackles"];
const PLAYER_KICKING_COLS = ["kicks", "kicks_from_hand", "kick_from_hand_metres", "kick_possession_retained"];
const PLAYER_ERRORS_COLS = ["bad_passes", "dropped_catch", "handling_error", "turnovers_conceded"];
const PLAYER_CARRIES_COLS = [
  "runs",
  "gain_line",
  "carries_metres",
  "carries_crossed_gain_line",
  "carries_not_made_gain_line",
];

function playerStatColumns(category: SdmsPlayerStatCategory): string[] {
  if (category === "defend") return PLAYER_DEFEND_COLS;
  if (category === "kicking") return PLAYER_KICKING_COLS;
  if (category === "errors") return PLAYER_ERRORS_COLS;
  if (category === "carries") return PLAYER_CARRIES_COLS;
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

function PlayerStatsPublic({
  playerStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  entities,
}: {
  playerStats: SdmsMatchPlayerStats;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  entities: MatchEntityContext;
}) {
  return (
    <>
      <PlayerStatsSnapshot
        playerStats={playerStats}
        homeName={homeName}
        awayName={awayName}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
        entities={entities}
        onSeeMore={() => {
          document.getElementById("pr-player-detailed")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
      <PlayerStatsDetailed
        playerStats={playerStats}
        homeName={homeName}
        awayName={awayName}
        homeImageUrl={homeImageUrl}
        awayImageUrl={awayImageUrl}
        entities={entities}
      />
    </>
  );
}

/** Team Stats tab content (previously under Stats → Team Stats). */
export function TeamStatsTabPanel({
  matchStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
}: {
  matchStats: SdmsMatchStatsBundle | null;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
}) {
  return (
    <TeamStatsStack
      matchStats={matchStats}
      homeName={homeName}
      awayName={awayName}
      homeImageUrl={homeImageUrl}
      awayImageUrl={awayImageUrl}
    />
  );
}

/** Player Stats tab content (promoted from Stats sub-toggle). */
export function PlayerStatsTabPanel({
  playerStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
  entities,
}: {
  playerStats: SdmsMatchPlayerStats | null;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  entities: MatchEntityContext;
}) {
  if (!playerStats) {
    return <p className="match-detail-empty">Player stats are not available for this match yet.</p>;
  }
  return (
    <PlayerStatsPublic
      playerStats={playerStats}
      homeName={homeName}
      awayName={awayName}
      homeImageUrl={homeImageUrl}
      awayImageUrl={awayImageUrl}
      entities={entities}
    />
  );
}

/** @deprecated Prefer TeamStatsTabPanel / PlayerStatsTabPanel. Kept for any residual imports. */
export function StatsTabPanel({
  matchStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
}: {
  matchStats: SdmsMatchStatsBundle | null;
  playerStats?: SdmsMatchPlayerStats | null;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
  entities?: MatchEntityContext;
}) {
  return (
    <TeamStatsTabPanel
      matchStats={matchStats}
      homeName={homeName}
      awayName={awayName}
      homeImageUrl={homeImageUrl}
      awayImageUrl={awayImageUrl}
    />
  );
}

function TeamStatsStack({
  matchStats,
  homeName,
  awayName,
  homeImageUrl,
  awayImageUrl,
}: {
  matchStats: SdmsMatchStatsBundle | null;
  homeName: string;
  awayName: string;
  homeImageUrl?: string | null;
  awayImageUrl?: string | null;
}) {
  if (!matchStats) {
    return <p className="match-detail-empty">Team stats are not available for this match yet.</p>;
  }

  const crest = { homeName, awayName, homeImageUrl, awayImageUrl };
  const summaryRows = sdmsHomeAwayStatRows(matchStats.summary, {
    tries: "Tries",
    conversions: "Conversions",
    penalties: "Penalties",
    drop_goals: "Drop Goals",
    metres: "Metres",
    clean_breaks: "Clean Breaks",
    defenders_beaten: "Defenders Beaten",
    turnovers_won: "Turnovers Won",
    carries: "Carries",
    passes: "Passes",
    tackles: "Tackles",
  });
  const attack = matchStats.attack ?? {};
  const breaksRows = sdmsHomeAwayStatRows(
    {
      home_clean_breaks: attack.home_clean_breaks ?? matchStats.summary?.home_clean_breaks ?? 0,
      away_clean_breaks: attack.away_clean_breaks ?? matchStats.summary?.away_clean_breaks ?? 0,
      home_metres: attack.home_metres ?? matchStats.summary?.home_metres ?? 0,
      away_metres: attack.away_metres ?? matchStats.summary?.away_metres ?? 0,
      home_offloads: attack.home_offloads ?? 0,
      away_offloads: attack.away_offloads ?? 0,
    },
    {
      clean_breaks: "Clean Breaks",
      metres: "Metres Made",
      offloads: "Offloads",
    },
  );

  return (
    <div className="pr-team-stats-stack">
      <PrCompareStatCard title="Match Summary" {...crest} rows={summaryRows} />
      <PrPossessionTerritoryCard
        title="Territory"
        {...crest}
        rows={sdmsHomeAwayStatRows(matchStats.territory, {
          overall_percentage: "Total",
          first_half_percentage: "First Half",
          second_half_percentage: "Second Half",
        }).filter((r) => /total|half|overall/i.test(r.label))}
        showPitch
      />
      <PrPossessionTerritoryCard
        title="Possession"
        {...crest}
        rows={sdmsHomeAwayStatRows(matchStats.possession, {
          overall_percentage: "Total",
          first_half_percentage: "First Half",
          second_half_percentage: "Second Half",
        }).filter((r) => /total|half|overall/i.test(r.label))}
        showPitch
      />
      <PrCompareStatCard
        title="Defence"
        {...crest}
        rows={teamStatRows({
          ...matchStats.defence,
          ...(matchStats.summary?.home_tackles != null
            ? {
                home_tackles: matchStats.summary.home_tackles,
                away_tackles: matchStats.summary.away_tackles ?? 0,
              }
            : {}),
        })}
        rings={defenceRingsFromStats({
          ...matchStats.defence,
          home_tackles: matchStats.summary?.home_tackles ?? matchStats.defence?.home_tackles ?? 0,
          away_tackles: matchStats.summary?.away_tackles ?? matchStats.defence?.away_tackles ?? 0,
        })}
      />
      <PrCompareStatCard
        title="Kicking"
        {...crest}
        rows={teamStatRows(matchStats.kicking)}
        rings={kickingRingsFromStats(matchStats.kicking)}
      />
      <PrCompareStatCard title="Breaks" {...crest} rows={breaksRows} />
      <PrCompareStatCard
        title="Set Piece"
        {...crest}
        rows={teamStatRows(matchStats.set_piece)}
        rings={[
          ...percentageRingsFromSection(matchStats.set_piece, "Scrum Success", [
            "scrum_success_percentage",
            "scrum_won_percentage",
          ]),
          ...percentageRingsFromSection(matchStats.set_piece, "Lineout Success", [
            "lineout_success_percentage",
            "lineout_won_percentage",
          ]),
        ]}
      />
      <PrCompareStatCard
        title="Rucks"
        {...crest}
        rows={teamStatRows(matchStats.rucks)}
        rings={rucksRingsFromStats(matchStats.rucks)}
      />
    </div>
  );
}

const KEY_PLAYER_CATEGORIES = ["attack", "defend", "kicking", "errors", "carries"] as const;

const KEY_PLAYER_LEADERS: Record<
  (typeof KEY_PLAYER_CATEGORIES)[number],
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
  errors: [
    { metric: "bad_passes", label: "Bad passes" },
    { metric: "handling_error", label: "Handling errors" },
  ],
  carries: [
    { metric: "runs", label: "Runs" },
    { metric: "carries_metres", label: "Carry metres" },
  ],
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
  const [category, setCategory] = useState<(typeof KEY_PLAYER_CATEGORIES)[number]>("attack");

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
          {KEY_PLAYER_CATEGORIES.map((cat) => (
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
