"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type MouseEvent } from "react";
import { R365PitchHeatmap } from "@/components/charts/R365PitchHeatmap";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { pluralizePositionLabel, shortCompetitionLabel } from "@/lib/player-ranking-engine";
import type { PublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import {
  defaultGameLogSeasonSlug,
  filterGameLogBySeason,
  formatKickStat,
  formatStatNumber,
  GAME_LOG_CAREER_SLUG,
} from "@/lib/public-player-stats-v2-math";
import {
  PLAYER_STATS_PER80_MIN_MINUTES,
  PLAYER_STATS_RANK_MIN_APPEARANCES,
  PLAYER_STATS_RANK_MIN_MINUTES,
  type ContributionRing,
  type DefensiveStats,
  type GameLogRatingBand,
  type GameLogRow,
  type KickingAccuracy,
  type PassingZones,
  type SpatialCoverageDto,
  type Per80Comparison,
  type PlayerStatsCoverage,
  type PlayerStatsPeriod,
  type PlayerStatsSection,
  type PlayerStatsV2Dto,
  type PointsBreakdown,
  type SeasonAverageItem,
  type StatsSlice,
  type SummaryTableRow,
} from "@/lib/public-player-stats-v2-types";

const GAME_LOG_PAGE_SIZE = 20;
const GAME_LOG_PREVIEW_SIZE = 5;

const SECTIONS: Array<{ id: PlayerStatsSection; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "attack", label: "Attack" },
  { id: "kicking", label: "Kicking" },
  { id: "defence", label: "Defence" },
  { id: "breakdown", label: "Breakdown" },
  { id: "discipline", label: "Discipline" },
  { id: "game-log", label: "Game Log" },
];

const PER80_NA_KEYS = new Set<SummaryTableRow["key"]>([
  "matches",
  "passSuccessPct",
  "tackleSuccessPct",
  "yellowCards",
  "redCards",
]);

const DOUGHNUT_COLORS = {
  tries: "#22c55e",
  conversions: "#86efac",
  penalties: "#38bdf8",
  dropGoals: "#eab308",
};

