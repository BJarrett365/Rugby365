import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; view?: string; position?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Stats | Player | Rugby365`, description: `Statistics for ${slug}` };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function PlayerStatsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: isPreviewParam(sp.preview) });
  if (!overview) notFound();

  const s = overview.seasonSnapshot;
  const c = overview.career;
  const usage = overview.positionHistory.usage;
  const showPositions = sp.view === "positions" || Boolean(sp.position);
  const focusSlug = sp.position?.toLowerCase() ?? null;

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Stats" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="stats" />

      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <header>
          <p className="pr-player-v2__kicker">Full statistics</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{overview.displayName}</h1>
        </header>

        {showPositions ? (
          <div className="pr-player-v2__card" id="positions">
            <div className="pr-player-v2__card-head">
              <h2>{usage.title}</h2>
              <Link href={`/players/${overview.slug}/stats`} className="pr-player-v2__card-link">
                All stats
              </Link>
            </div>
            <p className="pr-player-v2__note" style={{ marginTop: 0 }}>
              {usage.coverage.label}
            </p>
            {usage.positions.length === 0 ? (
              <p className="pr-player-v2__empty">No field-position usage yet.</p>
            ) : (
              <div className="pr-player-v2__table-wrap">
                <table className="pr-player-v2__table">
                  <thead>
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Apps</th>
                      <th scope="col">Starts</th>
                      <th scope="col">Bench</th>
                      <th scope="col">Minutes</th>
                      <th scope="col">Usage %</th>
                      <th scope="col">Avg Rating</th>
                      <th scope="col">Pos Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.positions.map((p) => (
                      <tr
                        key={p.positionId}
                        className={
                          focusSlug && p.positionSlug === focusSlug
                            ? "pr-player-v2__table-row--focus"
                            : undefined
                        }
                      >
                        <td>{p.positionName}</td>
                        <td>{p.appearances}</td>
                        <td>{p.starts}</td>
                        <td>{p.benchEntries}</td>
                        <td>{p.minutes ?? "—"}</td>
                        <td>{p.usagePercent}%</td>
                        <td>
                          {p.averageMatchRating != null ? p.averageMatchRating.toFixed(1) : "—"}
                        </td>
                        <td>{p.positionRating ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pr-player-v2__appearance-role" style={{ marginTop: "1rem" }}>
              <p className="pr-player-v2__positions-title">Appearance role</p>
              <div className="pr-player-v2__appearance-role-grid">
                <div>
                  <strong>{usage.appearanceRole.starts}</strong>
                  <span>Starts · {Math.round(usage.appearanceRole.startsPct)}%</span>
                </div>
                <div>
                  <strong>{usage.appearanceRole.bench}</strong>
                  <span>Bench · {Math.round(usage.appearanceRole.benchPct)}%</span>
                </div>
              </div>
            </div>
            {usage.insight ? <p className="pr-player-v2__insight">{usage.insight}</p> : null}
          </div>
        ) : null}

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>{s?.seasonLabel ?? "Current Season"}</h2>
            {!showPositions ? (
              <Link
                href={`/players/${overview.slug}/stats?view=positions`}
                className="pr-player-v2__card-link"
              >
                Position stats
              </Link>
            ) : null}
          </div>
          {s ? (
            <div className="pr-player-v2__stat-strip">
              <div className="pr-player-v2__stat-tile">
                <strong>{s.appearances ?? "—"}</strong>
                <span>Apps</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.starts ?? "—"}</strong>
                <span>Starts</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.minutesPlayed ?? "—"}</strong>
                <span>Minutes</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.tries ?? "—"}</strong>
                <span>Tries</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.points ?? "—"}</strong>
                <span>Points</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.tryAssists ?? "—"}</strong>
                <span>Assists</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.carries ?? "—"}</strong>
                <span>Carries</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.metresCarried ?? "—"}</strong>
                <span>Metres</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.tacklesMade ?? "—"}</strong>
                <span>Tackles</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.turnoversWon ?? "—"}</strong>
                <span>Turnovers</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.lineBreaks ?? "—"}</strong>
                <span>Line Breaks</span>
              </div>
              <div className="pr-player-v2__stat-tile">
                <strong>{s.ratingAverage != null ? s.ratingAverage.toFixed(1) : "—"}</strong>
                <span>Avg Rating</span>
              </div>
            </div>
          ) : (
            <p className="pr-player-v2__empty">No season stats recorded yet.</p>
          )}
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Career Totals</h2>
          </div>
          <div className="pr-player-v2__stat-strip">
            <div className="pr-player-v2__stat-tile">
              <strong>{c.appearances ?? "—"}</strong>
              <span>Apps</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.tries ?? "—"}</strong>
              <span>Tries</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.points ?? "—"}</strong>
              <span>Points</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.conversions ?? "—"}</strong>
              <span>Conversions</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.penalties ?? "—"}</strong>
              <span>Penalties</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.dropGoals ?? "—"}</strong>
              <span>Drop Goals</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.internationalApps ?? "—"}</strong>
              <span>Int&apos;l Apps</span>
            </div>
            <div className="pr-player-v2__stat-tile">
              <strong>{c.internationalPoints ?? "—"}</strong>
              <span>Int&apos;l Points</span>
            </div>
          </div>
        </div>

        <div className="pr-player-v2__card" id="matches">
          <div className="pr-player-v2__card-head">
            <h2>Match Log</h2>
          </div>
          {overview.recentMatches.length === 0 ? (
            <p className="pr-player-v2__empty">No matches recorded yet.</p>
          ) : (
            <div className="pr-player-v2__table-wrap">
              <table className="pr-player-v2__table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Match</th>
                    <th scope="col">Competition</th>
                    <th scope="col">Rating</th>
                    <th scope="col">Cards</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentMatches.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDate(m.kickoffAt)}</td>
                      <td>
                        {m.href ? <Link href={m.href}>{m.matchLabel}</Link> : m.matchLabel}
                      </td>
                      <td>{m.competitionName ?? "—"}</td>
                      <td>{m.rating != null ? m.rating.toFixed(1) : "—"}</td>
                      <td>
                        Y{m.yellowCards} / R{m.redCards}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
