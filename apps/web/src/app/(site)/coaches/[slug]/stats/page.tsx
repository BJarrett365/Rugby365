import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";
import { getCoachCareerRecord } from "@/lib/coach-career-record-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Stats | Coach | Rugby365`, description: `Stats and ratings for ${slug}` };
}

export default async function CoachStatsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();

  const record = await getCoachCareerRecord(profile.id);
  const r = profile.ratings;

  return (
    <article className="pr-coach-profile">
      <CoachPublicSubNav slug={profile.slug} active="stats" />
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Stats & ratings</p>
          <h1 className="m-0 text-2xl font-bold">{profile.displayName}</h1>
        </header>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Career record</h2>
          </div>
          <ul className="pr-coach-list">
            <li>
              Played: {record.played} (W{record.wins} D{record.draws} L{record.losses})
            </li>
            <li>Win rate: {record.winRate != null ? `${record.winRate.toFixed(1)}%` : "—"}</li>
            <li>
              Points for / against: {record.pointsFor} / {record.pointsAgainst}
            </li>
            <li>
              PF/G · PA/G:{" "}
              {record.pointsForPerGame != null ? record.pointsForPerGame.toFixed(1) : "—"} ·{" "}
              {record.pointsAgainstPerGame != null
                ? record.pointsAgainstPerGame.toFixed(1)
                : "—"}
            </li>
            <li>
              Streaks: longest win {record.longestWinStreak}, current {record.currentWinStreak}
            </li>
            <li>Form: {record.form.length ? record.form.join(" ") : "—"}</li>
          </ul>
        </section>

        <section className="pr-coach-card mb-4">
          <div className="pr-coach-card__head">
            <h2>Ratings</h2>
          </div>
          <ul className="pr-coach-list">
            <li>Overall: {r.overallRating != null ? r.overallRating.toFixed(1) : "—"}</li>
            <li>Power index: {r.powerIndex != null ? r.powerIndex.toFixed(1) : "—"}</li>
            <li>World rank: {r.worldRank ?? "—"}</li>
            <li>Confidence: {r.dataConfidence}</li>
          </ul>
          {r.metrics.length > 0 ? (
            <ul className="pr-coach-list">
              {r.metrics.map((m) => (
                <li key={m.key}>
                  {m.label}: {m.score != null ? m.score.toFixed(1) : "—"}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>Impact</h2>
          </div>
          {!profile.impact.enoughData ? (
            <p className="pr-coach-empty">Not enough data for impact comparison.</p>
          ) : (
            <ul className="pr-coach-list">
              {profile.impact.rows.map((row) => (
                <li key={row.metric}>
                  {row.metric}: before {row.before ?? "—"} → under {row.under ?? "—"}
                  {row.change != null ? ` (${row.change})` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
