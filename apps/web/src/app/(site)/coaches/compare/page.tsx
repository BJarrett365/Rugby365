import type { Metadata } from "next";
import Link from "next/link";
import { CoachPublicSubNav } from "@/components/coaches/CoachPublicSubNav";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  searchParams: Promise<{ a?: string; b?: string; preview?: string }>;
};

export const metadata: Metadata = {
  title: "Compare coaches | Rugby365",
  description: "Head-to-head coach comparison — career record and ratings.",
};

export default async function CompareCoachesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const slugA = sp.a?.trim() || "";
  const slugB = sp.b?.trim() || "";
  const preview = sp.preview === "1";

  const [coachA, coachB] = await Promise.all([
    slugA ? getPublicCoachProfile(slugA, { preview }) : Promise.resolve(null),
    slugB ? getPublicCoachProfile(slugB, { preview }) : Promise.resolve(null),
  ]);

  return (
    <article className="pr-coach-profile">
      {coachA ? <CoachPublicSubNav slug={coachA.slug} active="h2h" /> : null}
      <div style={{ padding: "1.25rem" }}>
        <header className="mb-4">
          <p className="pr-coach-card__kicker m-0">Compare coaches</p>
          <h1 className="m-0 text-2xl font-bold">Head-to-head</h1>
          <p className="text-sm text-[var(--cp-muted,#9ca3af)] mt-1 mb-0">
            Pass coach slugs as <code>?a=slug&amp;b=slug</code>.
          </p>
        </header>

        <form className="pr-coach-card mb-4" method="get">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-[var(--cp-muted)]">Coach A slug</span>
              <input
                className="cms-input w-full mt-1"
                name="a"
                defaultValue={slugA}
                placeholder="e.g. rassie-erasmus"
              />
            </label>
            <label className="block">
              <span className="text-sm text-[var(--cp-muted)]">Coach B slug</span>
              <input
                className="cms-input w-full mt-1"
                name="b"
                defaultValue={slugB}
                placeholder="e.g. andy-farrell"
              />
            </label>
          </div>
          <button type="submit" className="pr-coach-profile__btn pr-coach-profile__btn--primary mt-3">
            Compare
          </button>
        </form>

        <div className="grid gap-4 sm:grid-cols-2">
          {[coachA, coachB].map((coach, i) => (
            <section key={i} className="pr-coach-card">
              <div className="pr-coach-card__head">
                <h2>{coach ? coach.displayName : i === 0 ? "Coach A" : "Coach B"}</h2>
              </div>
              {!coach ? (
                <p className="pr-coach-empty">
                  {i === 0 ? (slugA ? "Not found." : "Select coach A.") : slugB ? "Not found." : "Select coach B."}
                </p>
              ) : (
                <ul className="pr-coach-list">
                  <li>
                    <Link href={`/coaches/${coach.slug}`}>View profile</Link>
                  </li>
                  <li>Nationality: {coach.nationality ?? "—"}</li>
                  <li>
                    Record: {coach.careerRecord.played} P · {coach.careerRecord.wins} W ·{" "}
                    {coach.careerRecord.winRate != null
                      ? `${coach.careerRecord.winRate.toFixed(1)}%`
                      : "—"}
                  </li>
                  <li>
                    Rating:{" "}
                    {coach.ratings.overallRating != null
                      ? coach.ratings.overallRating.toFixed(1)
                      : "—"}
                  </li>
                  <li>Power: {coach.ratings.powerIndex != null ? coach.ratings.powerIndex.toFixed(1) : "—"}</li>
                  <li>World rank: {coach.ratings.worldRank ?? "—"}</li>
                  <li>
                    Current:{" "}
                    {coach.currentRole
                      ? `${coach.currentRole.roleLabel} · ${coach.currentRole.teamName}`
                      : "—"}
                  </li>
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
