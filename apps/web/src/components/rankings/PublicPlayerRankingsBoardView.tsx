import Link from "next/link";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { formatRatingMovementDelta, rankingHref } from "@/lib/player-ranking-engine";
import type {
  PublicRankingBoard,
  RankingFilterOptions,
} from "@/lib/public-player-rankings-product-service";

function FormBlocks({
  blocks,
  formScore,
}: {
  blocks: Array<{ rating: number; band: string }>;
  formScore: number | null;
}) {
  if (!blocks.length && formScore == null) {
    return <span className="pr-rankings__dash">—</span>;
  }
  const title = [
    blocks.length ? `Last 5: ${blocks.map((b) => b.rating.toFixed(1)).join(" · ")}` : null,
    formScore != null ? `Form Score: ${formScore}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span className="pr-rankings__form" title={title}>
      {blocks.map((b, i) => (
        <span key={`${b.rating}-${i}`} className={`pr-rankings__form-block is-${b.band}`} />
      ))}
      {formScore != null ? (
        <span className="pr-rankings__form-score">{Math.round(formScore)}</span>
      ) : null}
    </span>
  );
}

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

function MovementCell({
  movement,
  previousRank,
  movementDelta,
}: {
  movement: "up" | "down" | "flat" | null;
  previousRank: number | null;
  movementDelta: number | null;
}) {
  const deltaLabel = formatRatingMovementDelta(movementDelta);
  if (deltaLabel != null && movementDelta != null) {
    const dir =
      movementDelta > 0.05 ? "up" : movementDelta < -0.05 ? "down" : "flat";
    const arrow = dir === "up" ? "↑" : dir === "down" ? "↓" : "—";
    return (
      <span
        className={`pr-rankings__move is-${dir}`}
        title={
          previousRank != null
            ? `Was #${previousRank} · Form trend ${deltaLabel}`
            : `Form trend vs prior window: ${deltaLabel}`
        }
      >
        {dir === "flat" ? `— ${deltaLabel}` : `${arrow} ${deltaLabel}`}
      </span>
    );
  }
  if (movement == null) return <span className="pr-rankings__dash">—</span>;
  if (movement === "flat") {
    return (
      <span className="pr-rankings__move is-flat" title={previousRank != null ? `Was #${previousRank}` : undefined}>
        —
      </span>
    );
  }
  if (movement === "up") {
    return (
      <span className="pr-rankings__move is-up" title={previousRank != null ? `Was #${previousRank}` : undefined}>
        ↑
      </span>
    );
  }
  return (
    <span className="pr-rankings__move is-down" title={previousRank != null ? `Was #${previousRank}` : undefined}>
      ↓
    </span>
  );
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

  return (
    <div className="pr-rankings">
      <header className="pr-rankings__hero">
        <p className="pr-rankings__kicker">RUGBY365 PLAYER RANKINGS</p>
        <div className="pr-rankings__mode" role="tablist" aria-label="Ranking mode">
          <Link
            href={rankingHref({
              mode: "current",
              position: f.position,
              nation: f.nation,
              club: f.club,
              competition: f.competition,
              top: f.top,
            })}
            className={`pr-rankings__mode-btn${f.mode === "current" ? " is-active" : ""}`}
            role="tab"
            aria-selected={f.mode === "current"}
          >
            Current Players
          </Link>
          <Link
            href={rankingHref({
              mode: "alltime",
              position: f.position,
              nation: f.nation,
              club: f.club,
              competition: f.competition,
              top: f.top,
              era: f.era,
            })}
            className={`pr-rankings__mode-btn${f.mode === "alltime" ? " is-active" : ""}`}
            role="tab"
            aria-selected={f.mode === "alltime"}
          >
            All-Time Players
          </Link>
        </div>
      </header>

      <form className="pr-rankings__filters" method="get">
        <input type="hidden" name="mode" value={f.mode} />
        <label>
          Position
          <select name="position" defaultValue={f.position ?? ""}>
            <option value="">Overall</option>
            {options.positions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Country
          <select name="nation" defaultValue={f.nation ?? ""}>
            <option value="">All countries</option>
            {options.nations.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          Club
          <select name="club" defaultValue={f.club ?? ""}>
            <option value="">All clubs</option>
            {options.clubs.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Competition
          <select name="competition" defaultValue={f.competition ?? ""}>
            <option value="">All competitions</option>
            {options.competitions.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {isAllTime ? (
          <label>
            Era
            <select name="era" defaultValue={f.era ?? "all"}>
              {options.eras.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Season
            <select name="season" defaultValue="current" disabled>
              <option value="current">Current</option>
            </select>
          </label>
        )}
        <label>
          Top
          <select name="top" defaultValue={String(f.top)}>
            {options.topOptions.map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="pr-rankings__apply">
          Apply
        </button>
      </form>

      <div className="pr-rankings__title-block">
        <h1 className="pr-rankings__title">{board.title}</h1>
        <p className="pr-rankings__info" title={board.eligibilityNote}>
          Rankings are calculated by the{" "}
          {isAllTime ? "R365 Legend Score Model" : "R365 Rating Model"}
          {board.calculatedAt
            ? ` · Updated ${new Date(board.calculatedAt).toLocaleString("en-GB")}`
            : null}
          {board.fromSnapshot ? " · Snapshot" : null}
          {board.pool > 0 ? ` · Pool ${board.pool}` : null}
        </p>
      </div>

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
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Club</th>
                  <th>Country</th>
                  <th>R365 Rating</th>
                  <th>{isAllTime ? "Peak / Impact" : "Current Form"}</th>
                  <th>International</th>
                  <th>Club Perf.</th>
                  <th>Position</th>
                  <th>Movement</th>
                </tr>
              </thead>
              <tbody>
                {board.rows.map((row) => (
                  <tr key={row.playerId} title={row.breakdownTitle}>
                    <td>
                      <span
                        className={`pr-rankings__rank${row.rank === 1 && !row.provisional ? " is-gold" : ""}${row.provisional ? " is-provisional" : ""}`}
                      >
                        {row.rankDisplay}
                      </span>
                    </td>
                    <td>
                      <Link href={`/players/${row.slug}`} className="pr-rankings__player">
                        {row.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.imageUrl} alt="" className="pr-rankings__avatar" />
                        ) : (
                          <span className="pr-rankings__avatar is-placeholder" aria-hidden>
                            {row.name.slice(0, 1)}
                          </span>
                        )}
                        <span className="pr-rankings__player-name">{row.name}</span>
                        {row.provisional ? (
                          <span className="pr-rankings__badge">PROVISIONAL</span>
                        ) : null}
                      </Link>
                    </td>
                    <td>
                      {row.teamName && row.teamSlug ? (
                        <Link href={`/teams/${row.teamSlug}`} className="pr-rankings__entity">
                          <TeamCrest name={row.teamName} imageUrl={row.teamImageUrl} size="xs" />
                          <span>{row.teamName}</span>
                        </Link>
                      ) : row.teamName ? (
                        <span className="pr-rankings__entity">
                          <TeamCrest name={row.teamName} imageUrl={row.teamImageUrl} size="xs" />
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
                            <TeamCrest
                              name={row.nationName}
                              imageUrl={row.nationImageUrl}
                              size="xs"
                            />
                            <span>{row.nationName}</span>
                          </Link>
                        ) : (
                          <span className="pr-rankings__entity">
                            <TeamCrest
                              name={row.nationName}
                              imageUrl={row.nationImageUrl}
                              size="xs"
                            />
                            <span>{row.nationName}</span>
                          </span>
                        )
                      ) : (
                        <span className="pr-rankings__dash">—</span>
                      )}
                    </td>
                    <td>
                      <span className="pr-rankings__rating" title={row.breakdownTitle}>
                        {row.r365Rating != null ? row.r365Rating.toFixed(1) : "—"}
                      </span>
                    </td>
                    <td>
                      {isAllTime ? (
                        <PeakImpactCell
                          peakRating={row.peakRating ?? row.positionPerformance}
                          impactScore={row.impactScore ?? row.rankingScore}
                        />
                      ) : (
                        <FormBlocks blocks={row.formBlocks} formScore={row.formScore} />
                      )}
                    </td>
                    <td className="pr-rankings__num">
                      {row.internationalPerformance != null
                        ? Math.round(row.internationalPerformance)
                        : "—"}
                    </td>
                    <td className="pr-rankings__num">
                      {row.clubPerformance != null ? Math.round(row.clubPerformance) : "—"}
                    </td>
                    <td className="pr-rankings__num">
                      {isAllTime
                        ? row.peakRating != null
                          ? Math.round(row.peakRating)
                          : row.positionPerformance != null
                            ? Math.round(row.positionPerformance)
                            : "—"
                        : row.positionPerformance != null
                          ? Math.round(row.positionPerformance)
                          : "—"}
                    </td>
                    <td>
                      <MovementCell
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
          <p className="pr-rankings__legend">
            Movement vs previous snapshot · Green ↑ improved · Red ↓ dropped · — unchanged / new
          </p>
        </section>
      )}
    </div>
  );
}