function dash(value: number | null, opts?: { digits?: number; percent?: boolean }): string {
  return formatStatNumber(value, opts);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function scrollToSection(id: PlayerStatsSection) {
  const el = document.getElementById(`pstats-${id}`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function coverageTooltip(stats: PlayerStatsV2Dto): string {
  const bits = [
    `${stats.coverage.eligibleAppearances} eligible appearances`,
    `${stats.coverage.performanceRows} with match performance rows`,
    `scoring from ${stats.coverage.scoringSource.replace(/_/g, " ")}`,
  ];
  if (stats.coverage.notes[0]) bits.push(stats.coverage.notes[0]);
  return bits.join(" · ");
}

function SummaryCell({
  text,
  tone,
  title,
}: {
  text: string;
  tone: "season" | "career" | "per80" | "rank" | "muted";
  title?: string | null;
}) {
  const isDash = text === "—" || text === "-";
  return (
    <td
      className={`pr-pstats__cell pr-pstats__cell--${isDash ? "muted" : tone}`}
      title={title || undefined}
    >
      {text}
    </td>
  );
}

function formatSummaryValue(
  row: SummaryTableRow,
  which: "season" | "career" | "per80",
): string {
  if (which === "season" && row.seasonDetail) return row.seasonDetail;
  if (which === "career" && row.careerDetail) return row.careerDetail;
  if (which === "season") return dash(row.season, { percent: row.isPercent, digits: row.isPercent ? 0 : 0 });
  if (which === "career") return dash(row.career, { percent: row.isPercent, digits: row.isPercent ? 0 : 0 });
  if (PER80_NA_KEYS.has(row.key)) return "—";
  return dash(row.per80, { digits: 1, percent: row.isPercent });
}

function per80Tooltip(row: SummaryTableRow): string {
  if (row.key === "matches") return "Appearances only — per 80 not applicable";
  if (row.key === "passSuccessPct" || row.key === "tackleSuccessPct") {
    return "Success rates use raw totals (not averaged match %), so per 80 is not shown";
  }
  if (row.key === "yellowCards" || row.key === "redCards") {
    return "Card totals are not expressed per 80 minutes";
  }
  if (row.per80 == null) {
    return `Per 80 requires ≥${PLAYER_STATS_PER80_MIN_MINUTES} known minutes (count ÷ minutes × 80)`;
  }
  return `Season total ÷ known minutes × 80 (min ${PLAYER_STATS_PER80_MIN_MINUTES} mins)`;
}

function rankTooltip(row: SummaryTableRow, peerPlural: string): string {
  if (row.rankTooltip) return row.rankTooltip;
  if (row.key === "matches" || row.key === "yellowCards" || row.key === "redCards") {
    return "Not ranked for this metric";
  }
  return `No rank — needs ≥${PLAYER_STATS_RANK_MIN_MINUTES} mins or ${PLAYER_STATS_RANK_MIN_APPEARANCES} apps among ${peerPlural}, ranked by per-80`;
}

export function PublicPlayerStatsV2({
  overview,
  stats,
  initialPeriod,
  initialSection,
}: {
  overview: PublicPlayerOverviewV2;
  stats: PlayerStatsV2Dto;
  initialPeriod?: PlayerStatsPeriod;
  initialSection?: PlayerStatsSection;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<PlayerStatsPeriod>(initialPeriod ?? "season");
  const [section, setSection] = useState<PlayerStatsSection>(initialSection ?? "summary");
  const [logSeasonSlug, setLogSeasonSlug] = useState(() =>
    defaultGameLogSeasonSlug({
      period: initialPeriod ?? "season",
      selectedSeasonSlug: stats.selectedSeasonSlug,
      availableSeasons: stats.availableSeasons,
    }),
  );
  const [logVisibleCount, setLogVisibleCount] = useState(GAME_LOG_PAGE_SIZE);

  const slice: StatsSlice = period === "career" ? stats.career : stats.season;
  const logSeasonOptions = stats.availableSeasons.filter((s) => s.appearances > 0);
  const logSeasonLabel =
    logSeasonSlug === GAME_LOG_CAREER_SLUG
      ? "Career"
      : (logSeasonOptions.find((s) => s.slug === logSeasonSlug)?.label ??
        stats.selectedSeasonLabel);
  const logRows = filterGameLogBySeason(stats.career.gameLog, logSeasonSlug);
  const logPreviewRows = logRows.slice(0, GAME_LOG_PREVIEW_SIZE);
  const logPagedRows = logRows.slice(0, logVisibleCount);
  const showTeamColumn = logSeasonSlug === GAME_LOG_CAREER_SLUG;
  const logHasMore = logRows.length > logVisibleCount;

  const onLogSeasonChange = (slug: string) => {
    setLogSeasonSlug(slug);
    setLogVisibleCount(GAME_LOG_PAGE_SIZE);
  };
  const rankPeerHeader = pluralizePositionLabel(stats.positionPeerLabel).toUpperCase();

  const persist = (nextPeriod: PlayerStatsPeriod, nextSection: PlayerStatsSection) => {
    const params = new URLSearchParams();
    if (nextPeriod === "career") params.set("period", "career");
    if (nextSection !== "summary") params.set("section", nextSection);
    const qs = params.toString();
    router.replace(`/players/${overview.slug}/stats${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const onPeriod = (next: PlayerStatsPeriod) => {
    setPeriod(next);
    persist(next, section);
  };

  const onSection = (next: PlayerStatsSection) => {
    setSection(next);
    persist(period, next);
    scrollToSection(next);
  };

  const openFullGameLog = () => {
    onSection("game-log");
    setLogVisibleCount(GAME_LOG_PAGE_SIZE);
  };

  return (
    <article className="pr-player-v2 pr-pstats">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Stats" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="stats" />

      <div className="pr-player-v2__hero-lead">
        <PlayerIdentityHero overview={overview} />
        <aside className="pr-pstats__kpi-panel" aria-label="Season and career statistics">
          <div className="pr-pstats__period" role="tablist" aria-label="Season or career">
            <button
              type="button"
              role="tab"
              aria-selected={period === "season"}
              className={period === "season" ? "is-active" : undefined}
              onClick={() => onPeriod("season")}
            >
              Season {stats.selectedSeasonLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={period === "career"}
              className={period === "career" ? "is-active" : undefined}
              onClick={() => onPeriod("career")}
            >
              Career
            </button>
          </div>
          <div className="pr-pstats__kpi-grid">
            {slice.kpis.map((kpi) => (
              <div key={kpi.key} className="pr-pstats__kpi">
                <span>{kpi.label}</span>
                <strong>{dash(kpi.value, { digits: 0 })}</strong>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <nav className="pr-pstats__tabs" aria-label="Stats sections">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "is-active" : undefined}
            onClick={() => onSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pr-player-v2__grid pr-pstats__body">
        <div className="pr-pstats__summary-row" id="pstats-summary">
          <section className="pr-player-v2__card pr-pstats__table-card">
            <div className="pr-player-v2__card-head pr-pstats__table-head">
              <h2>Summary Stats</h2>
              <button
                type="button"
                className="pr-pstats__info"
                title={coverageTooltip(stats)}
                aria-label="Data coverage"
              >
                i
              </button>
            </div>
            <div className="pr-player-v2__table-wrap">
              <table className="pr-player-v2__table pr-pstats__table">
                <colgroup>
                  <col className="pr-pstats__col-stat" />
                  <col className="pr-pstats__col-season" />
                  <col className="pr-pstats__col-career" />
                  <col className="pr-pstats__col-per80" />
                  <col className="pr-pstats__col-rank" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Stat</th>
                    <th scope="col">Season {stats.selectedSeasonLabel}</th>
                    <th scope="col">Career Total</th>
                    <th scope="col">Per 80 Mins</th>
                    <th scope="col">Rank ({rankPeerHeader})</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.summaryTable.map((row) => (
                    <tr key={row.key}>
                      <th scope="row">{row.label}</th>
                      <SummaryCell text={formatSummaryValue(row, "season")} tone="season" />
                      <SummaryCell
                        text={formatSummaryValue(row, "career")}
                        tone="career"
                        title={row.careerTooltip}
                      />
                      <SummaryCell
                        text={formatSummaryValue(row, "per80")}
                        tone="per80"
                        title={per80Tooltip(row)}
                      />
                      <SummaryCell
                        text={row.rankLabel ?? "—"}
                        tone="rank"
                        title={rankTooltip(row, rankPeerHeader)}
                      />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="pr-pstats__side">
            <PointsDoughnutCard breakdown={slice.pointsBreakdown} />
            <Per80Card comparison={slice.per80} />
          </div>
        </div>

        <GameLogPreviewCard
          rows={logPreviewRows}
          seasonLabel={logSeasonLabel}
          seasonSlug={logSeasonSlug}
          seasonOptions={logSeasonOptions}
          showTeamColumn={showTeamColumn}
          coverage={stats.coverage}
          onSeasonChange={onLogSeasonChange}
          onViewFull={openFullGameLog}
        />

        <div className="pr-pstats__quad">
          <div id="pstats-attack" className="pr-pstats__quad-item">
            <ContributionCard
              rings={slice.attackingContribution}
              period={period}
              seasonLabel={stats.selectedSeasonLabel}
            />
          </div>
          <div className="pr-pstats__quad-item">
            <PassingZonesCard
              zones={slice.passingZones}
              seasonLabel={stats.selectedSeasonLabel}
              seasonSlug={stats.selectedSeasonSlug}
              availableSeasons={stats.availableSeasons}
              onSeasonChange={(slug) => {
                const params = new URLSearchParams(window.location.search);
                params.set("season", slug);
                router.replace(`/players/${overview.slug}/stats?${params.toString()}`, { scroll: false });
              }}
            />
          </div>
          <div id="pstats-kicking" className="pr-pstats__quad-item">
            <KickingCard
              kicking={slice.kickingAccuracy}
              period={period}
              seasonLabel={stats.selectedSeasonLabel}
            />
          </div>
          <div id="pstats-defence" className="pr-pstats__quad-item">
            <DefenceCard
              defence={slice.defence}
              period={period}
              seasonLabel={stats.selectedSeasonLabel}
              seasonSlug={stats.selectedSeasonSlug}
              availableSeasons={stats.availableSeasons}
              onSeasonChange={(slug) => {
                const params = new URLSearchParams(window.location.search);
                params.set("season", slug);
                router.replace(`/players/${overview.slug}/stats?${params.toString()}`, { scroll: false });
              }}
            />
          </div>
        </div>

        <div id="pstats-breakdown" className="pr-pstats__anchor-note">
          <section className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Breakdown</h2>
            </div>
            <p className="pr-player-v2__empty">
              {slice.kpis.find((k) => k.key === "turnoversWon")?.value != null
                ? `Turnovers won ${dash(slice.kpis.find((k) => k.key === "turnoversWon")?.value ?? null, { digits: 0 })} in this ${period === "career" ? "career sample" : "season"}. Detailed ruck-arrival splits are not stored as a separate breakdown feed.`
                : "Insufficient data for a dedicated breakdown split."}
            </p>
          </section>
        </div>

        <div id="pstats-discipline">
          <DisciplineCard
            yellow={stats.summaryTable.find((r) => r.key === "yellowCards")?.[period === "career" ? "career" : "season"] ?? null}
            red={stats.summaryTable.find((r) => r.key === "redCards")?.[period === "career" ? "career" : "season"] ?? null}
          />
        </div>

        <section className="pr-player-v2__card pr-pstats__log-card" id="pstats-game-log">
          <div className="pr-player-v2__card-head">
            <h2>
              Game Log
              <span className="pr-pstats__log-season">
                {logSeasonSlug === GAME_LOG_CAREER_SLUG
                  ? " (Career)"
                  : ` (Season ${displaySeasonSlash(logSeasonLabel)})`}
              </span>
            </h2>
            <div className="pr-pstats__log-head-actions">
              <CoverageInfo coverage={stats.coverage} />
              <GameLogSeasonSelect
                seasonSlug={logSeasonSlug}
                options={logSeasonOptions}
                onChange={onLogSeasonChange}
              />
            </div>
          </div>
          {logRows.length === 0 ? (
            <p className="pr-player-v2__empty">No recorded appearances for this season.</p>
          ) : (
            <>
              <GameLogTable
                rows={logPagedRows}
                showTeamColumn={showTeamColumn}
                sticky
              />
              {logHasMore ? (
                <div className="pr-pstats__log-more">
                  <button
                    type="button"
                    className="pr-pstats__full-log"
                    onClick={() => setLogVisibleCount((n) => n + GAME_LOG_PAGE_SIZE)}
                  >
                    Load more ({logRows.length - logVisibleCount} remaining)
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <SeasonAveragesFooter
          label={period === "career" ? "Career averages" : `Season averages (${stats.selectedSeasonLabel})`}
          items={slice.averages}
          rating={slice.ratingAverage}
          updatedIso={slice.lastUpdatedIso}
        />
      </div>
    </article>
  );
}

function displaySeasonSlash(label: string): string {
  return label.replace(/–/g, "/");
}

function periodSubtitle(period: PlayerStatsPeriod, seasonLabel: string): string {
  return period === "career" ? "(Career)" : `(Season ${displaySeasonSlash(seasonLabel)})`;
}

function ratingBandLabel(band: GameLogRatingBand | null): string | null {
  switch (band) {
    case "exceptional":
      return "Exceptional";
    case "outstanding":
      return "Excellent";
    case "very_good":
      return "Good";
    case "solid":
      return "Average";
    case "below_average":
      return "Below average";
    case "poor":
      return "Poor";
    default:
      return null;
  }
}

function venueTitle(venue: GameLogRow["venue"]): string | undefined {
  if (venue === "H") return "Home";
  if (venue === "A") return "Away";
  if (venue === "N") return "Neutral Venue";
  return undefined;
}

function gameRatingTooltip(row: GameLogRow): string {
  if (row.rating == null) return "Game rating unavailable";
  const lines = [
    "GAME RATING",
    `${dash(row.rating, { digits: 1 })} / 10`,
  ];
  const band = ratingBandLabel(row.ratingBand);
  if (band) lines.push("", band);
  if (row.ratingBreakdown) {
    const bits: string[] = [];
    if (row.ratingBreakdown.attack != null) {
      bits.push(`Attack ${dash(row.ratingBreakdown.attack, { digits: 1 })}`);
    }
    if (row.ratingBreakdown.defence != null) {
      bits.push(`Defence ${dash(row.ratingBreakdown.defence, { digits: 1 })}`);
    }
    if (bits.length) lines.push("", ...bits);
  } else {
    lines.push("", "Rugby365 Game Rating");
  }
  return lines.join("\n");
}

function GameLogSeasonSelect({
  seasonSlug,
  options,
  onChange,
}: {
  seasonSlug: string;
  options: PlayerStatsV2Dto["availableSeasons"];
  onChange: (slug: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <label className="pr-player-v2__widget-select">
      <span className="sr-only">Game log season</span>
      <select value={seasonSlug} onChange={(e) => onChange(e.target.value)}>
        <option value={GAME_LOG_CAREER_SLUG}>Career</option>
        {options.map((season) => (
          <option key={season.slug} value={season.slug}>
            {displaySeasonSlash(season.label)}
          </option>
        ))}
      </select>
    </label>
  );
}

function coverageInfoText(coverage: PlayerStatsCoverage): string {
  return [
    `${coverage.eligibleAppearances} eligible appearances`,
    `${coverage.performanceRows} with detailed stats`,
    `${coverage.ratedAppearances} with match ratings`,
    `${coverage.minutesKnown} with minutes known`,
    ...coverage.notes,
  ].join("\n");
}

function CoverageInfo({ coverage }: { coverage: PlayerStatsCoverage }) {
  return (
    <button
      type="button"
      className="pr-pstats__coverage-info"
      title={coverageInfoText(coverage)}
      aria-label="Game log data coverage"
    >
      ⓘ
    </button>
  );
}

function GameLogPreviewCard({
  rows,
  seasonLabel,
  seasonSlug,
  seasonOptions,
  showTeamColumn,
  coverage,
  onSeasonChange,
  onViewFull,
}: {
  rows: GameLogRow[];
  seasonLabel: string;
  seasonSlug: string;
  seasonOptions: PlayerStatsV2Dto["availableSeasons"];
  showTeamColumn: boolean;
  coverage: PlayerStatsCoverage;
  onSeasonChange: (slug: string) => void;
  onViewFull: () => void;
}) {
  if (seasonOptions.length === 0 && rows.length === 0) return null;

  const titleSuffix =
    seasonSlug === GAME_LOG_CAREER_SLUG
      ? " (Career)"
      : ` (Season ${displaySeasonSlash(seasonLabel)})`;

  return (
    <section className="pr-player-v2__card pr-pstats__log-preview">
      <div className="pr-player-v2__card-head">
        <h2>
          Game Log
          <span className="pr-pstats__log-season">{titleSuffix}</span>
        </h2>
        <div className="pr-pstats__log-head-actions">
          <CoverageInfo coverage={coverage} />
          <GameLogSeasonSelect
            seasonSlug={seasonSlug}
            options={seasonOptions}
            onChange={onSeasonChange}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="pr-player-v2__empty">No recorded appearances for this season.</p>
      ) : (
        <>
          <GameLogTable rows={rows} showTeamColumn={showTeamColumn} compact />
          <div className="pr-pstats__log-more">
            <button type="button" className="pr-pstats__full-log" onClick={onViewFull}>
              View full game log
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function GameLogTable({
  rows,
  showTeamColumn,
  sticky = false,
  compact = false,
}: {
  rows: GameLogRow[];
  showTeamColumn: boolean;
  sticky?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();

  return (
    <div
      className={`pr-player-v2__table-wrap pr-pstats__log-wrap${sticky ? " is-sticky-cols" : ""}${compact ? " is-compact" : ""}`}
    >
      <table className="pr-player-v2__table pr-pstats__log">
        <thead>
          <tr>
            <th scope="col" className="pr-pstats__log-sticky-date">
              Date
            </th>
            {showTeamColumn ? <th scope="col">Team</th> : null}
            <th scope="col">Competition</th>
            <th scope="col" className="pr-pstats__log-sticky-opponent">
              Opponent
            </th>
            <th scope="col">Venue</th>
            <th scope="col">Result</th>
            <th scope="col">Min</th>
            <th scope="col">Pts</th>
            <th scope="col">Tries</th>
            <th scope="col">Conv</th>
            <th scope="col">Pen</th>
            <th scope="col">DG</th>
            <th scope="col">Tackle Breaks</th>
            <th scope="col">Metres</th>
            <th scope="col">Offloads</th>
            <th scope="col">Turnovers Won</th>
            <th scope="col">Game Rating</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <GameLogRowView
              key={row.fixtureId}
              row={row}
              showTeamColumn={showTeamColumn}
              onNavigate={(href) => router.push(href)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GameLogRowView({
  row,
  showTeamColumn,
  onNavigate,
}: {
  row: GameLogRow;
  showTeamColumn: boolean;
  onNavigate: (href: string) => void;
}) {
  const resultClass =
    row.result === "W" ? "is-win" : row.result === "L" ? "is-loss" : row.result === "D" ? "is-draw" : "";
  const ratingTitle = gameRatingTooltip(row);
  const competitionLabel =
    shortCompetitionLabel(row.competitionName) || row.competitionName || "—";

  const stopNav = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <tr
      className={row.href ? "pr-pstats__log-row is-clickable" : "pr-pstats__log-row"}
      onClick={() => {
        if (row.href) onNavigate(row.href);
      }}
      tabIndex={row.href ? 0 : undefined}
      onKeyDown={(e) => {
        if (row.href && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onNavigate(row.href);
        }
      }}
      role={row.href ? "link" : undefined}
    >
      <td className="pr-pstats__log-sticky-date">{formatDate(row.kickoffAt)}</td>
      {showTeamColumn ? (
        <td className="pr-pstats__log-team" onClick={stopNav}>
          {row.teamHref ? (
            <Link href={row.teamHref}>{row.teamName ?? "—"}</Link>
          ) : (
            (row.teamName ?? "—")
          )}
        </td>
      ) : null}
      <td className="pr-pstats__log-comp" onClick={stopNav} title={row.competitionName ?? undefined}>
        {row.competitionHref ? (
          <Link href={row.competitionHref}>{competitionLabel}</Link>
        ) : (
          competitionLabel
        )}
      </td>
      <td className="pr-pstats__log-sticky-opponent pr-pstats__log-opp" onClick={stopNav}>
        {row.opponentHref ? (
          <Link href={row.opponentHref}>{row.opponentName ?? "—"}</Link>
        ) : (
          (row.opponentName ?? "—")
        )}
      </td>
      <td title={venueTitle(row.venue)}>{row.venue ?? "—"}</td>
      <td>
        <span className={`pr-pstats__result ${resultClass}`}>
          <em>{row.result ?? "—"}</em>
          {row.result && row.scoreFor != null && row.scoreAgainst != null
            ? ` ${row.scoreFor} - ${row.scoreAgainst}`
            : null}
        </span>
      </td>
      <td>{dash(row.minutes, { digits: 0 })}</td>
      <td>{dash(row.points, { digits: 0 })}</td>
      <td>{dash(row.tries, { digits: 0 })}</td>
      <td>{formatKickStat(row.conversions, row.conversionAttempts)}</td>
      <td>{formatKickStat(row.penalties, row.penaltyAttempts)}</td>
      <td>{dash(row.dropGoals, { digits: 0 })}</td>
      <td>{dash(row.tackleBreaks, { digits: 0 })}</td>
      <td>{dash(row.metres, { digits: 0 })}</td>
      <td>{dash(row.offloads, { digits: 0 })}</td>
      <td>{dash(row.turnoversWon, { digits: 0 })}</td>
      <td>
        {row.rating != null ? (
          <span className="pr-pstats__log-rating" title={ratingTitle}>
            {dash(row.rating, { digits: 1 })}
          </span>
        ) : (
          <span className="pr-pstats__log-rating is-empty" title="Game rating unavailable">
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function PointsDoughnutCard({ breakdown }: { breakdown: PointsBreakdown }) {
  const total = breakdown.storedPoints;
  const segs = breakdown.segments.filter((s) => s.points != null && s.points > 0);
  const sum = segs.reduce((n, s) => n + (s.points ?? 0), 0);
  let acc = 0;
  const circles = segs.map((s) => {
    const pct = sum > 0 ? (s.points as number) / sum : 0;
    const dashArray = `${pct * 100} ${100 - pct * 100}`;
    const offset = 25 - acc * 100;
    acc += pct;
    return { ...s, dashArray, offset };
  });

  return (
    <section className="pr-player-v2__card">
      <div className="pr-player-v2__card-head">
        <h2>Points Breakdown</h2>
      </div>
      {total == null ? (
        <p className="pr-player-v2__empty">No points recorded in this filter.</p>
      ) : (
        <div className="pr-pstats__doughnut">
          <svg viewBox="0 0 42 42" aria-hidden>
            <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            {circles.map((s) => (
              <circle
                key={s.key}
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke={DOUGHNUT_COLORS[s.key]}
                strokeWidth="8"
                strokeDasharray={s.dashArray}
                strokeDashoffset={s.offset}
                pathLength={100}
              />
            ))}
          </svg>
          <div className="pr-pstats__doughnut-label">
            <strong>{dash(total, { digits: 0 })}</strong>
            <span>Total points</span>
          </div>
        </div>
      )}
      <ul className="pr-pstats__legend">
        {breakdown.segments.map((s) => (
          <li key={s.key}>
            <i style={{ background: DOUGHNUT_COLORS[s.key] }} />
            <span>{s.label}</span>
            <em>
              {dash(s.count, { digits: 0 })}
              {s.percent != null ? ` · ${dash(s.percent, { digits: 0, percent: true })}` : ""}
            </em>
          </li>
        ))}
      </ul>
      {breakdown.mismatch ? (
        <p className="pr-pstats__flag">
          Stored points ({dash(breakdown.storedPoints, { digits: 0 })}) differ from scoring formula (
          {dash(breakdown.computedPoints, { digits: 0 })}).
        </p>
      ) : null}
    </section>
  );
}

function Per80Card({ comparison }: { comparison: Per80Comparison }) {
  const max = useMemo(() => {
    const nums = comparison.rows.flatMap((r) => [r.player, r.cohort]).filter((n): n is number => n != null);
    return Math.max(1, ...nums);
  }, [comparison.rows]);

  return (
    <section className="pr-player-v2__card">
      <div className="pr-player-v2__card-head">
        <h2>Stats Per 80 Minutes</h2>
      </div>
      <p className="pr-pstats__cohort">{comparison.cohortLabel}</p>
      {comparison.cohortSource === "insufficient" ? (
        <p className="pr-player-v2__empty">Insufficient peer sample for a position average.</p>
      ) : null}
      <ul className="pr-pstats__bars">
        {comparison.rows.map((row) => {
          const playerPct = row.player != null ? Math.min(100, (row.player / max) * 100) : 0;
          const cohortPct = row.cohort != null ? Math.min(100, (row.cohort / max) * 100) : null;
          return (
            <li key={row.key}>
              <div className="pr-pstats__bar-meta">
                <span>{row.label}</span>
                <strong>
                  {dash(row.player, { digits: row.isPercent ? 0 : 1, percent: row.isPercent })}
                </strong>
              </div>
              <div className="pr-pstats__bar-stack">
                <div className="pr-pstats__bar-track">
                  {row.player != null ? (
                    <div className="pr-pstats__bar-fill" style={{ width: `${playerPct}%` }} />
                  ) : (
                    <div className="pr-pstats__bar-empty">—</div>
                  )}
                </div>
                <div className="pr-pstats__bar-track">
                  {cohortPct != null ? (
                    <div
                      className="pr-pstats__bar-fill pr-pstats__bar-fill--cohort"
                      style={{ width: `${cohortPct}%` }}
                      title={comparison.cohortLabel}
                    />
                  ) : (
                    <div className="pr-pstats__bar-empty">—</div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="pr-pstats__key">
        <span className="is-player">Player</span>
        <span className="is-cohort">{comparison.cohortLabel}</span>
      </p>
    </section>
  );
}

function ContributionCard({
  rings,
  period,
  seasonLabel,
}: {
  rings: ContributionRing[];
  period: PlayerStatsPeriod;
  seasonLabel: string;
}) {
  return (
    <section className="pr-player-v2__card pr-pstats__contrib-card">
      <div className="pr-player-v2__card-head">
        <h2>
          Attacking Contribution
          <span className="pr-pstats__card-sub">% of team total {periodSubtitle(period, seasonLabel)}</span>
        </h2>
      </div>
      <div className="pr-pstats__rings">
        {rings.map((ring) => (
          <ShareRing key={ring.key} ring={ring} />
        ))}
      </div>
    </section>
  );
}

function ShareRing({ ring }: { ring: ContributionRing }) {
  const size = 86;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = ring.percent;
  const offset = c * (1 - Math.max(0, Math.min(100, pct ?? 0)) / 100);
  return (
    <div className="pr-pstats__ring" title={pct == null ? "Insufficient data" : `${ring.label} ${pct}% of team`}>
      <div className="pr-pstats__ring-chart">
        <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
          {pct != null ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="var(--pv2-green, #22c55e)"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </svg>
        <strong className={pct == null ? "is-empty" : undefined}>
          {pct != null ? `${Math.round(pct)}%` : "—"}
        </strong>
      </div>
      <span>{ring.label}</span>
      {ring.player != null && ring.team != null ? (
        <em className="pr-pstats__ring-count">
          {ring.player} / {ring.team}
        </em>
      ) : null}
    </div>
  );
}

function spatialCoverageText(coverage: SpatialCoverageDto): string {
  if (coverage.method === "position") {
    return [
      "Method: POSITION-BASED (not spatial coordinates)",
      `${coverage.totalEvents} passes · ${coverage.matchesUsed} matches used`,
      "Zones estimated from playing position until pass coordinates are available.",
      coverage.sources.length ? `Sources: ${coverage.sources.join(", ")}` : null,
      ...coverage.notes.filter(
        (note) =>
          !note.startsWith("Method:") &&
          !note.startsWith("Zones estimated") &&
          !note.includes("matches used"),
      ),
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `${coverage.eventsWithCoords} events with coordinates`,
    coverage.coveragePct != null ? `${coverage.coveragePct}% coverage` : null,
    `${coverage.matchesWithCoords}/${coverage.matchesInScope} matches`,
    coverage.sources.length ? `Sources: ${coverage.sources.join(", ")}` : null,
    ...coverage.notes,
  ]
    .filter(Boolean)
    .join("\n");
}

function SpatialSeasonSelect({
  seasonSlug,
  availableSeasons,
  onSeasonChange,
}: {
  seasonSlug: string;
  seasonLabel: string;
  availableSeasons: PlayerStatsV2Dto["availableSeasons"];
  onSeasonChange: (slug: string) => void;
}) {
  const options = availableSeasons.filter((s) => s.appearances > 0);
  if (options.length <= 1) return null;
  return (
    <label className="pr-player-v2__widget-select pr-pstats__spatial-select">
      <span className="sr-only">Season filter</span>
      <select value={seasonSlug} onChange={(e) => onSeasonChange(e.target.value)}>
        {options.map((season) => (
          <option key={season.slug} value={season.slug}>
            {season.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PassingZonesCard({
  zones,
  seasonLabel,
  seasonSlug,
  availableSeasons,
  onSeasonChange,
}: {
  zones: PassingZones;
  seasonLabel: string;
  seasonSlug: string;
  availableSeasons: PlayerStatsV2Dto["availableSeasons"];
  onSeasonChange: (slug: string) => void;
}) {
  return (
    <section className="pr-player-v2__card pr-pstats__spatial-card">
      <div className="pr-player-v2__card-head pr-pstats__spatial-head">
        <h2>
          Passing Zones
          <span className="pr-pstats__card-sub">(Season {displaySeasonSlash(seasonLabel)})</span>
        </h2>
        <div className="pr-pstats__spatial-head-actions">
          <button
            type="button"
            className="pr-pstats__coverage-info"
            title={spatialCoverageText(zones.coverage)}
            aria-label="Passing zones data coverage"
          >
            ⓘ
          </button>
          <SpatialSeasonSelect
            seasonSlug={seasonSlug}
            seasonLabel={seasonLabel}
            availableSeasons={availableSeasons}
            onSeasonChange={onSeasonChange}
          />
        </div>
      </div>
      <R365PitchHeatmap
        mode="passing"
        cells={zones.cells}
        coverage={zones.coverage}
        emptyMessage={
          zones.message ?? "Spatial passing data not yet available for this player/period."
        }
      />
    </section>
  );
}

function KickingCard({
  kicking,
  period,
  seasonLabel,
}: {
  kicking: KickingAccuracy;
  period: PlayerStatsPeriod;
  seasonLabel: string;
}) {
  if (!kicking.applicable) {
    return (
      <section className="pr-player-v2__card pr-pstats__kick-acc" id="pstats-kicking-card">
        <div className="pr-player-v2__card-head pr-pstats__kick-acc-head">
          <h2>Kicking Accuracy</h2>
        </div>
        <p className="pr-pstats__unavailable">
          {kicking.message ?? "Goal-kicking accuracy is not applicable for this position."}
        </p>
      </section>
    );
  }

  return (
    <section className="pr-player-v2__card pr-pstats__kick-acc" id="pstats-kicking-card">
      <div className="pr-player-v2__card-head pr-pstats__kick-acc-head">
        <h2>
          Kicking Accuracy
          <span className="pr-pstats__card-sub">{periodSubtitle(period, seasonLabel)}</span>
        </h2>
        <button
          type="button"
          className="pr-pstats__coverage-info"
          title={kicking.coverageTooltip}
          aria-label="Kicking accuracy data coverage"
        >
          ⓘ
        </button>
      </div>
      <ul className="pr-pstats__acc">
        {kicking.rows.map((row) => {
          const hasAttempts = row.attempts != null && row.attempts > 0;
          const pct = hasAttempts ? row.displayPercent : null;
          const barWidth = pct != null ? Math.max(0, Math.min(100, pct)) : 0;
          return (
            <li key={row.key} title={row.tooltip ?? undefined}>
              <div className="pr-pstats__acc-row">
                <span className="pr-pstats__acc-label">{row.label}</span>
                <strong className={pct == null ? "is-empty" : row.provisional ? "is-provisional" : undefined}>
                  {pct == null ? "—" : `${pct}%`}
                  {row.provisional && pct != null ? <em title="Small sample">*</em> : null}
                </strong>
              </div>
              <div className="pr-pstats__acc-track" aria-hidden>
                {pct != null ? <div className="pr-pstats__acc-fill" style={{ width: `${barWidth}%` }} /> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="pr-pstats__acc-axis" aria-hidden>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </section>
  );
}

function defenceCoverageText(defence: DefensiveStats): string {
  const mc = defence.metricCoverage;
  return [
    `Tackles Made: ${mc.tacklesMade}/${defence.matchesInScope} matches`,
    `Missed Tackles: ${mc.missedTackles}/${defence.matchesInScope} matches`,
    `Dominant Tackles: ${mc.dominantTackles}/${defence.matchesInScope} matches (provider only)`,
    `Turnovers Won: ${mc.turnoversWon}/${defence.matchesInScope} matches (player)`,
    `Tackle sample (made+missed): ${defence.matchesWithTackleSample}/${defence.matchesInScope}${
      defence.coveragePct != null ? ` (${defence.coveragePct}%)` : ""
    }`,
    `${defence.matchesWithPerf} matches with performance rows`,
    defence.attempts != null ? `${defence.attempts} paired tackle attempts` : null,
    defence.message,
  ]
    .filter(Boolean)
    .join("\n");
}

function defenceGaugeTitle(defence: DefensiveStats): string {
  return [
    `Made ${dash(defence.tacklesMade, { digits: 0 })}`,
    `Missed ${dash(defence.missedTackles, { digits: 0 })}`,
    `Attempts ${dash(defence.attempts, { digits: 0 })}`,
    defence.tackleSuccessPct != null
      ? `${formatStatNumber(defence.tackleSuccessPct, { digits: 1, percent: true })}`
      : "Success —",
    `${defence.matchesInScope} matches`,
    defence.coveragePct != null
      ? `Coverage ${formatStatNumber(defence.coveragePct, { digits: 0, percent: true })} (${defence.matchesWithTackleSample}/${defence.matchesInScope})`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function DefenceCard({
  defence,
  period,
  seasonLabel,
  seasonSlug,
  availableSeasons,
  onSeasonChange,
}: {
  defence: DefensiveStats;
  period: PlayerStatsPeriod;
  seasonLabel: string;
  seasonSlug: string;
  availableSeasons: PlayerStatsV2Dto["availableSeasons"];
  onSeasonChange: (slug: string) => void;
}) {
  const pct = defence.tackleSuccessPct;
  const r = 42;
  const c = Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct ?? 0));
  const offset = c * (1 - clamped / 100);
  const seasonOptions = availableSeasons.filter((s) => s.appearances > 0);
  const showSeasonSelect = period === "season" && seasonOptions.length > 1;

  return (
    <section className="pr-player-v2__card pr-pstats__defence-card">
      <div className="pr-player-v2__card-head pr-pstats__spatial-head">
        <h2>
          Defensive Stats
          <span className="pr-pstats__card-sub">{periodSubtitle(period, seasonLabel)}</span>
        </h2>
        <div className="pr-pstats__spatial-head-actions">
          <button
            type="button"
            className="pr-pstats__coverage-info"
            title={defenceCoverageText(defence)}
            aria-label="Defensive stats data coverage"
          >
            ⓘ
          </button>
          {showSeasonSelect ? (
            <SpatialSeasonSelect
              seasonSlug={seasonSlug}
              seasonLabel={seasonLabel}
              availableSeasons={availableSeasons}
              onSeasonChange={onSeasonChange}
            />
          ) : null}
        </div>
      </div>
      <div className="pr-pstats__gauge" title={defenceGaugeTitle(defence)}>
        <svg viewBox="0 0 100 58" aria-hidden>
          <path
            d="M8 50 A42 42 0 0 1 92 50"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          {pct != null ? (
            <path
              d="M8 50 A42 42 0 0 1 92 50"
              fill="none"
              stroke="var(--pv2-green, #22c55e)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          ) : null}
        </svg>
        <div>
          <strong>{dash(pct, { digits: 0, percent: true })}</strong>
          <span>Tackle Success</span>
        </div>
      </div>
      <ul className="pr-pstats__def-list">
        <li>
          <span>Tackles Made</span>
          <strong>{dash(defence.tacklesMade, { digits: 0 })}</strong>
        </li>
        <li>
          <span>Missed Tackles</span>
          <strong>{dash(defence.missedTackles, { digits: 0 })}</strong>
        </li>
        <li>
          <span>Dominant Tackles</span>
          <strong>{dash(defence.dominantTackles, { digits: 0 })}</strong>
        </li>
        <li>
          <span>Turnovers Won</span>
          <strong>{dash(defence.turnoversWon, { digits: 0 })}</strong>
        </li>
      </ul>
      {defence.message ? <p className="pr-pstats__unavailable">{defence.message}</p> : null}
    </section>
  );
}

function DisciplineCard({ yellow, red }: { yellow: number | null; red: number | null }) {
  return (
    <section className="pr-player-v2__card">
      <div className="pr-player-v2__card-head">
        <h2>Discipline</h2>
      </div>
      <div className="pr-pstats__discipline">
        <div>
          <strong>{dash(yellow, { digits: 0 })}</strong>
          <span>Yellow cards</span>
        </div>
        <div>
          <strong>{dash(red, { digits: 0 })}</strong>
          <span>Red cards</span>
        </div>
      </div>
    </section>
  );
}

function SeasonAveragesFooter({
  label,
  items,
  rating,
  updatedIso,
}: {
  label: string;
  items: SeasonAverageItem[];
  rating: number | null;
  updatedIso: string | null;
}) {
  return (
    <footer className="pr-pstats__averages">
      <strong className="pr-pstats__averages-label">{label}</strong>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <span>{item.label}</span>
            <em>{dash(item.value, { digits: item.isPercent ? 0 : 1, percent: item.isPercent })}</em>
          </li>
        ))}
      </ul>
      <div className="pr-pstats__averages-rating" title="Average match rating">
        <span>★</span>
        <strong>{dash(rating, { digits: 1 })}</strong>
      </div>
      {updatedIso ? (
        <p className="pr-pstats__updated">Updated {formatDate(updatedIso)}</p>
      ) : null}
    </footer>
  );
}
