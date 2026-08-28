"use client";

import Link from "next/link";
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
  RankingStatusBadge,
  RankingsUpdatedStamp,
  RatingValue,
  SeasonCalendarIcon,
} from "@/components/rankings/RankingsBoardPrimitives";
import { PLAYER_RANKING_ELIGIBILITY, rankingHref } from "@/lib/player-ranking-engine";
import type {
  PublicRankingBoard,
  RankingFilterOptions,
} from "@/lib/public-player-rankings-product-service";

function PeakImpactCell({
  peakRating,
  impactScore,
}: {
  peakRating: number | null;
  impactScore: number | null;
}) {
  if (peakRating == null && impactScore == null) {
    return <span className="pr-rankings__dash">—</span>;
  }
  return (
    <span
      className="pr-rankings__peak"
      title={[
        peakRating != null ? `Peak ${peakRating.toFixed(1)}` : null,
        impactScore != null ? `Impact ${impactScore.toFixed(1)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <span className="pr-rankings__peak-main">
        {peakRating != null ? peakRating.toFixed(1) : "—"}
      </span>
      {impactScore != null ? (
        <span className="pr-rankings__peak-sub">/ {impactScore.toFixed(0)}</span>
      ) : null}
    </span>
  );
}

function seasonYearLabel(iso: string | null): string {
  const year = iso ? new Date(iso).getFullYear() : new Date().getFullYear();
  return Number.isFinite(year) ? String(year) : String(new Date().getFullYear());
}

function autoSubmit(form: HTMLFormElement | null) {
  form?.requestSubmit();
}

export function PublicPlayerRankingsBoardView({
  board,
  options,
}: {
  board: PublicRankingBoard;
  options: RankingFilterOptions;
}) {
  const f = board.filters;
  const isAllTime = board.mode === "alltime";
  const eligibilityNote = `Rankings are calculated by the ${
    isAllTime ? "R365 Legend Score Model" : "R365 Rating Model"
  }. Minimum eligibility: ${PLAYER_RANKING_ELIGIBILITY.minMinutes} minutes or ${PLAYER_RANKING_ELIGIBILITY.minAppearances} appearances in the last ${PLAYER_RANKING_ELIGIBILITY.rollingMonths} months.`;

  return (
    <div className="pr-rankings">
      <header className="pr-rankings__hero">
        <h1 className="pr-rankings__kicker">
          PLAYER RANKINGS
          <span className="pr-rankings__info-icon" aria-hidden>
            i
          </span>
        </h1>
      </header>

      <form
        className="pr-rankings__board-form"
        method="get"
        onChange={(e) => autoSubmit(e.currentTarget)}
      >
        <input type="hidden" name="mode" value={f.mode} />
        <div className="pr-rankings__toolbar">
          <div className="pr-rankings__toolbar-main">
            <div className="pr-rankings__tabs" role="tablist" aria-label="Ranking mode">
              <Link
                href={rankingHref({
                  mode: "current",
                  position: f.position,
                  nation: f.nation,
                  club: f.club,
                  competition: f.competition,
                  top: 10,
                })}
                className={`pr-rankings__tab${f.mode === "current" ? " is-active" : ""}`}
                role="tab"
                aria-selected={f.mode === "current"}
              >
                Overall
              </Link>
              <Link
                href={rankingHref({
                  mode: "alltime",
                  position: f.position,
                  nation: f.nation,
                  club: f.club,
                  competition: f.competition,
                  top: 10,
                  era: f.era,
                })}
                className={`pr-rankings__tab${f.mode === "alltime" ? " is-active" : ""}`}
                role="tab"
                aria-selected={f.mode === "alltime"}
              >
                All-Time
              </Link>
            </div>
            <RankingsFilterSelect name="position" label="Position" defaultValue={f.position ?? ""}>
              <option value="">All positions</option>
              {options.positions.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </RankingsFilterSelect>
            <RankingsFilterSelect name="nation" label="Country" defaultValue={f.nation ?? ""}>
              <option value="">All countries</option>
              {options.nations.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </RankingsFilterSelect>
            <RankingsFilterSelect name="club" label="Club" defaultValue={f.club ?? ""}>
              <option value="">All clubs</option>
              {options.clubs.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </RankingsFilterSelect>
            <RankingsFilterSelect
              name="competition"
              label="Competition"
              defaultValue={f.competition ?? ""}
            >
              <option value="">All competitions</option>
              {options.competitions.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </RankingsFilterSelect>
            {isAllTime ? (
              <RankingsFilterSelect name="era" label="Era" defaultValue={f.era ?? "all"}>
                {options.eras.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.label}
                  </option>
                ))}
              </RankingsFilterSelect>
            ) : null}
          </div>
          <RankingsFilterSelect
            className="pr-rankings__filter--season"
            name="season"
            label={`Season ${isAllTime ? "All" : seasonYearLabel(board.calculatedAt)}`}
            icon={<SeasonCalendarIcon />}
            defaultValue="current"
            disabled={f.mode === "current"}
          >
            <option value="current">Season {seasonYearLabel(board.calculatedAt)}</option>
          </RankingsFilterSelect>
        </div>

        <div className="pr-rankings__title-row">
          <h2 className="pr-rankings__title">{board.title}</h2>
          <div className="pr-rankings__title-tools">
            <label className="pr-rankings__top">
              <span className="sr-only">Board size</span>
              <select name="top" defaultValue="10">
                <option value="10">Top 10</option>
              </select>
            </label>
            <RankingsUpdatedStamp iso={board.calculatedAt} />
          </div>
        </div>
      </form>

      {board.status === "under_development" ? (
        <section className="pr-rankings__empty">
          <p className="pr-rankings__empty-kicker">UNDER DEVELOPMENT</p>
          <p className="pr-rankings__empty-body">{board.eligibilityNote}</p>
          <Link className="pr-rankings__empty-link" href="/rankings/players?mode=current">
            View Current Player Rankings →
          </Link>
        </section>
      ) : board.rows.length === 0 ? (
        <section className="pr-rankings__empty">
          <p className="pr-rankings__empty-kicker">RANKINGS BUILDING</p>
          <p className="pr-rankings__empty-body">
            Not enough eligible players for this filter set yet. Widen position, country, club or
            competition filters.
          </p>
          <Link className="pr-rankings__empty-link" href="/rankings/players">
            View World Rankings →
          </Link>
        </section>
      ) : (
        <section className="pr-rankings__board">
          {board.status === "provisional" ? (
            <p className="pr-rankings__provisional-banner">
              PROVISIONAL RANKING — sample pool is still thin ({board.pool} eligible).
            </p>
          ) : null}
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
                  <th className="is-form">{isAllTime ? "Peak / Impact" : "Current Form (Last 5)"}</th>
                  <th className="is-num">International Performance</th>
                  <th className="is-num">Club Performance</th>
                  <th className="is-num">Position Performance</th>
                  <th className="is-move">Movement (vs last week)</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.slice(0, 10).map((row) => (
                  <tr key={row.playerId} title={row.breakdownTitle}>
                    <td className="is-num">
                      <RankNumber rank={row.rank} provisional={row.provisional} />
                    </td>
                    <td>
                      <Link href={`/players/${row.slug}`} className="pr-rankings__player">
                        <RankingsAvatar src={row.imageUrl} name={row.name} />
                        <span className="pr-rankings__player-name">{row.name}</span>
                        <RankingStatusBadge provisional={row.provisional} retired={row.retired} />
                      </Link>
                    </td>
                    <td>
                      {row.teamName && row.teamName !== "Unassigned" && row.teamSlug ? (
                        <Link href={`/teams/${row.teamSlug}`} className="pr-rankings__entity">
                          <RankingsCrest src={row.teamImageUrl} name={row.teamName} />
                          <span>{row.teamName}</span>
                        </Link>
                      ) : row.teamName && row.teamName !== "Unassigned" ? (
                        <span className="pr-rankings__entity">
                          <RankingsCrest src={row.teamImageUrl} name={row.teamName} />
                          <span>{row.teamName}</span>
                        </span>
                      ) : (
                        <span className="pr-rankings__dash">—</span>
                      )}
                    </td>
                    <td>
                      {row.nationName ? (
                        row.nationSlug ? (
                          <Link href={`/teams/${row.nationSlug}`} className="pr-rankings__entity">
                            <RankingsFlag src={row.nationImageUrl} name={row.nationName} />
                            <span>{row.nationName}</span>
                          </Link>
                        ) : (
                          <span className="pr-rankings__entity">
                            <RankingsFlag src={row.nationImageUrl} name={row.nationName} />
                            <span>{row.nationName}</span>
                          </span>
                        )
                      ) : (
                        <span className="pr-rankings__dash">—</span>
                      )}
                    </td>
                    <td className="is-num">
                      <RatingValue value={row.r365Rating} />
                    </td>
                    <td className="is-form">
                      {isAllTime ? (
                        <PeakImpactCell
                          peakRating={row.peakRating ?? row.positionPerformance}
                          impactScore={row.impactScore ?? row.rankingScore}
                        />
                      ) : (
                        <FormBlocks blocks={row.formBlocks} />
                      )}
                    </td>
                    <td className="is-num">
                      <PerformanceValue value={row.internationalPerformance} />
                    </td>
                    <td className="is-num">
                      <PerformanceValue value={row.clubPerformance} />
                    </td>
                    <td className="is-num">
                      <PerformanceValue
                        value={
                          isAllTime
                            ? (row.peakRating ?? row.positionPerformance)
                            : row.positionPerformance
                        }
                      />
                    </td>
                    <td className="is-move">
                      <MovementCell
                        rank={row.rank}
                        movement={row.movement}
                        previousRank={row.previousRank}
                        movementDelta={row.movementDelta ?? null}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <RankingsBoardFooter eligibilityNote={eligibilityNote} />
        </section>
      )}
    </div>
  );
}
