import Link from "next/link";
import type { CoachTeamDashboard } from "@/lib/coach-team-dashboard-service";
import { formatDashboardGbp } from "@/lib/coach-team-dashboard-service";
import { CoachProfileAssetImage } from "./CoachProfileAssetImage";

function dash(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function PlayerChip({
  name,
  imageUrl,
  rating,
  href,
  compact,
}: {
  name: string;
  imageUrl: string | null;
  rating?: number | null;
  href?: string;
  compact?: boolean;
}) {
  const inner = (
    <>
      {imageUrl ? (
        <CoachProfileAssetImage
          src={imageUrl}
          className="pr-coach-dash__photo"
          width={compact ? 28 : 36}
          height={compact ? 28 : 36}
          fallbackClassName="pr-coach-dash__photo-fallback"
        />
      ) : (
        <span className="pr-coach-dash__photo-fallback" aria-hidden />
      )}
      <span className="pr-coach-dash__chip-name">{name}</span>
      {rating != null ? <span className="pr-coach-dash__badge">{Math.round(rating)}</span> : null}
    </>
  );
  if (!href) return <span className="pr-coach-dash__chip">{inner}</span>;
  return (
    <Link href={href} className="pr-coach-dash__chip">
      {inner}
    </Link>
  );
}

export function CoachSquadDashboard({
  dashboard,
  teamHref,
}: {
  dashboard: CoachTeamDashboard;
  teamHref: string;
}) {
  const donut = `conic-gradient(var(--cp-green) 0 ${dashboard.forwardsPct}%, #f59e0b ${dashboard.forwardsPct}% 100%)`;

  return (
    <>
      <div className="pr-coach-row pr-coach-row--4">
        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Rugby365 Team Intelligence</h2>
            <Link className="pr-coach-card__link" href={teamHref}>
              Team profile &gt;
            </Link>
          </div>
          <div className="pr-coach-dash__intel">
            <div className="pr-coach-dash__intel-cols" aria-hidden>
              <span>Metric</span>
              <span>Rating</span>
              <span>World Rank</span>
            </div>
            {dashboard.intelligence.map((row) => (
              <div className="pr-coach-dash__intel-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{dash(row.value != null ? Math.round(row.value) : null)}</strong>
                <span className="pr-coach-dash__rank">
                  {row.worldRank != null ? `#${row.worldRank}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Squad Value Breakdown</h2>
          </div>
          <div className="pr-coach-dash__value">
            <div className="pr-coach-dash__value-total">{dashboard.squadValueLabel}</div>
            <div className="pr-coach-dash__donut-wrap">
              <div className="pr-coach-dash__donut" style={{ background: donut }}>
                <div className="pr-coach-dash__donut-inner">
                  <strong>{dashboard.forwardsPct}%</strong>
                  <span>Forwards</span>
                </div>
              </div>
              <ul className="pr-coach-dash__legend">
                <li>
                  <i className="is-fwd" /> Forwards {dashboard.forwardsPct}% ·{" "}
                  {formatDashboardGbp(dashboard.forwardsValueGbp)}
                </li>
                <li>
                  <i className="is-back" /> Backs {dashboard.backsPct}% ·{" "}
                  {formatDashboardGbp(dashboard.backsValueGbp)}
                </li>
              </ul>
            </div>
            <dl className="pr-coach-dash__value-facts">
              <div>
                <dt>Average Player Value</dt>
                <dd>{dash(dashboard.averagePlayerValueLabel)}</dd>
              </div>
              <div>
                <dt>Highest Value Player</dt>
                <dd>
                  {dashboard.highestValuePlayer ? (
                    <PlayerChip
                      name={dashboard.highestValuePlayer.name}
                      imageUrl={dashboard.highestValuePlayer.imageUrl}
                      href={`/players/${dashboard.highestValuePlayer.slug}`}
                      compact
                    />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Youngest Prospect</dt>
                <dd>
                  {dashboard.youngestProspect ? (
                    <PlayerChip
                      name={dashboard.youngestProspect.name}
                      imageUrl={dashboard.youngestProspect.imageUrl}
                      href={`/players/${dashboard.youngestProspect.slug}`}
                      compact
                    />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Most Improved</dt>
                <dd>
                  {dashboard.mostImproved ? (
                    <PlayerChip
                      name={`${dashboard.mostImproved.name} (${dashboard.mostImproved.deltaLabel})`}
                      imageUrl={dashboard.mostImproved.imageUrl}
                      href={
                        dashboard.mostImproved.slug
                          ? `/players/${dashboard.mostImproved.slug}`
                          : undefined
                      }
                      compact
                    />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Position Rankings</h2>
          </div>
          <ol className="pr-coach-dash__positions">
            {dashboard.positionRanks.map((row) => (
              <li key={row.family}>
                <span>{row.label}</span>
                <strong className="pr-coach-dash__rank">
                  {row.worldRank != null ? `#${row.worldRank}` : row.rating != null ? Math.round(row.rating) : "—"}
                </strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Top Rated Players</h2>
          </div>
          <ol className="pr-coach-dash__top">
            {dashboard.topRated.map((p, i) => (
              <li key={p.id}>
                <span className="pr-coach-dash__top-rank">{i + 1}</span>
                <Link href={`/players/${p.slug}`} className="pr-coach-dash__top-player">
                  {p.imageUrl ? (
                    <CoachProfileAssetImage
                      src={p.imageUrl}
                      className="pr-coach-dash__photo"
                      width={32}
                      height={32}
                      fallbackClassName="pr-coach-dash__photo-fallback"
                    />
                  ) : (
                    <span className="pr-coach-dash__photo-fallback" aria-hidden />
                  )}
                  <span>
                    <strong>{p.name}</strong>
                    <em>{p.positionName ?? "—"}</em>
                  </span>
                  <span className="pr-coach-dash__badge">
                    {p.rating != null ? Math.round(p.rating) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--3">
        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Most Valuable XV</h2>
            <Link className="pr-coach-card__link" href={teamHref}>
              View full squad &gt;
            </Link>
          </div>
          <div className="pr-coach-dash__pitch" aria-label="Most valuable starting XV">
            {dashboard.valuableXv.map((p) => (
              <Link
                key={`${p.slot}-${p.id}`}
                href={`/players/${p.slug}`}
                className="pr-coach-dash__xv"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                title={`${p.slotLabel} · ${p.name}`}
              >
                {p.imageUrl ? (
                  <CoachProfileAssetImage
                    src={p.imageUrl}
                    className="pr-coach-dash__xv-photo"
                    width={42}
                    height={42}
                    fallbackClassName="pr-coach-dash__xv-fallback"
                  />
                ) : (
                  <span className="pr-coach-dash__xv-fallback">{p.slot}</span>
                )}
                <span className="pr-coach-dash__badge">{p.rating != null ? Math.round(p.rating) : p.slot}</span>
                <em>{p.name.split(" ").slice(-1)[0]}</em>
                <small>{p.marketValueLabel}</small>
              </Link>
            ))}
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Team Rankings (World)</h2>
          </div>
          <div className="pr-coach-dash__bars">
            {[
              { label: "Overall", rank: dashboard.worldRank, rating: dashboard.teamRating },
              ...dashboard.positionRanks.slice(0, 7).map((row) => ({
                label: row.label,
                rank: row.worldRank,
                rating: row.rating,
              })),
            ].map((row) => {
              const width =
                row.rank != null
                  ? Math.max(8, 100 - (row.rank - 1) * 6)
                  : row.rating != null
                    ? Math.max(8, Math.min(100, row.rating))
                    : 0;
              return (
                <div className="pr-coach-dash__bar-row" key={row.label}>
                  <span>{row.label}</span>
                  <div className="pr-coach-dash__bar">
                    <i style={{ width: `${width}%` }} />
                  </div>
                  <strong className="pr-coach-dash__rank">
                    {row.rank != null ? `#${row.rank}` : row.rating != null ? Math.round(row.rating) : "—"}
                  </strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Rising Stars</h2>
          </div>
          {dashboard.risingStars.length === 0 ? (
            <p className="pr-coach-empty">No current squad players available.</p>
          ) : (
            <ol className="pr-coach-dash__top">
              {dashboard.risingStars.map((p, i) => (
                <li key={p.id}>
                  <span className="pr-coach-dash__top-rank">{i + 1}</span>
                  <Link href={`/players/${p.slug}`} className="pr-coach-dash__top-player">
                    {p.imageUrl ? (
                      <CoachProfileAssetImage
                        src={p.imageUrl}
                        className="pr-coach-dash__photo"
                        width={32}
                        height={32}
                        fallbackClassName="pr-coach-dash__photo-fallback"
                      />
                    ) : (
                      <span className="pr-coach-dash__photo-fallback" aria-hidden />
                    )}
                    <span>
                      <strong>{p.name}</strong>
                      <em>
                        {p.positionName ?? "—"}
                        {p.age != null ? ` · ${p.age}` : ""}
                      </em>
                    </span>
                    <span className="pr-coach-dash__badge">
                      {p.rating != null ? Math.round(p.rating) : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="pr-coach-row pr-coach-row--1">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Key Team Stats</h2>
          </div>
          <div className="pr-coach-dash__stats">
            {dashboard.keyStats.map((stat) => (
              <div className="pr-coach-dash__stat" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.sub ? <em>{stat.sub}</em> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
