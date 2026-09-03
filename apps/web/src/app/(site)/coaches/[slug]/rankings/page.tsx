import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { R365RadarChart } from "@/components/charts/R365RadarChart";
import { CoachRatingTrendsCard } from "@/components/coaches/CoachRatingTrendsCard";
import { CoachSubpageChrome } from "@/components/coaches/CoachSubpageChrome";
import {
  MovementCell,
  RankNumber,
  RankingsAvatar,
  RatingValue,
} from "@/components/rankings/RankingsBoardPrimitives";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";
import { COACH_NATION_NAME } from "@/lib/coach-career-visibility";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicCoachProfile(slug, { preview: false });
  const name = profile?.displayName ?? slug;
  return { title: `Rankings | ${name} | Rugby365`, description: `Rankings and rating history for ${name}` };
}

export default async function CoachRankingsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();
  const r = profile.ratings;
  const intelligence = r.intelligence?.length ? r.intelligence : r.metrics;
  const scored = intelligence.filter((m) => m.score != null);
  const axes = scored.map((m) => ({ key: m.key, label: m.label }));
  const values = scored.map((m) => m.score);
  const rows = profile.worldRankings.slice(0, 15);

  return (
    <CoachSubpageChrome profile={profile} active="rankings">
      <div className="pr-coach-row pr-coach-row--3 pr-coach-rank-widgets">
        <section className="pr-coach-card">
          <div className="pr-coach-card__head">
            <h2>World ranking</h2>
          </div>
          <p className="pr-coach-stats__big">{r.worldRank != null ? `#${r.worldRank}` : "—"}</p>
          <p className="pr-coach-empty">
            Overall rating {r.overallRating != null ? r.overallRating.toFixed(1) : "—"} / 100
          </p>
          <p className="pr-coach-empty">
            {r.rankedOutOf != null ? `of ${r.rankedOutOf} eligible coaches` : "World board"}
          </p>
        </section>
        <section className="pr-coach-card pr-coach-card--fill">
          <div className="pr-coach-card__head">
            <h2>Performance radar</h2>
          </div>
          {axes.length === 0 ? (
            <p className="pr-coach-empty">No intelligence metrics yet.</p>
          ) : (
            <R365RadarChart
              axes={axes}
              series={[
                {
                  id: "coach",
                  label: profile.displayName,
                  values,
                  color: "#22c55e",
                  fillOpacity: 0.28,
                },
              ]}
              drawPolygon
              showScoreLabels
            />
          )}
        </section>
        <CoachRatingTrendsCard slug={profile.slug} initial={profile.ratingTrends} compact />
      </div>

      <section className="pr-coach-card" style={{ marginTop: "0.85rem" }}>
        <div className="pr-coach-card__head">
          <h2>World top coaches</h2>
          <Link className="pr-coach-card__link" href="/rankings/coaches">
            Full board &gt;
          </Link>
        </div>
        {rows.length === 0 ? (
          <p className="pr-coach-empty">Rankings appear once coaches have a published rating.</p>
        ) : (
          <table className="pr-coach-rank-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Coach</th>
                <th>Team</th>
                <th>Rating</th>
                <th>Move</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.coachId} className={row.coachId === profile.id ? "is-self" : undefined}>
                  <td>
                    <RankNumber rank={row.rank} />
                  </td>
                  <td>
                    <Link href={`/coaches/${row.slug}`} className="pr-coach-rank-table__coach">
                      <RankingsAvatar src={row.imageUrl} name={row.name} />
                      {row.name}
                    </Link>
                  </td>
                  <td>{row.currentTeamName?.trim() || "—"}</td>
                  <td>
                    <RatingValue value={row.rating} />
                  </td>
                  <td>
                    <MovementCell
                      rank={row.rank}
                      movement={
                        row.rankChange == null || row.rankChange === 0
                          ? "flat"
                          : row.rankChange > 0
                            ? "up"
                            : "down"
                      }
                      previousRank={row.previousRank}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="pr-coach-stats__footer" style={{ marginTop: "0.85rem" }}>
        <div>
          <span>Coaching experience</span>
          <strong>
            {profile.coachingCareerStartYear
              ? `${Math.max(1, new Date().getFullYear() - profile.coachingCareerStartYear)}+ Years`
              : "—"}
          </strong>
        </div>
        <div>
          <span>Teams coached</span>
          <strong>{new Set(profile.assignments.map((a) => a.teamId)).size || "—"} Teams</strong>
        </div>
        <div>
          <span>Countries coached</span>
          <strong>
            {new Set(profile.assignments.map((a) => a.teamName).filter((n) => COACH_NATION_NAME.test(n.toLowerCase()))).size || 1}{" "}
            Country
          </strong>
        </div>
        <div>
          <span>Trophies won</span>
          <strong>{profile.majorHonoursCount || profile.honours.length || "—"} Trophies</strong>
        </div>
      </div>
    </CoachSubpageChrome>
  );
}
