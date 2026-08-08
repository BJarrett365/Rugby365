import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
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

export default async function CoachHistoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="history" />
      <div className="pr-coach-grid" style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Coach history</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
        </header>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Playing stints</h2>
          </div>
          {profile.playingStints.length === 0 ? (
            <p className="pr-coach-empty">No playing stints recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.playingStints.map((s) => (
                <li key={s.id}>
                  <strong>{s.yearsLabel}</strong> — {s.teamName}
                  {s.position ? ` (${s.position})` : ""}
                  {s.apps != null ? ` · ${s.apps} apps` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Coaching assignments</h2>
          </div>
          {profile.assignments.length === 0 ? (
            <p className="pr-coach-empty">No coaching assignments recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.assignments.map((a) => (
                <li key={a.id}>
                  <Link href={`/teams/${a.teamSlug}`}>{a.teamName}</Link> — {a.roleLabel}
                  {a.isCurrent ? " (current)" : ""}
                  {a.startDate || a.endDate
                    ? ` · ${a.startDate ?? "?"} – ${a.endDate ?? "present"}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {profile.timeline.length > 0 ? (
          <section className="pr-coach-card">
            <div className="pr-coach-card__head">
              <h2>Timeline</h2>
            </div>
            <ul className="pr-coach-list">
              {profile.timeline.map((t) => (
                <li key={t.id}>
                  {t.yearsLabel} — {t.role} · {t.teamName}
                  {t.isCurrent ? " (current)" : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
