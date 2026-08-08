import type { Metadata } from "next";
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
  return { title: `Honours | Coach | Rugby365`, description: `Honours and awards for ${slug}` };
}

export default async function CoachHonoursPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="honours" />
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Honours & awards</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
        </header>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Honours</h2>
          </div>
          {profile.honours.length === 0 ? (
            <p className="pr-coach-empty">No honours recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.honours.map((h) => (
                <li key={h.id}>
                  {h.year ?? "—"} · {h.competitionName ?? "Honour"}
                  {h.teamName ? ` — ${h.teamName}` : ""} ({h.achievementType}, {h.honourLevel})
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Awards</h2>
          </div>
          {profile.awards.length === 0 ? (
            <p className="pr-coach-empty">No awards recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.awards.map((a) => (
                <li key={a.id}>
                  {a.year ?? "—"} · {a.awardName}
                  {a.awardingBody ? ` (${a.awardingBody})` : ""} — {a.result}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Medals</h2>
          </div>
          {profile.medals.length === 0 ? (
            <p className="pr-coach-empty">No medals recorded.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.medals.map((m) => (
                <li key={m.id}>
                  {m.year ?? "—"} · {m.competitionName ?? "Medal"} — {m.finish} ({m.medalType})
                </li>
              ))}
            </ul>
          )}
        </section>

        {profile.milestones.length > 0 ? (
          <section className="pr-coach-card">
            <div className="pr-coach-card__head">
              <h2>Milestones</h2>
            </div>
            <ul className="pr-coach-list">
              {profile.milestones.map((m) => (
                <li key={m.id}>
                  {m.milestoneYear ?? m.milestoneDate ?? "—"} · {m.title}
                  {m.description ? ` — ${m.description}` : ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
