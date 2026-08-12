import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { CareerTimelineBadge, careerBadgeKindFromTimeline } from "@/components/coaches/CareerTimelineBadge";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `History | Coach | Rugby365`, description: `Career history for ${slug}` };
}

function yearsForAssignment(a: {
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}): string {
  const start = a.startDate?.slice(0, 4);
  const end = a.endDate?.slice(0, 4);
  if (start && end) return `${start}–${end}`;
  if (start && a.isCurrent) return `${start}–`;
  return start || "—";
}

export default async function CoachHistoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  const playing = profile.playingStints;
  const technicalManagement = profile.assignments.filter(
    (a) =>
      a.careerType === "technical" ||
      a.careerType === "management" ||
      a.role === "director_of_rugby" ||
      a.role === "technical_adviser" ||
      a.role === "technical_specialist",
  );
  const coachingOnly = profile.assignments.filter((a) => {
    if (a.careerType === "technical" || a.careerType === "management") return false;
    if (
      a.role === "director_of_rugby" ||
      a.role === "technical_adviser" ||
      a.role === "technical_specialist"
    ) {
      return false;
    }
    return true;
  });

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="history" />
      <div className="pr-coach-grid" style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Full career history</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
          <p className="pr-coach-empty m-0 mt-2">
            Verified and editor-approved records only. Overview shows selected milestones.
          </p>
        </header>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Playing career</h2>
          </div>
          {playing.length === 0 ? (
            <p className="pr-coach-empty">No playing stints recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {playing.map((s) => (
                <li key={s.id} className="pr-coach-history-row">
                  <CareerTimelineBadge
                    teamName={s.teamName}
                    crestUrl={null}
                    kind={
                      s.teamType === "international" || s.careerType === "international_player"
                        ? "international_player"
                        : "player"
                    }
                  />
                  <div>
                    <strong>{s.yearsLabel}</strong> — {s.teamName}
                    {s.position ? ` (${s.position})` : ""}
                    {s.apps != null ? ` · ${s.apps} apps` : ""}
                    {s.points != null ? ` · ${s.points} pts` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Coaching career</h2>
          </div>
          {coachingOnly.length === 0 ? (
            <p className="pr-coach-empty">No coaching assignments recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {coachingOnly.map((a) => (
                <li key={a.id} className="pr-coach-history-row">
                  <CareerTimelineBadge
                    teamName={a.teamName}
                    kind={careerBadgeKindFromTimeline({
                      careerType: a.careerType,
                      role: a.roleLabel,
                    })}
                    isCurrent={a.isCurrent}
                  />
                  <div>
                    <strong>{yearsForAssignment(a)}</strong> —{" "}
                    <Link href={`/teams/${a.teamSlug}`}>{a.teamName}</Link> · {a.roleLabel}
                    {a.isCurrent ? " (current)" : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Technical / management</h2>
          </div>
          {technicalManagement.length === 0 ? (
            <p className="pr-coach-empty">No technical or management roles recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {technicalManagement.map((a) => (
                <li key={a.id} className="pr-coach-history-row">
                  <CareerTimelineBadge
                    teamName={a.teamName}
                    kind={careerBadgeKindFromTimeline({
                      careerType: a.careerType,
                      role: a.roleLabel,
                    })}
                    isCurrent={a.isCurrent}
                    roleMarker={a.role === "director_of_rugby" ? "DoR" : null}
                  />
                  <div>
                    <strong>{yearsForAssignment(a)}</strong> —{" "}
                    <Link href={`/teams/${a.teamSlug}`}>{a.teamName}</Link> · {a.roleLabel}
                    {a.isCurrent ? " (current)" : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Milestones</h2>
          </div>
          {profile.milestones.length === 0 ? (
            <p className="pr-coach-empty">No milestones recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.milestones.map((m) => (
                <li key={m.id}>
                  <strong>{m.milestoneYear ?? "—"}</strong> — {m.title}
                  {m.description ? ` · ${m.description}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Honours</h2>
            <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}/honours`}>
              View all honours &gt;
            </Link>
          </div>
          {profile.honours.length === 0 && profile.awards.length === 0 ? (
            <p className="pr-coach-empty">No honours recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.honours.slice(0, 12).map((h) => (
                <li key={h.id}>
                  <strong>{h.year ?? "—"}</strong> — {h.competitionName ?? "Honour"}
                  {h.teamName ? ` · ${h.teamName}` : ""}
                </li>
              ))}
              {profile.awards.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <strong>{a.year ?? "—"}</strong> — {a.awardName}
                  {a.awardingBody ? ` · ${a.awardingBody}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
