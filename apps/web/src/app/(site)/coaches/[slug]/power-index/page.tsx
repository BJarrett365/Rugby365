import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachMetricBreakdownTable } from "@/components/coaches/CoachMetricBreakdownTable";
import { CoachPublicBreadcrumb } from "@/components/coaches/CoachPublicBreadcrumb";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { CoachRatingTrendsCard } from "@/components/coaches/CoachRatingTrendsCard";
import { listCoachPowerIndexRankings } from "@/lib/coach-rating-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicCoachProfile(slug, { preview: false });
  const name = profile?.displayName ?? slug;
  return {
    title: `${name} · Power Index | Rugby365`,
    description: `Current coaching strength for ${name} — Power Index breakdown and history.`,
  };
}

export default async function CoachPowerIndexDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  const r = profile.ratings;
  const detail = r.powerIndexDetail;
  const board = await listCoachPowerIndexRankings(200);
  const self = board.find((row) => row.coachId === profile.id);
  const worldPowerRank = self?.rank ?? null;
  const worldPowerOutOf = board.length || null;

  const inputRows = (detail?.contributions ?? []).map((c) => ({
    key: c.key,
    label: c.label,
    score: c.score,
    weight: c.weight,
    contribution: c.contribution,
    trend: c.trend,
    confidence: c.confidence,
  }));

  const modifierRows = (detail?.modifiers ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    score: m.sourceScore,
    weight: null,
    contribution: m.effect,
    trend: null,
    confidence: null,
    change: m.effect,
  }));

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="stats" />
      <div className="pr-coach-inner">
        <CoachPublicBreadcrumb
          items={[
            { label: "Coach Profile", href: `/coaches/${profile.slug}` },
            { label: "Power Index" },
          ]}
        />

        <header className="pr-coach-inner__header">
          <p className="pr-coach-card__kicker m-0">POWER INDEX</p>
          <h1 className="pr-coach-inner__title">{profile.displayName}</h1>
          <p className="pr-coach-inner__lede">
            Current coaching strength based mainly on recent performances — separate from overall
            Rugby365 Coach Rating quality.
          </p>
        </header>

        <section className="pr-coach-card pr-coach-rating-hero">
          <div className="pr-coach-rating-hero__score">
            <div className="pr-coach-rating-hero__value pr-coach-kpi__value--green">
              {r.powerIndex != null ? Math.round(r.powerIndex) : "—"}
            </div>
            <div className="pr-coach-rating-hero__label">Current Power Index</div>
            <div className="pr-coach-muted">
              {r.powerIndexChange == null || r.powerIndexChange === 0
                ? "Unchanged vs previous"
                : r.powerIndexChange > 0
                  ? `↑ +${r.powerIndexChange} vs previous`
                  : `↓ ${r.powerIndexChange} vs previous`}
            </div>
          </div>
          <dl className="pr-coach-rating-hero__meta">
            <div>
              <dt>Previous</dt>
              <dd>{r.previousPowerIndex != null ? Math.round(r.previousPowerIndex) : "—"}</dd>
            </div>
            <div>
              <dt>World Power Rank</dt>
              <dd>
                {worldPowerRank != null ? (
                  <Link href="/coaches/power-index">#{worldPowerRank}</Link>
                ) : (
                  "—"
                )}
                {worldPowerOutOf != null ? (
                  <span className="pr-coach-muted"> / {worldPowerOutOf}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Coach Rating</dt>
              <dd>
                {r.overallRating != null ? (
                  <Link href={`/coaches/${profile.slug}/rating`}>
                    {r.overallRating.toFixed(1)}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{detail?.confidence != null ? `${detail.confidence}%` : "—"}</dd>
            </div>
            <div>
              <dt>Matches Used</dt>
              <dd>{detail?.matchesUsed ?? r.matchCount ?? "—"}</dd>
            </div>
            <div>
              <dt>Competition Rank</dt>
              <dd>
                {r.competitionRank != null ? `#${r.competitionRank}` : "—"}
                {r.competitionRankedOutOf != null ? (
                  <span className="pr-coach-muted"> / {r.competitionRankedOutOf}</span>
                ) : null}
              </dd>
            </div>
          </dl>
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Power Index Inputs</h2>
            <Link className="pr-coach-card__link" href="/coaches/power-index">
              Full leaderboard &gt;
            </Link>
          </div>
          <CoachMetricBreakdownTable rows={inputRows} showConfidence />
        </section>

        {modifierRows.length ? (
          <section className="pr-coach-card">
            <div className="pr-coach-card__head">
              <h2>Modifiers</h2>
            </div>
            <CoachMetricBreakdownTable rows={modifierRows} showChange />
            <p className="pr-coach-muted" style={{ marginTop: "0.75rem" }}>
              Modifier total:{" "}
              {detail!.modifierTotal > 0
                ? `+${detail!.modifierTotal}`
                : detail!.modifierTotal}
            </p>
          </section>
        ) : null}

        <div className="pr-coach-card--block">
          <CoachRatingTrendsCard slug={profile.slug} initial={profile.ratingTrends} compact={false} />
        </div>

        <p className="pr-coach-inner__compare">
          <Link className="pr-coach-profile__btn" href={`/coaches/compare?a=${profile.slug}`}>
            Compare Coach
          </Link>
        </p>
      </div>
    </article>
  );
}
