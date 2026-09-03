import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachProfileAssetImage } from "@/components/coaches/CoachProfileAssetImage";
import { CoachSubpageChrome } from "@/components/coaches/CoachSubpageChrome";
import { formatCoachResultDate } from "@/lib/coach-perspective-result";
import { formatPublicDate, isPreviewParam } from "@/lib/public-entity-profile-utils";
import { getPublicCoachProfile } from "@/lib/public-coach-profile-service";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicCoachProfile(slug, { preview: false });
  const name = profile?.displayName ?? slug;
  return { title: `Matches | ${name} | Rugby365`, description: `Match results for ${name}` };
}

function formatKickoffTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
}

function formatKickoffWeekday(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatPublicDate(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export default async function CoachMatchesPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicCoachProfile(slug, { preview: isPreviewParam(sp.preview) });
  if (!profile) notFound();
  const cr = profile.careerRecord;
  const upcoming = profile.upcomingMatch;

  return (
    <CoachSubpageChrome profile={profile} active="matches">
      {upcoming ? (
        <section className="pr-coach-card mb-4 pr-coach-upcoming">
          <div className="pr-coach-card__head">
            <h2>Upcoming match</h2>
          </div>
          <div className="pr-coach-upcoming__panel">
            <div className="pr-coach-upcoming__teams">
              <div className="pr-coach-upcoming__side">
                {upcoming.homeTeamCrestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={upcoming.homeTeamCrestUrl} alt="" width={56} height={56} />
                ) : (
                  <span className="pr-coach-upcoming__crest-fallback" aria-hidden />
                )}
                <div className="pr-coach-upcoming__team-name">{upcoming.homeTeamName ?? "TBC"}</div>
              </div>
              <div className="pr-coach-upcoming__vs">VS</div>
              <div className="pr-coach-upcoming__side">
                {upcoming.awayTeamCrestUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={upcoming.awayTeamCrestUrl} alt="" width={56} height={56} />
                ) : (
                  <span className="pr-coach-upcoming__crest-fallback" aria-hidden />
                )}
                <div className="pr-coach-upcoming__team-name">{upcoming.awayTeamName ?? "TBC"}</div>
              </div>
            </div>
            <div className="pr-coach-upcoming__facts">
              <div>
                <span>Date</span>
                <strong>{formatKickoffWeekday(upcoming.kickoffAt) ?? "Date TBC"}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{formatKickoffTime(upcoming.kickoffAt) ?? "TBC"}</strong>
              </div>
              <div>
                <span>Competition</span>
                <strong>{upcoming.competitionName ?? "—"}</strong>
              </div>
              <div>
                <span>Venue</span>
                <strong>{upcoming.venueName ?? "—"}</strong>
              </div>
            </div>
            <Link
              className="pr-coach-upcoming__cta"
              href={upcoming.href ?? `/matches/${upcoming.slug}`}
            >
              Match Centre
            </Link>
          </div>
        </section>
      ) : null}

      <section className="pr-coach-card mb-4">
        <div className="pr-coach-card__head">
          <h2>Recent results</h2>
          <Link className="pr-coach-card__link" href={`/coaches/${profile.slug}`}>
            View all results &gt;
          </Link>
        </div>
        {profile.recentMatches.length === 0 ? (
          <p className="pr-coach-empty">No recent matches.</p>
        ) : (
          <div className="pr-coach-match-table">
            <div className="pr-coach-match-table__head" aria-hidden>
              <span>Date</span>
              <span>Match</span>
              <span>Venue</span>
              <span>Score</span>
              <span>Result</span>
              <span>Attendance</span>
              <span>MOTM</span>
            </div>
            {profile.recentMatches.map((m) => {
              const inner = (
                <>
                  <time dateTime={m.kickoffAt ?? undefined}>{formatCoachResultDate(m.kickoffAt)}</time>
                  <span className="pr-coach-match-table__match">
                    {m.homeCrestUrl ? (
                      <CoachProfileAssetImage
                        src={m.homeCrestUrl}
                        className="pr-coach-recent-row__crest"
                        width={22}
                        height={22}
                        fallbackClassName="pr-coach-recent-row__crest-fallback"
                      />
                    ) : (
                      <span className="pr-coach-recent-row__crest-fallback" aria-hidden />
                    )}
                    <span>
                      {m.homeTeamName ?? "—"}
                      <span className="pr-coach-match-table__arrow"> → </span>
                      {m.awayTeamName ?? "—"}
                    </span>
                    {m.awayCrestUrl ? (
                      <CoachProfileAssetImage
                        src={m.awayCrestUrl}
                        className="pr-coach-recent-row__crest"
                        width={22}
                        height={22}
                        fallbackClassName="pr-coach-recent-row__crest-fallback"
                      />
                    ) : (
                      <span className="pr-coach-recent-row__crest-fallback" aria-hidden />
                    )}
                  </span>
                  <span>{m.venueName ?? m.venueType ?? "—"}</span>
                  <span>
                    {m.pointsFor != null && m.pointsAgainst != null
                      ? `${m.pointsFor}–${m.pointsAgainst}`
                      : "—"}
                  </span>
                  <span className={`pr-coach-recent-row__badge ${m.result ? `is-${m.result.toLowerCase()}` : ""}`}>
                    {m.result ?? "—"}
                  </span>
                  <span>{m.attendance != null && m.attendance > 0 ? m.attendance.toLocaleString() : "—"}</span>
                  <span>{m.manOfTheMatch ?? "—"}</span>
                </>
              );
              return m.href ? (
                <Link key={m.id} href={m.href} className="pr-coach-match-table__row">
                  {inner}
                </Link>
              ) : (
                <div key={m.id} className="pr-coach-match-table__row">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="pr-coach-stats__footer">
        <div>
          <span>Matches</span>
          <strong>{cr.played}</strong>
        </div>
        <div>
          <span>Won</span>
          <strong>{cr.wins}</strong>
        </div>
        <div>
          <span>Lost</span>
          <strong>{cr.losses}</strong>
        </div>
        <div>
          <span>Win rate</span>
          <strong>{cr.winRate != null ? `${cr.winRate}%` : "0"}</strong>
        </div>
        <div>
          <span>Points for</span>
          <strong>{cr.pointsFor.toLocaleString()}</strong>
        </div>
        <div>
          <span>Points against</span>
          <strong>{cr.pointsAgainst.toLocaleString()}</strong>
        </div>
        <div>
          <span>Trophies won</span>
          <strong>{profile.majorHonoursCount}</strong>
        </div>
      </div>
    </CoachSubpageChrome>
  );
}
