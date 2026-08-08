import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { formatPublicKickoff, isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Matches | Coach | Rugby365`, description: `Match results for ${slug}` };
}

export default async function CoachMatchesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="matches" />
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Matches</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
        </header>

        {profile.upcomingMatch ? (
          <section className="pr-coach-card mb-4">
            <div className="pr-coach-card__head">
              <h2>Upcoming</h2>
            </div>
            <Link href={`/matches/${profile.upcomingMatch.slug}`} className="pr-coach-result-row">
              <span>
                {profile.upcomingMatch.homeTeamName} vs {profile.upcomingMatch.awayTeamName}
              </span>
              <span>
                {formatPublicKickoff(profile.upcomingMatch.kickoffAt) ?? "TBC"}
                {profile.upcomingMatch.competitionName
                  ? ` · ${profile.upcomingMatch.competitionName}`
                  : ""}
              </span>
            </Link>
          </section>
        ) : null}

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Recent results</h2>
          </div>
          {profile.recentMatches.length === 0 ? (
            <p className="pr-coach-empty">No recent matches.</p>
          ) : (
            <div>
              {profile.recentMatches.map((m) => (
                <Link key={m.id} href={`/matches/${m.slug}`} className="pr-coach-result-row">
                  <span>
                    {m.homeTeamName} {m.homeScore}–{m.awayScore} {m.awayTeamName}
                    {m.result ? ` (${m.result})` : ""}
                  </span>
                  <span>
                    {formatPublicKickoff(m.kickoffAt) ?? ""}
                    {m.competitionName ? ` · ${m.competitionName}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
