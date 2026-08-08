import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { CoachPlayingCareer } from "@/components/coaches/CoachPlayingCareer";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Career | Coach | Rugby365`, description: `Playing and coaching career for ${slug}` };
}

export default async function CoachCareerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  const cr = profile.careerRecord;

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="career" />
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Career</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
        </header>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Coaching record</h2>
          </div>
          <div className="pr-coach-stat-row">
            <div>
              <strong>{cr.played}</strong>
              <span>Played</span>
            </div>
            <div>
              <strong>{cr.wins}</strong>
              <span>Wins</span>
            </div>
            <div>
              <strong>{cr.draws}</strong>
              <span>Draws</span>
            </div>
            <div>
              <strong>{cr.losses}</strong>
              <span>Losses</span>
            </div>
            <div>
              <strong>{cr.winRate != null ? `${cr.winRate.toFixed(1)}%` : "—"}</strong>
              <span>Win rate</span>
            </div>
          </div>
          {cr.partial ? (
            <p className="pr-coach-empty">
              Partial career record{cr.notes ? `: ${cr.notes}` : "."}
            </p>
          ) : null}
        </section>

        <CoachPlayingCareer profile={profile} />
      </div>
    </article>
  );
}
