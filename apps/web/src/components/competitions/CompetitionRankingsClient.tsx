"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FormBlocks,
  MovementCell,
  PerformanceValue,
  PlayerRankingsColgroup,
  RankNumber,
  RankingsAvatar,
  RankingsBoardFooter,
  RankingsCrest,
  RankingsFilterSelect,
  RankingsFlag,
  RankingClubCell,
  RankingStatusBadge,
  RatingValue,
  SeasonCalendarIcon,
} from "@/components/rankings/RankingsBoardPrimitives";
import type {
  CompetitionCoachRankingRow,
  CompetitionPlayerRankingRow,
  CompetitionRankingsPayload,
  CompetitionRefereeRankingRow,
  CompetitionTeamRankingRow,
} from "@/lib/competition-rankings-service";
import { RANKING_POSITION_LABELS, rankingSeasonQueryValue, type RankingPositionGroup } from "@/lib/competition-ranking-math";
import {
  buildPlayerRankingsTitle,
  COMPETITION_RANKING_TOP_OPTIONS,
  COMPETITION_STAFF_RANKING_ALL,
  COMPETITION_STAFF_RANKING_TOP_OPTIONS,
  normalizeCompetitionRankingTop,
  normalizeCompetitionStaffRankingTop,
  parseLastFiveFormBlocks,
} from "@/lib/player-ranking-engine";
import { returnedSeasonMatchesRequest } from "@/lib/season-label-utils";

type Tab = "players" | "teams" | "referees" | "coaches";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "players", label: "Players" },
  { id: "teams", label: "Teams" },
  { id: "referees", label: "Referees" },
  { id: "coaches", label: "Coaches" },
];

const POSITION_FILTERS: Array<{ key: RankingPositionGroup | ""; label: string }> = [
  { key: "", label: "All positions" },
  { key: "props", label: RANKING_POSITION_LABELS.props },
  { key: "hookers", label: RANKING_POSITION_LABELS.hookers },
  { key: "locks", label: RANKING_POSITION_LABELS.locks },
  { key: "back_row", label: RANKING_POSITION_LABELS.back_row },
  { key: "scrum_halves", label: RANKING_POSITION_LABELS.scrum_halves },
  { key: "fly_halves", label: RANKING_POSITION_LABELS.fly_halves },
  { key: "centres", label: RANKING_POSITION_LABELS.centres },
  { key: "wings", label: RANKING_POSITION_LABELS.wings },
  { key: "full_backs", label: RANKING_POSITION_LABELS.full_backs },
];

function trendToMovement(trend: string): "up" | "down" | "flat" | null {
  if (trend === "up") return "up";
  if (trend === "down") return "down";
  if (trend === "flat") return "flat";
  return null;
}

