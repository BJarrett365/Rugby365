"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ANNOTATION_LABELS,
  annotationMarker,
  buildDevelopmentWrittenSummary,
  buildGappedLinePath,
  buildSeasonDevelopmentRows,
  detectMixedModelVersions,
  filterTimelinePoints,
  ratingDisplayLabel,
  resolveAppearanceStatus,
  rollingAverage,
  summarizeRatedPoints,
  type DevelopmentTimelineFilters,
  type DevelopmentTimelinePoint,
  DEFAULT_DEVELOPMENT_FILTERS,
} from "@/lib/player-development-timeline-utils";

export type DevelopmentChartSettings = {
  enabled?: boolean;
  showRollingAverage?: boolean;
  showSeasonAverage?: boolean;
  showCareerAverage?: boolean;
  minMinutes?: number;
  summaryOverride?: string | null;
};

function formatNum(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

export function PlayerDevelopmentTimeline({
  playerName,
  points,
  currentDomesticSlug,
  careerAverage = null,
  settings = {},
  compact = false,
  seasonLabel = null,
  basePath,
  initialSeason = "all",
}: {
  playerName: string;
  points: DevelopmentTimelinePoint[];
  currentDomesticSlug: string;
  careerAverage?: number | null;
  settings?: DevelopmentChartSettings;
  compact?: boolean;
  seasonLabel?: string | null;
  /** Current profile path without query, for filter links */
  basePath: string;
  initialSeason?: string;
}) {
  const enabled = settings.enabled !== false;
  const [showRolling, setShowRolling] = useState(settings.showRollingAverage !== false);
  const [showSeasonAvg, setShowSeasonAvg] = useState(settings.showSeasonAverage === true);
  const [showCareerAvg, setShowCareerAvg] = useState(settings.showCareerAverage === true);
  const [showAnnotations, setShowAnnotations] = useState(!compact);
  const [filters, setFilters] = useState<DevelopmentTimelineFilters>({
    ...DEFAULT_DEVELOPMENT_FILTERS,
    season: initialSeason ?? "all",
  });

  const filtered = useMemo(
    () =>
      filterTimelinePoints(points, filters, currentDomesticSlug, {
        minMinutes: settings.minMinutes ?? 0,
      }),
    [points, filters, currentDomesticSlug, settings.minMinutes],
  );

  const chronological = useMemo(
    () =>
      [...filtered].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [filtered],
  );

  const summary = summarizeRatedPoints(chronological);
  const seasonRows = buildSeasonDevelopmentRows(points);
  const mixedModels = detectMixedModelVersions(chronological);
  const written = buildDevelopmentWrittenSummary({
    playerName,
    points: chronological,
    override: settings.summaryOverride,
  });

  if (!enabled) {
    return <p className="pr-mc-transfers-muted">Development chart is disabled for this player.</p>;
  }

  if (compact) {
    const spark = chronological.filter((p) => p.rating != null).slice(-10);
    return (
      <div className="pr-dev-timeline pr-dev-timeline--compact" style={{ minHeight: 110 }}>
        <p className="pr-dev-timeline__cards">
          <span>Current {formatNum(summary.endRating)}</span>
          <span>{summary.trendLabel}</span>
        </p>
        <TimelineSvg
          points={spark}
          showRolling
          showSeasonAvg={false}
          showCareerAvg={false}
          careerAverage={null}
          seasonAverage={summary.average}
          showAnnotations={false}
          compact
          ariaSummary={written}
        />
        <p className="pr-player-footnote">
          <Link href={`${basePath}?tab=stats`}>Full development timeline</Link>
        </p>
      </div>
    );
  }

  const competitions = [
    ...new Set(points.map((p) => p.competitionSlug).filter(Boolean) as string[]),
  ];
  const teams = [...new Set(points.map((p) => p.teamName))];
  const positions = [
    ...new Set(points.map((p) => p.positionName).filter(Boolean) as string[]),
  ];
  const seasons = [
    ...new Set(points.map((p) => p.seasonSlug).filter(Boolean) as string[]),
  ].sort((a, b) => b.localeCompare(a));

  const careerMode = filters.season === "all";

  return (
    <section className="pr-dev-timeline" aria-labelledby="dev-timeline-heading">
      <h3 id="dev-timeline-heading">Player development timeline</h3>
      {seasonLabel ? <p className="pr-player-footnote">Selection: {seasonLabel}</p> : null}

      <div className="pr-dev-timeline__summary-cards" role="group" aria-label="Rating summary">
        <SummaryCard label="Season average" value={formatNum(summary.average)} />
        <SummaryCard label="Career average" value={formatNum(careerAverage)} />
        <SummaryCard label="Highest" value={formatNum(summary.highest)} />
        <SummaryCard label="Lowest" value={formatNum(summary.lowest)} />
        <SummaryCard label="Rated apps" value={String(summary.ratedAppearances || "—")} />
        <SummaryCard label="Trend" value={summary.trendLabel} />
        <SummaryCard label="5-match avg" value={formatNum(summary.fiveMatchAverage)} />
        <SummaryCard
          label="Best match"
          value={
            summary.bestMatch
              ? `${formatNum(summary.bestMatch.rating)} vs ${summary.bestMatch.opponentName ?? "—"}`
              : "—"
          }
        />
      </div>

      <div className="pr-dev-timeline__filters">
        <label>
          Season
          <select
            value={filters.season}
            onChange={(e) => setFilters((f) => ({ ...f, season: e.target.value }))}
          >
            <option value="current">Current season</option>
            <option value="all">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Competition
          <select
            value={filters.competition}
            onChange={(e) => setFilters((f) => ({ ...f, competition: e.target.value }))}
          >
            <option value="all">All competitions</option>
            {competitions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scope
          <select
            value={filters.scope}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                scope: e.target.value as DevelopmentTimelineFilters["scope"],
              }))
            }
          >
            <option value="all">All</option>
            <option value="domestic">Domestic only</option>
            <option value="international">International only</option>
          </select>
        </label>
        <label>
          Role
          <select
            value={filters.role}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                role: e.target.value as DevelopmentTimelineFilters["role"],
              }))
            }
          >
            <option value="all">All appearances</option>
            <option value="start">Starts only</option>
            <option value="bench">Bench only</option>
          </select>
        </label>
        <label>
          Venue
          <select
            value={filters.venue}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                venue: e.target.value as DevelopmentTimelineFilters["venue"],
              }))
            }
          >
            <option value="all">Home &amp; away</option>
            <option value="home">Home</option>
            <option value="away">Away</option>
          </select>
        </label>
        <label>
          Result
          <select
            value={filters.result}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                result: e.target.value as DevelopmentTimelineFilters["result"],
              }))
            }
          >
            <option value="all">All results</option>
            <option value="W">Wins</option>
            <option value="D">Draws</option>
            <option value="L">Losses</option>
          </select>
        </label>
        <label>
          Team
          <select
            value={filters.team}
            onChange={(e) => setFilters((f) => ({ ...f, team: e.target.value }))}
          >
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select
            value={filters.position}
            onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}
          >
            <option value="all">All positions</option>
            {positions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pr-dev-timeline__toggles" role="group" aria-label="Chart series">
        <label>
          <input
            type="checkbox"
            checked={showRolling}
            onChange={(e) => setShowRolling(e.target.checked)}
          />{" "}
          Five-match rolling average
        </label>
        <label>
          <input
            type="checkbox"
            checked={showSeasonAvg}
            onChange={(e) => setShowSeasonAvg(e.target.checked)}
          />{" "}
          Season average
        </label>
        <label>
          <input
            type="checkbox"
            checked={showCareerAvg}
            onChange={(e) => setShowCareerAvg(e.target.checked)}
          />{" "}
          Career average
        </label>
        <label>
          <input
            type="checkbox"
            checked={showAnnotations}
            onChange={(e) => setShowAnnotations(e.target.checked)}
          />{" "}
          Annotations
        </label>
      </div>

      {mixedModels ? (
        <p className="pr-dev-timeline__warning" role="status">
          This selection includes ratings from more than one model version. Trend lines may be less
          comparable until scores are recalculated on a common model.
        </p>
      ) : null}

      {careerMode && summary.ratedAppearances === 0 ? (
        <p className="pr-mc-transfers-muted">No rated appearances for these filters.</p>
      ) : careerMode ? (
        <div className="pr-player-table-wrap">
          <p className="pr-player-footnote">
            All-seasons view shows season averages first. Select a season above for match-by-match
            ratings.
          </p>
          <SeasonTable
            rows={seasonRows}
            onOpenSeason={(slug) => setFilters((f) => ({ ...f, season: slug }))}
          />
        </div>
      ) : (
        <TimelineSvg
          points={chronological}
          showRolling={showRolling}
          showSeasonAvg={showSeasonAvg}
          showCareerAvg={showCareerAvg}
          careerAverage={careerAverage}
          seasonAverage={summary.average}
          showAnnotations={showAnnotations}
          compact={false}
          ariaSummary={written}
        />
      )}

      <p className="pr-dev-timeline__written">{written}</p>

      {!careerMode ? (
        <>
          <h4>Accessible ratings table</h4>
          <div className="pr-player-table-wrap">
            <table className="pr-mc-transfers-table pr-player-table">
              <caption className="sr-only">Match ratings for the development timeline</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Team</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">Comp</th>
                  <th scope="col">Result</th>
                  <th scope="col">Role</th>
                  <th scope="col">Min</th>
                  <th scope="col">Rating</th>
                  <th scope="col">Δ</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...chronological].reverse().map((p) => (
                  <tr key={p.fixtureId}>
                    <td>
                      {p.fixtureSlug ? (
                        <Link href={`/matches/${p.fixtureSlug}`}>
                          {p.date?.slice(0, 10) ?? "Match"}
                        </Link>
                      ) : (
                        p.date?.slice(0, 10) ?? "—"
                      )}
                    </td>
                    <td>{p.teamName}</td>
                    <td>{p.opponentName ?? "—"}</td>
                    <td>{p.competitionName ?? "—"}</td>
                    <td>{p.resultLabel ?? "—"}</td>
                    <td>{p.started == null ? "—" : p.started ? "Start" : "Bench"}</td>
                    <td>{p.minutes ?? "—"}</td>
                    <td>
                      {ratingDisplayLabel(
                        p.rating,
                        p.appearanceStatus ??
                          resolveAppearanceStatus({
                            rating: p.rating,
                            minutes: p.minutes,
                            started: p.started,
                          }),
                      )}
                    </td>
                    <td>
                      {p.ratingChange == null
                        ? "—"
                        : p.ratingChange > 0
                          ? `+${formatNum(p.ratingChange)}`
                          : formatNum(p.ratingChange)}
                    </td>
                    <td>
                      {p.annotations
                        .map((a) => ANNOTATION_LABELS[a])
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {!careerMode && seasonRows.length > 0 ? (
        <>
          <h4>Season-by-season development</h4>
          <SeasonTable
            rows={seasonRows}
            onOpenSeason={(slug) => setFilters((f) => ({ ...f, season: slug }))}
          />
        </>
      ) : null}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <dl className="pr-dev-timeline__card">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </dl>
  );
}

function SeasonTable({
  rows,
  onOpenSeason,
}: {
  rows: ReturnType<typeof buildSeasonDevelopmentRows>;
  onOpenSeason: (slug: string) => void;
}) {
  return (
    <div className="pr-player-table-wrap">
      <table className="pr-mc-transfers-table pr-player-table">
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">Team</th>
            <th scope="col">Competitions</th>
            <th scope="col">Rated</th>
            <th scope="col">DNP</th>
            <th scope="col">Avg</th>
            <th scope="col">High</th>
            <th scope="col">Low</th>
            <th scope="col">End</th>
            <th scope="col">Δ prev</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.seasonSlug}>
              <td>
                <button
                  type="button"
                  className="pr-dev-timeline__season-link"
                  onClick={() => onOpenSeason(r.seasonSlug)}
                >
                  {r.seasonLabel}
                </button>
              </td>
              <td>{r.teamName}</td>
              <td>{r.competitions.join(", ") || "—"}</td>
              <td>{r.ratedAppearances || "—"}</td>
              <td>{r.dnpCount || "—"}</td>
              <td>{formatNum(r.average)}</td>
              <td>{formatNum(r.highest)}</td>
              <td>{formatNum(r.lowest)}</td>
              <td>{formatNum(r.endRating)}</td>
              <td>
                {r.changeFromPrevious == null
                  ? "—"
                  : r.changeFromPrevious > 0
                    ? `+${formatNum(r.changeFromPrevious)}`
                    : formatNum(r.changeFromPrevious)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineSvg({
  points,
  showRolling,
  showSeasonAvg,
  showCareerAvg,
  careerAverage,
  seasonAverage,
  showAnnotations,
  compact,
  ariaSummary,
}: {
  points: DevelopmentTimelinePoint[];
  showRolling: boolean;
  showSeasonAvg: boolean;
  showCareerAvg: boolean;
  careerAverage: number | null;
  seasonAverage: number | null;
  showAnnotations: boolean;
  compact: boolean;
  ariaSummary: string;
}) {
  const ratedValues = points.map((p) =>
    p.rating != null && Number.isFinite(p.rating) ? p.rating : null,
  );
  if (ratedValues.every((v) => v == null)) {
    return <p className="pr-mc-transfers-muted">No rated appearances to chart.</p>;
  }

  const width = compact ? 280 : 720;
  const height = compact ? 72 : 220;
  const pad = compact ? 12 : 28;
  const finite = ratedValues.filter((v): v is number => v != null);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, 0.5);
  const rolling = rollingAverage(ratedValues, 5);

  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);
    const rating = ratedValues[i];
    const y =
      rating == null
        ? height / 2
        : height - pad - ((rating - min) / span) * (height - pad * 2);
    return { x, y, rated: rating != null, p, rolling: rolling[i] };
  });

  const ratingPath = buildGappedLinePath(coords);
  const rollingPath = buildGappedLinePath(
    coords.map((c) => ({
      x: c.x,
      y:
        c.rolling == null
          ? 0
          : height - pad - ((c.rolling - min) / span) * (height - pad * 2),
      rated: c.rolling != null,
    })),
  );

  const yFor = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);

  return (
    <div className={`pr-dev-timeline__chart${compact ? " is-compact" : ""}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={compact ? 72 : 220}
        role="img"
        aria-label={ariaSummary}
        className="pr-dev-timeline__svg"
      >
        {showSeasonAvg && seasonAverage != null ? (
          <line
            x1={pad}
            x2={width - pad}
            y1={yFor(seasonAverage)}
            y2={yFor(seasonAverage)}
            className="pr-dev-timeline__ref pr-dev-timeline__ref--season"
          />
        ) : null}
        {showCareerAvg && careerAverage != null ? (
          <line
            x1={pad}
            x2={width - pad}
            y1={yFor(careerAverage)}
            y2={yFor(careerAverage)}
            className="pr-dev-timeline__ref pr-dev-timeline__ref--career"
          />
        ) : null}
        {showRolling ? (
          <path d={rollingPath} className="pr-dev-timeline__rolling" fill="none" />
        ) : null}
        <path d={ratingPath} className="pr-dev-timeline__rating" fill="none" />
        {coords.map((c, i) => {
          if (!c.rated) {
            return (
              <circle
                key={c.p.fixtureId}
                cx={c.x}
                cy={height - pad}
                r={2}
                className="pr-dev-timeline__unrated"
              >
                <title>Unrated appearance</title>
              </circle>
            );
          }
          const marker = showAnnotations ? annotationMarker(c.p.annotations) : "";
          return (
            <g key={c.p.fixtureId}>
              <a
                href={c.p.fixtureSlug ? `/matches/${c.p.fixtureSlug}` : undefined}
                {...(c.p.fixtureSlug ? {} : { "aria-disabled": true })}
              >
                <circle cx={c.x} cy={c.y} r={compact ? 2.5 : 4} className="pr-dev-timeline__point">
                  <title>
                    {[
                      c.p.date?.slice(0, 10),
                      c.p.teamName,
                      `vs ${c.p.opponentName ?? "—"}`,
                      c.p.competitionName,
                      c.p.resultLabel,
                      `Rating ${c.p.rating?.toFixed(1)}`,
                      c.p.annotations.map((a) => ANNOTATION_LABELS[a]).join(", "),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </title>
                </circle>
              </a>
              {marker ? (
                <text
                  x={c.x}
                  y={c.y - 8}
                  textAnchor="middle"
                  className="pr-dev-timeline__marker"
                  aria-label={c.p.annotations.map((a) => ANNOTATION_LABELS[a]).join(", ")}
                >
                  {marker}
                </text>
              ) : null}
              {!compact && i === 0 ? (
                <text x={c.x} y={height - 4} textAnchor="start" className="pr-dev-timeline__axis-label">
                  {c.p.date?.slice(0, 10) ?? ""}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
