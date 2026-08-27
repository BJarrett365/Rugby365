import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerIdentityHero } from "@/components/players/PlayerIdentityHero";
import { PlayerIntelligenceRadar } from "@/components/players/PlayerIntelligenceRadar";
import { PlayerAiScoutSummaryCard } from "@/components/players/PlayerAiScoutSummaryCard";
import { PlayerRatingHistoryChart } from "@/components/players/PlayerRatingHistoryChart";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; section?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Intelligence | Player | Rugby365`,
    description: `Rugby365 intelligence model for ${slug}`,
  };
}

export default async function PlayerIntelligencePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, {
    preview: isPreviewParam(sp.preview),
  });
  if (!overview) notFound();

  const i = overview.intelligence;
  const rows: Array<{ label: string; value: number | null }> = [
    { label: "Overall", value: i.overall },
    { label: "Attack", value: i.attack },
    { label: "Playmaking", value: i.playmaking },
    { label: "Kicking", value: i.kicking },
    { label: "Game Management", value: i.gameManagement },
    { label: "Defence", value: i.defence },
    { label: "Physical", value: i.physical },
    { label: "Form", value: i.form },
  ];

  const vs = overview.valueScore;
  const valueScoreFocus = sp.section === "value-score";
  const marketFactors = overview.playerValue?.factors ?? [];
  const positions = overview.positionHistory.usage.positions;

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Intelligence" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="intelligence" />

      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <PlayerIdentityHero overview={overview} />

        <header>
          <p className="pr-player-v2__kicker">Rugby365 intelligence model</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{overview.displayName}</h1>
          <div className="pr-player-v2__chip-row" style={{ marginTop: "0.5rem" }}>
            <span className="pr-player-v2__chip">{overview.classification.label}</span>
            {overview.badges.slice(0, 4).map((b) => (
              <span key={b.key} className="pr-player-v2__chip pr-player-v2__chip--muted">
                {b.label}
              </span>
            ))}
          </div>
        </header>

        <div className="pr-player-v2__row--2">
          <div
            id="value-score"
            className="pr-player-v2__card"
            style={valueScoreFocus ? { outline: "1px solid rgba(34,197,94,0.35)" } : undefined}
          >
            <div className="pr-player-v2__card-head">
              <h2>Rugby365 Value Score</h2>
            </div>
            <p style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0 0 0.35rem" }}>
              {vs.score != null ? Math.round(vs.score) : "—"}
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--pv2-muted)",
                  marginLeft: "0.25rem",
                }}
              >
                /100
              </span>
            </p>
            {overview.playerValue?.marketValueGbp != null ? (
              <p className="pr-player-v2__note">
                Est. market value £{(overview.playerValue.marketValueGbp / 1_000_000).toFixed(2)}m
              </p>
            ) : null}
            <p className="pr-player-v2__note">
              Status {vs.status.replace(/_/g, " ")} · coverage {Math.round(vs.coverage)}% · confidence{" "}
              {Math.round(vs.confidence)}% · model {vs.modelVersion}
            </p>
            {vs.factors.length > 0 ? (
              <div className="pr-player-v2__table-wrap" style={{ marginTop: "0.6rem" }}>
                <table className="pr-player-v2__table">
                  <thead>
                    <tr>
                      <th scope="col">Factor</th>
                      <th scope="col">Score</th>
                      <th scope="col">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vs.factors.map((f) => (
                      <tr key={f.key}>
                        <td>{f.label}</td>
                        <td>{f.score != null ? f.score.toFixed(0) : "—"}</td>
                        <td>{f.score != null ? `${f.weight.toFixed(0)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : marketFactors.length > 0 ? (
              <div className="pr-player-v2__bars" style={{ marginTop: "0.6rem" }}>
                {marketFactors.map((f) => (
                  <div key={f.key} className="pr-player-v2__bar-row">
                    <span>{f.label}</span>
                    <div className="pr-player-v2__bar-track">
                      <div
                        className={`pr-player-v2__bar-fill${f.pct < 0 ? " pr-player-v2__bar-fill--negative" : ""}`}
                        style={{ width: `${Math.min(100, Math.abs(f.pct) * 2)}%` }}
                      />
                    </div>
                    <span>
                      {f.pct > 0 ? "+" : ""}
                      {f.pct}%
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pr-player-v2__empty">Value Score factors not yet available.</p>
            )}
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Career Momentum</h2>
            </div>
            <p style={{ fontSize: "1.5rem", fontWeight: 900, margin: 0 }}>
              {i.form != null ? `${i.form.toFixed(1)}/10` : "—"}
            </p>
            <p className="pr-player-v2__note">
              Current form {overview.rating.formScore0to10 ?? "—"} · Potential{" "}
              {overview.potential.potential != null ? overview.potential.potential.toFixed(1) : "—"}
            </p>
            <PlayerRatingHistoryChart points={overview.ratingHistory} />
          </div>
        </div>

        <div className="pr-player-v2__row--2">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Intelligence Radar</h2>
            </div>
            <PlayerIntelligenceRadar intelligence={i} />
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Model Metrics</h2>
            </div>
            <div className="pr-player-v2__table-wrap">
              <table className="pr-player-v2__table">
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{r.value != null ? r.value.toFixed(1) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pr-player-v2__note">
              Model {i.modelVersion ?? "n/a"} · confidence {i.confidence ?? "—"}% · coverage{" "}
              {i.coverage ?? "—"}% · {i.dataPoints} matches sampled
            </p>
          </div>
        </div>

        <div className="pr-player-v2__row--2">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Classification</h2>
            </div>
            <p style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--pv2-gold)" }}>
              {overview.classification.label}
            </p>
            <p className="pr-player-v2__note">{overview.classification.stars.toFixed(1)} / 5 stars</p>
            {overview.classification.provisionalNote ? (
              <p className="pr-player-v2__note">{overview.classification.provisionalNote}</p>
            ) : null}
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Positions Played</h2>
            </div>
            {positions.length === 0 ? (
              <p className="pr-player-v2__empty">No position mix recorded yet.</p>
            ) : (
              <div className="pr-player-v2__table-wrap">
                <table className="pr-player-v2__table">
                  <thead>
                    <tr>
                      <th scope="col">Position</th>
                      <th scope="col">Apps</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.slice(0, 8).map((p) => (
                      <tr key={p.positionName}>
                        <td>{p.positionName}</td>
                        <td>{p.appearances}</td>
                        <td>{`${Math.round(p.usagePercent)}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <PlayerAiScoutSummaryCard
          slug={overview.slug}
          summary={overview.scoutSummary}
          strengths={overview.scoutStrengths}
          development={overview.scoutAreas}
          bestRole={overview.scoutBestRole}
          provisional={overview.scoutProvisional}
          recommendationLabel={overview.scoutIntelligence?.recommendationLabel ?? null}
          rriScore={overview.scoutIntelligence?.rriScore ?? null}
          rriBand={overview.scoutIntelligence?.rriBand ?? null}
        />

        {overview.comparison.right ? (
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Similar Players</h2>
            </div>
            <p>
              Closest rated peer:{" "}
              <Link href={`/players/${overview.comparison.right.slug}`}>
                {overview.comparison.right.name}
              </Link>
            </p>
            <p className="pr-player-v2__note">
              {overview.comparison.peerSubtitle} ·{" "}
              <Link href={overview.comparison.fullCompareHref}>Open full comparison →</Link>
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}
