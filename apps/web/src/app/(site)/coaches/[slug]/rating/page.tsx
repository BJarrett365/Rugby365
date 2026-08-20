import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachMetricBreakdownTable } from "@/components/coaches/CoachMetricBreakdownTable";
import { CoachPublicBreadcrumb } from "@/components/coaches/CoachPublicBreadcrumb";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { CoachRatingTrendsCard } from "@/components/coaches/CoachRatingTrendsCard";
import { CoachWhyRatingPanel } from "@/components/coaches/CoachWhyRatingPanel";
import {
  explainCoachRating,
  formatCoachStars,
} from "@/lib/coach-rating-explain";
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
    title: `${name} · Rugby365 Coach Rating | Rugby365`,
    description: `Why ${name} has their Rugby365 Coach Rating — breakdown, trends and Coach Intelligence.`,
  };
}

export default async function CoachRatingDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  const r = profile.ratings;
  const detail = r.coachRatingDetail;
  const contributions = detail?.contributions ?? [];
  const explanation = explainCoachRating({
    overallRating: r.overallRating,
    contributions,
    coverage: detail?.weightedCoverage ?? null,
  });
  const intelligence = r.intelligence?.length ? r.intelligence : r.metrics;
  const updatedLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="stats" />
      <div className="pr-coach-inner">
        <CoachPublicBreadcrumb
          items={[
            { label: "Coach Profile", href: `/coaches/${profile.slug}` },
            { label: "Rating" },
          ]}
        />

        <header className="pr-coach-inner__header">
          <p className="pr-coach-card__kicker m-0">RUGBY365 COACH RATING</p>
          <h1 className="pr-coach-inner__title">{profile.displayName}</h1>
          <p className="pr-coach-inner__lede">
            Overall coach quality — not the same as current Power Index strength.
          </p>
        </header>

        <section className="pr-coach-card pr-coach-rating-hero">
          <div className="pr-coach-rating-hero__score">
            <div className="pr-coach-rating-hero__value">
              {r.overallRating != null ? r.overallRating.toFixed(1) : "—"}
            </div>
            <div className="pr-coach-rating-hero__stars">{formatCoachStars(r.overallRating)}</div>
            <div className="pr-coach-rating-hero__label">Rugby365 Coach Rating</div>
          </div>
          <dl className="pr-coach-rating-hero__meta">
            <div>
              <dt>World Rank</dt>
              <dd>
                {r.worldRank != null ? (
                  <Link href="/rankings/coaches">#{r.worldRank}</Link>
                ) : (
                  "—"
                )}
                {r.rankedOutOf != null ? (
                  <span className="pr-coach-muted"> / {r.rankedOutOf}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Power Index</dt>
              <dd>
                {r.powerIndex != null ? (
                  <Link href={`/coaches/${profile.slug}/power-index`}>
                    {Math.round(r.powerIndex)}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>
                {detail?.confidence != null
                  ? `${detail.confidence}%`
                  : r.ratingConfidencePct != null
                    ? `${r.ratingConfidencePct}%`
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>{updatedLabel}</dd>
            </div>
          </dl>
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Coach Rating Breakdown</h2>
          </div>
          <CoachMetricBreakdownTable
            rows={contributions.map((c) => ({
              key: c.key,
              label: c.label,
              score: c.score,
              weight: c.weight,
              contribution: c.contribution,
              trend: null,
            }))}
          />
        </section>

        <CoachWhyRatingPanel explanation={explanation} />

        <div id="rating-trends" className="pr-coach-card--block">
          <CoachRatingTrendsCard slug={profile.slug} initial={profile.ratingTrends} compact={false} />
        </div>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Coach Intelligence</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/stats`}>
              Full stats &gt;
            </Link>
          </div>
          {intelligence.length === 0 ? (
            <p className="pr-coach-empty">No intelligence metrics yet.</p>
          ) : (
            <div className="pr-coach-intel">
              <div className="pr-coach-intel__cols">
                <span>Metric</span>
                <span>Rating</span>
                <span>World Rank</span>
              </div>
              <div className="pr-coach-intel__list">
                {intelligence.map((m) => (
                  <div className="pr-coach-intel__row" key={m.key}>
                    <div className="pr-coach-intel__name">{m.label}</div>
                    <div className="pr-coach-intel__score">
                      {m.score != null ? Math.round(m.score) : "—"}
                    </div>
                    <div className="pr-coach-intel__rank">
                      {m.worldRank != null ? `#${m.worldRank}` : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
