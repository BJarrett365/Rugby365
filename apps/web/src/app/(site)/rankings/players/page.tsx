import type { Metadata } from "next";
import Link from "next/link";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import {
  RANKING_POSITION_GROUPS,
  rankingHref,
  type RankingMetricKey,
  type RankingTabId,
} from "@/lib/player-ranking-engine";
import { listPublicPlayerRankings } from "@/lib/public-player-rankings-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rugby365 Player Rankings | Rugby365",
  description:
    "Players ranked by Rugby365 ratings and intelligence — overall, national, position and competition scopes.",
};

const METRICS: Array<{ id: RankingMetricKey; label: string }> = [
  { id: "overall", label: "Overall" },
  { id: "attack", label: "Attack" },
  { id: "defence", label: "Defence" },
  { id: "playmaking", label: "Playmaking" },
  { id: "kicking", label: "Kicking" },
  { id: "goal_kicking", label: "Goal Kicking" },
  { id: "game_management", label: "Game Management" },
  { id: "form", label: "Form" },
  { id: "potential", label: "Potential" },
  { id: "market_value", label: "Market Value" },
];

const SCOPES: Array<{ id: RankingTabId; label: string }> = [
  { id: "global", label: "World" },
  { id: "national", label: "National" },
  { id: "position", label: "Position" },
  { id: "competition", label: "Competition" },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default async function PlayerRankingsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = (await searchParams) ?? {};
  const metric = (one(sp.metric) as RankingMetricKey | null) ?? "overall";
  const scope = (one(sp.scope) as RankingTabId | null) ?? "global";
  const nation = one(sp.nation);
  const position = one(sp.position);
  const competition = one(sp.competition);

  const board = await listPublicPlayerRankings({
    metric,
    scope,
    nation,
    position,
    competition,
    limit: 100,
  });

  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? metric;
  const scopeLabel = SCOPES.find((s) => s.id === scope)?.label ?? scope;

  return (
    <article className="pr-player-v2">
      <div className="pr-player-v2__inner">
        <PlayerPublicBreadcrumb
          items={[
            { label: "Rankings", href: "/rankings" },
            { label: "Players" },
          ]}
        />

        <header className="pr-player-v2__page-head">
          <p className="pr-player-v2__kicker">RANKINGS</p>
          <h1 className="pr-player-v2__page-title">Rugby365 Player Rankings</h1>
          <p className="pr-player-v2__page-lede">
            {scopeLabel} · {metricLabel} · Pool {board.pool}. Ranks are computed from ratings and
            intelligence — never assigned manually. Active players only.
          </p>
        </header>

        <form className="pr-player-v2__rank-filters" method="get">
          <label>
            Scope
            <select name="scope" defaultValue={scope}>
              {SCOPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Metric
            <select name="metric" defaultValue={metric}>
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Position
            <select name="position" defaultValue={position ?? ""}>
              <option value="">Any</option>
              {RANKING_POSITION_GROUPS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Country
            <input name="nation" type="text" defaultValue={nation ?? ""} placeholder="e.g. South Africa" />
          </label>
          <label>
            Competition
            <input
              name="competition"
              type="text"
              defaultValue={competition ?? ""}
              placeholder="e.g. United Rugby Championship"
            />
          </label>
          <button type="submit" className="pr-player-v2__rank-filter-btn">
            Apply
          </button>
        </form>

        <div className="pr-player-v2__rank-quick">
          <Link href={rankingHref({ metric: "overall", scope: "global" })}>World overall</Link>
          <Link href={rankingHref({ metric: "overall", scope: "global", position: "fly_half" })}>
            Fly-halves
          </Link>
          <Link
            href={rankingHref({
              metric: "overall",
              scope: "competition",
              competition: "United Rugby Championship",
              position: "fly_half",
            })}
          >
            URC fly-halves
          </Link>
          <Link href={rankingHref({ metric: "market_value", scope: "global" })}>Market value</Link>
        </div>

        <section className="pr-player-v2__card">
          {board.rows.length === 0 ? (
            <div className="pr-player-v2__rank-building">
              <p className="pr-player-v2__rank-building-kicker">RANKINGS BUILDING</p>
              <p className="pr-player-v2__rank-building-reason">
                Not enough eligible players for this filter set yet. Try World / Overall, or widen
                position and competition filters.
              </p>
              <Link className="pr-player-v2__card-link" href="/rankings/players?scope=global&metric=overall">
                View Global Rankings &gt;
              </Link>
            </div>
          ) : (
            <div className="pr-player-v2__table-wrap">
              <table className="pr-player-v2__table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Change</th>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Nation</th>
                    <th>Position</th>
                    <th>Age</th>
                    <th>Score</th>
                    <th>Form</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((row) => (
                    <tr key={row.playerId}>
                      <td>
                        <span className="pr-player-v2__rank-num">{row.rankDisplay}</span>
                      </td>
                      <td>
                        {row.movement == null
                          ? "—"
                          : row.movement === "up"
                            ? "↑"
                            : row.movement === "down"
                              ? "↓"
                              : "—"}
                      </td>
                      <td>
                        <Link href={`/players/${row.slug}`}>{row.name}</Link>
                      </td>
                      <td>{row.teamName ?? "—"}</td>
                      <td>{row.nationName ?? "—"}</td>
                      <td>{row.positionName ?? "—"}</td>
                      <td>{row.age ?? "—"}</td>
                      <td>{row.score}</td>
                      <td>{row.form ?? "—"}</td>
                      <td>{row.confidence != null ? `${row.confidence}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
