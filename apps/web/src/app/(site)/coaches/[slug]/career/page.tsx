import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachPlayingCareer } from "@/components/coaches/CoachPlayingCareer";
import { CoachSquadDashboard } from "@/components/coaches/CoachSquadDashboard";
import { CoachSubpageChrome } from "@/components/coaches/CoachSubpageChrome";
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
  return { title: `Career | ${name} | Rugby365`, description: `Playing and coaching career for ${name}` };
}

export default async function CoachCareerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();
  const cr = profile.careerRecord;
  const teamHref = profile.teamDashboard ? `/teams/${profile.teamDashboard.teamSlug}` : `/coaches/${profile.slug}`;

  return (
    <CoachSubpageChrome profile={profile} active="career">
      <section className="pr-coach-card mb-4">
        <div className="pr-coach-card__head">
          <h2>Coaching record</h2>
        </div>
        <div className="pr-coach-stats__footer" style={{ margin: 0 }}>
          <div>
            <span>Played</span>
            <strong>{cr.played}</strong>
          </div>
          <div>
            <span>Wins</span>
            <strong>{cr.wins}</strong>
          </div>
          <div>
            <span>Draws</span>
            <strong>{cr.draws}</strong>
          </div>
          <div>
            <span>Losses</span>
            <strong>{cr.losses}</strong>
          </div>
          <div>
            <span>Win rate</span>
            <strong>{cr.winRate != null ? `${cr.winRate}%` : "0"}</strong>
          </div>
        </div>
        {cr.partial ? (
          <p className="pr-coach-empty">
            Partial career record{cr.notes ? `: ${cr.notes}` : "."}
          </p>
        ) : null}
      </section>

      {profile.teamDashboard ? (
        <CoachSquadDashboard dashboard={profile.teamDashboard} teamHref={teamHref} />
      ) : (
        <p className="pr-coach-empty">No current squad intelligence linked to this coach yet.</p>
      )}

      <div style={{ marginTop: "0.85rem" }}>
        <CoachPlayingCareer profile={profile} />
      </div>
    </CoachSubpageChrome>
  );
}