function PlayerTable({ rows }: { rows: CompetitionPlayerRankingRow[] }) {
  if (!rows.length) {
    return (
      <section className="pr-rankings__empty">
        <p className="pr-rankings__empty-kicker">RANKINGS BUILDING</p>
        <p className="pr-rankings__empty-body">
          No rated player appearances for this season yet.
        </p>
      </section>
    );
  }

  return (
    <div className="pr-rankings__table-wrap">
      <table className="pr-rankings__table">
        <PlayerRankingsColgroup />
        <thead>
          <tr>
            <th className="is-num is-rank">Rank</th>
            <th>Player</th>
            <th>Club</th>
            <th>Country</th>
            <th className="is-num">R365 Rating /100</th>
            <th className="is-form">Current Form (Last 5)</th>
            <th className="is-num">International Performance</th>
            <th className="is-num">Club Performance</th>
            <th className="is-num">Position Performance</th>
            <th className="is-move">Movement (vs last week)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => {
            const formBlocks = parseLastFiveFormBlocks(entry.recentRatings, {
              padTo: 5,
              formScore: entry.avgRating || entry.bestRating || 70,
            });
            const clubName = entry.clubName;
            const countryName = entry.nationName;
            return (
              <tr key={`${entry.positionGroup}-${entry.playerId}`}>
                <td className="is-num">
                  <RankNumber rank={entry.rank} provisional={entry.provisional} />
                </td>
                <td>
                  <Link href={`/players/${entry.playerSlug}`} className="pr-rankings__player">
                    <RankingsAvatar src={entry.playerImageUrl} name={entry.playerName} />
                    <span className="pr-rankings__player-name">{entry.playerName}</span>
                    <RankingStatusBadge provisional={entry.provisional} retired={entry.retired} />
                  </Link>
                </td>
                <td>
                  {clubName ? (
                    entry.clubSlug ? (
                      <Link href={`/teams/${entry.clubSlug}`} className="pr-rankings__entity">
                        <RankingsCrest src={entry.clubImageUrl} name={clubName} />
                        <span>{clubName}</span>
                      </Link>
                    ) : (
                      <span className="pr-rankings__entity">
                        <RankingsCrest src={entry.clubImageUrl} name={clubName} />
                        <span>{clubName}</span>
                      </span>
                    )
                  ) : (
                    <span className="pr-rankings__dash">—</span>
                  )}
                </td>
                <td>
                  {countryName ? (
                    entry.nationSlug ? (
                      <Link href={`/teams/${entry.nationSlug}`} className="pr-rankings__entity">
                        <RankingsFlag src={entry.nationImageUrl} name={countryName} />
                        <span>{countryName}</span>
                      </Link>
                    ) : (
                      <span className="pr-rankings__entity">
                        <RankingsFlag src={entry.nationImageUrl} name={countryName} />
                        <span>{countryName}</span>
                      </span>
                    )
                  ) : (
                    <span className="pr-rankings__dash">—</span>
                  )}
                </td>
                <td className="is-num">
                  <RatingValue value={entry.avgRating} />
                </td>
                <td className="is-form">
                  <FormBlocks blocks={formBlocks} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={entry.internationalPerformance} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={entry.clubPerformance} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={entry.positionPerformance} />
                </td>
                <td className="is-move">
                  <MovementCell
                    rank={entry.rank}
                    movement={trendToMovement(entry.trend)}
                    previousRank={entry.previousRank}
                    retired={entry.retired}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TeamsTable({ rows }: { rows: CompetitionTeamRankingRow[] }) {
  if (!rows.length) {
    return (
      <section className="pr-rankings__empty">
        <p className="pr-rankings__empty-kicker">RANKINGS BUILDING</p>
        <p className="pr-rankings__empty-body">No finished matches for a team ranking yet.</p>
      </section>
    );
  }
  return (
    <div className="pr-rankings__table-wrap">
      <table className="pr-rankings__table pr-rankings__table--teams">
        <colgroup>
          <col className="pr-rankings__col pr-rankings__col--rank" />
          <col className="pr-rankings__col pr-rankings__col--team" />
          <col className="pr-rankings__col pr-rankings__col--country" />
          <col className="pr-rankings__col pr-rankings__col--stat" />
          <col className="pr-rankings__col pr-rankings__col--stat" />
          <col className="pr-rankings__col pr-rankings__col--stat" />
          <col className="pr-rankings__col pr-rankings__col--stat" />
          <col className="pr-rankings__col pr-rankings__col--stat" />
          <col className="pr-rankings__col pr-rankings__col--stat" />
        </colgroup>
        <thead>
          <tr>
            <th className="is-num is-rank">Rank</th>
            <th>Team</th>
            <th title="Country of origin">COO</th>
            <th className="is-num">P</th>
            <th className="is-num">W</th>
            <th className="is-num">D</th>
            <th className="is-num">L</th>
            <th className="is-num">PD</th>
            <th className="is-num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const countryName = row.countryName ?? row.teamName;
            const pdClass =
              row.pointsDiff > 0 ? " is-pos" : row.pointsDiff < 0 ? " is-neg" : "";
            return (
              <tr key={row.teamId}>
                <td className="is-num">
                  <RankNumber rank={row.rank} />
                </td>
                <td>
                  <Link href={`/teams/${row.teamSlug}`} className="pr-rankings__team">
                    <RankingsCrest src={row.teamImageUrl} name={row.teamName} />
                    <span className="pr-rankings__team-copy">
                      <span className="pr-rankings__team-name">{row.teamName}</span>
                      {row.teamNickname ? (
                        <span className="pr-rankings__team-nick">{row.teamNickname}</span>
                      ) : null}
                    </span>
                  </Link>
                </td>
                <td>
                  {countryName ? (
                    <span className="pr-rankings__entity">
                      <RankingsFlag src={row.nationImageUrl} name={countryName} />
                      <span>{countryName}</span>
                    </span>
                  ) : (
                    <span className="pr-rankings__dash">—</span>
                  )}
                </td>
                <td className="pr-rankings__num is-num">{row.played}</td>
                <td className="pr-rankings__num is-num">{row.won}</td>
                <td className="pr-rankings__num is-num">{row.draw}</td>
                <td className="pr-rankings__num is-num">{row.lost}</td>
                <td className={`pr-rankings__pd is-num${pdClass}`}>
                  {row.pointsDiff > 0 ? `+${row.pointsDiff}` : row.pointsDiff}
                </td>
                <td className="pr-rankings__pts is-num">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RefereesTable({ rows }: { rows: CompetitionRefereeRankingRow[] }) {
  if (!rows.length) {
    return (
      <section className="pr-rankings__empty">
        <p className="pr-rankings__empty-kicker">RANKINGS BUILDING</p>
        <p className="pr-rankings__empty-body">
          No referee match ratings for this season yet. Ratings appear after full-time calculation.
        </p>
      </section>
    );
  }
  return (
    <div className="pr-rankings__table-wrap">
      <table className="pr-rankings__table">
        <PlayerRankingsColgroup />
        <thead>
          <tr>
            <th className="is-num is-rank">Rank</th>
            <th>Referee</th>
            <th>Club</th>
            <th>Country</th>
            <th className="is-num">R365 Rating /100</th>
            <th className="is-form">Current Form (Last 5)</th>
            <th className="is-num">Tournament Performance</th>
            <th className="is-num">Match Performance</th>
            <th className="is-num">Peak Performance</th>
            <th className="is-move">Movement (vs last week)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const formBlocks = parseLastFiveFormBlocks(row.recentRatings, {
              padTo: 5,
              formScore: row.recentRatings[0] ?? row.avgRating,
            });
            const countryName = row.nationName;
            return (
              <tr key={row.refereeId}>
                <td className="is-num">
                  <RankNumber rank={row.rank} provisional={row.provisional} />
                </td>
                <td>
                  <Link href={`/referees/${row.refereeSlug}`} className="pr-rankings__player">
                    <RankingsAvatar src={row.refereeImageUrl} name={row.refereeName} />
                    <span className="pr-rankings__player-name">{row.refereeName}</span>
                    <RankingStatusBadge provisional={row.provisional} retired={row.retired} />
                  </Link>
                </td>
                <td>
                  <RankingClubCell
                    clubName={row.clubName}
                    clubSlug={row.clubSlug}
                    clubImageUrl={row.clubImageUrl}
                    otherClubs={row.otherClubs}
                  />
                </td>
                <td>
                  {countryName ? (
                    row.nationSlug ? (
                      <Link href={`/teams/${row.nationSlug}`} className="pr-rankings__entity">
                        <RankingsFlag src={row.nationImageUrl} name={countryName} />
                        <span>{countryName}</span>
                      </Link>
                    ) : (
                      <span className="pr-rankings__entity">
                        <RankingsFlag src={row.nationImageUrl} name={countryName} />
                        <span>{countryName}</span>
                      </span>
                    )
                  ) : (
                    <span className="pr-rankings__dash">—</span>
                  )}
                </td>
                <td className="is-num">
                  <RatingValue value={row.avgRating} />
                </td>
                <td className="is-form">
                  <FormBlocks blocks={formBlocks} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={row.tournamentPerformance} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={row.matchPerformance} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={row.peakPerformance} />
                </td>
                <td className="is-move">
                  <MovementCell
                    rank={row.rank}
                    movement={trendToMovement(row.trend)}
                    previousRank={row.previousRank}
                    retired={row.retired}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CoachesTable({ rows }: { rows: CompetitionCoachRankingRow[] }) {
  if (!rows.length) {
    return (
      <section className="pr-rankings__empty">
        <p className="pr-rankings__empty-kicker">RANKINGS BUILDING</p>
        <p className="pr-rankings__empty-body">
          No coach match ratings for this season yet. Ratings appear after full-time calculation.
        </p>
      </section>
    );
  }
  return (
    <div className="pr-rankings__table-wrap">
      <table className="pr-rankings__table">
        <PlayerRankingsColgroup />
        <thead>
          <tr>
            <th className="is-num is-rank">Rank</th>
            <th>Coach</th>
            <th>Team</th>
            <th>Country</th>
            <th className="is-num">R365 Rating /100</th>
            <th className="is-form">Current Form (Last 5)</th>
            <th className="is-num">Tournament Performance</th>
            <th className="is-num">Team Performance</th>
            <th className="is-num">Match Performance</th>
            <th className="is-move">Movement (vs last week)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const formBlocks = parseLastFiveFormBlocks(row.recentRatings, {
              padTo: 5,
              formScore: row.avgRating || row.bestRating || 70,
            });
            const teamName = row.teamName;
            const countryName = row.nationName;
            return (
              <tr key={row.coachId}>
                <td className="is-num">
                  <RankNumber rank={row.rank} provisional={row.provisional} />
                </td>
                <td>
                  <Link href={`/coaches/${row.coachSlug}`} className="pr-rankings__player">
                    <RankingsAvatar src={row.coachImageUrl} name={row.coachName} />
                    <span className="pr-rankings__player-name">{row.coachName}</span>
                    <RankingStatusBadge provisional={row.provisional} retired={row.retired} />
                  </Link>
                </td>
                <td>
                  {teamName ? (
                    row.teamSlug ? (
                      <Link href={`/teams/${row.teamSlug}`} className="pr-rankings__entity">
                        <RankingsCrest src={row.teamImageUrl} name={teamName} />
                        <span>{teamName}</span>
                      </Link>
                    ) : (
                      <span className="pr-rankings__entity">
                        <RankingsCrest src={row.teamImageUrl} name={teamName} />
                        <span>{teamName}</span>
                      </span>
                    )
                  ) : (
                    <span className="pr-rankings__dash">{row.teamCode ?? "—"}</span>
                  )}
                </td>
                <td>
                  {countryName ? (
                    row.nationSlug ? (
                      <Link href={`/teams/${row.nationSlug}`} className="pr-rankings__entity">
                        <RankingsFlag src={row.nationImageUrl} name={countryName} />
                        <span>{countryName}</span>
                      </Link>
                    ) : (
                      <span className="pr-rankings__entity">
                        <RankingsFlag src={row.nationImageUrl} name={countryName} />
                        <span>{countryName}</span>
                      </span>
                    )
                  ) : (
                    <span className="pr-rankings__dash">—</span>
                  )}
                </td>
                <td className="is-num">
                  <RatingValue value={row.tournamentRating} />
                </td>
                <td className="is-form">
                  <FormBlocks blocks={formBlocks} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={row.tournamentPerformance} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={row.teamPerformance} />
                </td>
                <td className="is-num">
                  <PerformanceValue value={row.matchPerformance} />
                </td>
                <td className="is-move">
                  <MovementCell
                    rank={row.rank}
                    movement={trendToMovement(row.trend)}
                    previousRank={row.previousRank}
                    retired={row.retired}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CompetitionRankingsClient({
  slug,
  initialSeason,
}: {
  slug: string;
  initialSeason?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<CompetitionRankingsPayload | null>(null);
  const [seasonLabel, setSeasonLabel] = useState(initialSeason ?? "");
  const [tab, setTab] = useState<Tab>("players");
  const [positionKey, setPositionKey] = useState<RankingPositionGroup | "">("");
  const [top, setTop] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(top) });
    if (seasonLabel) params.set("season", seasonLabel);
    const res = await fetch(`/api/competitions/by-slug/${slug}/rankings?${params}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as CompetitionRankingsPayload & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Failed to load rankings");
      setData(null);
      setLoading(false);
      return;
    }
    if (seasonLabel && !returnedSeasonMatchesRequest(seasonLabel, json.season)) {
      setError("Failed to load rankings for this season");
      setData(null);
      setLoading(false);
      return;
    }
    setData(json);
    const nextSeason = rankingSeasonQueryValue(slug, json.season);
    if (nextSeason && nextSeason !== seasonLabel) setSeasonLabel(nextSeason);
    setLoading(false);
  }, [slug, seasonLabel, top]);

  const staffBoard = tab === "referees" || tab === "coaches";

  useEffect(() => {
    load().catch(() => {
      setError("Failed to load rankings");
      setLoading(false);
    });
  }, [load]);

  useEffect(() => {
    if (!seasonLabel) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("season") === seasonLabel) return;
    params.set("season", seasonLabel);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [seasonLabel, pathname, router]);

  useEffect(() => {
    if (staffBoard) {
      if (top !== 10 && top !== COMPETITION_STAFF_RANKING_ALL) {
        setTop(COMPETITION_STAFF_RANKING_ALL);
      }
      return;
    }
    if (
      !COMPETITION_RANKING_TOP_OPTIONS.includes(
        top as (typeof COMPETITION_RANKING_TOP_OPTIONS)[number],
      )
    ) {
      setTop(50);
    }
  }, [staffBoard, top]);

  const playerRows = useMemo(() => {
    if (!data) return [];
    if (!positionKey) return (data.playersOverall ?? []).slice(0, top);
    return (
      data.playersByPosition.find((board) => board.positionGroup === positionKey)?.entries ?? []
    ).slice(0, top);
  }, [data, positionKey, top]);

  const boardTitle = useMemo(() => {
    if (!data) return `TOP ${top} PLAYERS`;
    if (tab === "teams") return `${data.competition.name.toUpperCase()} TOP ${top} TEAMS`;
    if (tab === "coaches") {
      const size = top === 10 ? "TOP 10" : "ALL";
      return `${data.competition.name.toUpperCase()} ${size} COACHES`;
    }
    if (tab === "referees") {
      const size = top === 10 ? "TOP 10" : "ALL";
      return `${data.competition.name.toUpperCase()} ${size} REFEREES`;
    }
    const positionLabel = positionKey ? RANKING_POSITION_LABELS[positionKey] : null;
    return buildPlayerRankingsTitle({
      mode: "current",
      top,
      positionLabel,
      nationLabel: null,
      clubLabel: null,
      competitionLabel: data.competition.name,
    });
  }, [data, tab, positionKey, top]);

  const kicker =
    tab === "players"
      ? "PLAYER RANKINGS"
      : tab === "teams"
        ? "TEAM RANKINGS"
        : tab === "coaches"
          ? "COACH RANKINGS"
          : "REFEREE RANKINGS";

  const eligibilityNote =
    tab === "players"
      ? (data?.notes.players ??
        "Rankings are calculated by the R365 Rating Model from match ratings in this competition season.")
      : tab === "coaches"
        ? (data?.notes.coaches ?? "Coach rankings use Rugby365 match ratings in this tournament.")
        : tab === "referees"
          ? (data?.notes.referees ?? "Referee rankings use Rugby365 match ratings in this tournament.")
          : (data?.notes.teams ??
            "Simple points table from finished matches in this competition season.");

  return (
    <article className="pr-player-v2">
      <div className="pr-player-v2__inner pr-rankings-page">
        <div className="pr-rankings">
          <header className="pr-rankings__hero">
            <h1 className="pr-rankings__kicker">
              {kicker}
              <span className="pr-rankings__info-icon" aria-hidden>
                i
              </span>
            </h1>
          </header>

          <div className="pr-rankings__toolbar">
            <div className="pr-rankings__toolbar-main">
              <div className="pr-rankings__tabs" role="tablist" aria-label="Ranking type">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    className={`pr-rankings__tab${tab === item.id ? " is-active" : ""}`}
                    onClick={() => setTab(item.id)}
                  >
                    {item.id === "players" ? "Overall" : item.label}
                  </button>
                ))}
              </div>
              {tab === "players" ? (
                <RankingsFilterSelect
                  label="Position"
                  value={positionKey}
                  onChange={(e) => setPositionKey(e.target.value as RankingPositionGroup | "")}
                >
                  {POSITION_FILTERS.map((p) => (
                    <option key={p.key || "all"} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </RankingsFilterSelect>
              ) : null}
            </div>
            <RankingsFilterSelect
              className="pr-rankings__filter--season"
              label={`Season ${seasonLabel || ""}`.trim()}
              icon={<SeasonCalendarIcon />}
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              disabled={!data?.seasons?.length}
            >
              {!data?.seasons?.length ? (
                <option value="">No seasons</option>
              ) : (
                data.seasons.map((season) => (
                  <option key={season.id} value={rankingSeasonQueryValue(slug, season) || season.label}>
                    {season.displayLabel ?? season.label}
                  </option>
                ))
              )}
            </RankingsFilterSelect>
          </div>

          <div className="pr-rankings__title-row">
            <h2 className="pr-rankings__title">{boardTitle}</h2>
            <div className="pr-rankings__title-tools">
              <label className="pr-rankings__top">
                <span className="sr-only">Board size</span>
                <select
                  value={String(staffBoard ? (top === 10 ? 10 : COMPETITION_STAFF_RANKING_ALL) : top)}
                  onChange={(e) =>
                    setTop(
                      staffBoard
                        ? normalizeCompetitionStaffRankingTop(e.target.value)
                        : normalizeCompetitionRankingTop(e.target.value),
                    )
                  }
                >
                  {(staffBoard ? COMPETITION_STAFF_RANKING_TOP_OPTIONS : COMPETITION_RANKING_TOP_OPTIONS).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n === COMPETITION_STAFF_RANKING_ALL ? "All" : `Top ${n}`}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </div>
          </div>

          {loading ? (
            <section className="pr-rankings__empty">
              <p className="pr-rankings__empty-kicker">LOADING</p>
              <p className="pr-rankings__empty-body">Loading rankings…</p>
            </section>
          ) : error ? (
            <section className="pr-rankings__empty">
              <p className="pr-rankings__empty-kicker">UNAVAILABLE</p>
              <p className="pr-rankings__empty-body">{error}</p>
            </section>
          ) : (
            <section className="pr-rankings__board">
              {tab === "players" ? <PlayerTable rows={playerRows} /> : null}
              {tab === "teams" ? <TeamsTable rows={(data?.teams ?? []).slice(0, top)} /> : null}
              {tab === "referees" ? (
                <RefereesTable rows={(data?.referees ?? []).slice(0, top)} />
              ) : null}
              {tab === "coaches" ? (
                <CoachesTable rows={(data?.coaches ?? []).slice(0, top)} />
              ) : null}
              <RankingsBoardFooter eligibilityNote={eligibilityNote} />
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
