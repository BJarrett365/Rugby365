import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { PlayerIntelligenceRadar } from "@/components/players/PlayerIntelligenceRadar";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string; section?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Intelligence | Player | Rugby365`, description: `Rugby365 intelligence model for ${slug}` };
}

export default async function PlayerIntelligencePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: isPreviewParam(sp.preview) });
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
        <header>
          <p className="pr-player-v2__kicker">Rugby365 intelligence model</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{overview.displayName}</h1>
        </header>

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
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--pv2-muted)", marginLeft: "0.25rem" }}>
              /100
            </span>
          </p>
          <p className="pr-player-v2__note">
            Status {vs.status.replace(/_/g, " ")} · coverage {Math.round(vs.coverage)}% · confidence{" "}
            {Math.round(vs.confidence)}% · model {vs.modelVersion}
            {vs.calculatedAt ? ` · calculated ${vs.calculatedAt.slice(0, 10)}` : " · not yet calculated"}
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
          ) : (
            <p className="pr-player-v2__empty">
              Value Score not persisted yet — recalculate market value / value score in CMS.
            </p>
          )}
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
              <h2>Potential</h2>
            </div>
            <p style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>
              {overview.potential.potential != null ? overview.potential.potential.toFixed(1) : "—"}
            </p>
            <p className="pr-player-v2__note">
              Confidence {overview.potential.confidence}% — {overview.potential.note}
            </p>
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Classification</h2>
            </div>
            <p style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--pv2-gold)" }}>
              {overview.classification.label}
            </p>
            <p className="pr-player-v2__note">{overview.classification.stars.toFixed(1)} / 5 stars</p>
          </div>
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>AI Scout Summary</h2>
          </div>
          {overview.scoutSummary ? (
            <>
              <p className="pr-player-v2__scout-text">{overview.scoutSummary}</p>
              <p className="pr-player-v2__scout-meta">
                {overview.scoutIntelligence?.recommendationLabel ?? "—"} · RRI{" "}
                {overview.scoutIntelligence?.rriScore ?? "—"} ({overview.scoutIntelligence?.rriBand ?? "—"})
              </p>
            </>
          ) : (
            <p className="pr-player-v2__empty">AI scout summary not yet available for this player.</p>
          )}
        </div>
      </div>
    </article>
  );
}
