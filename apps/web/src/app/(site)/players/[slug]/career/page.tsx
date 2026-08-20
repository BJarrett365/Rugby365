import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayerPublicSubNav } from "@/components/players/PlayerPublicSubNav";
import { PlayerPublicBreadcrumb } from "@/components/players/PlayerPublicBreadcrumb";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import { isPreviewParam } from "@/lib/public-entity-profile-utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Career | Player | Rugby365`, description: `Career history for ${slug}` };
}

export default async function PlayerCareerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const overview = await getPublicPlayerOverviewV2(slug, { preview: isPreviewParam(sp.preview) });
  if (!overview) notFound();

  return (
    <article className="pr-player-v2">
      <PlayerPublicBreadcrumb
        items={[
          { label: "Players", href: "/players" },
          { label: overview.displayName, href: `/players/${overview.slug}` },
          { label: "Career" },
        ]}
      />
      <PlayerPublicSubNav slug={overview.slug} active="career" />

      <div className="pr-player-v2__grid" style={{ paddingTop: "0.75rem" }}>
        <header>
          <p className="pr-player-v2__kicker">Career history</p>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{overview.displayName}</h1>
        </header>

        <div className="pr-player-v2__row--2">
          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>Club History</h2>
            </div>
            {overview.clubHistory.length === 0 ? (
              <p className="pr-player-v2__empty">No club history recorded yet.</p>
            ) : (
              <ul className="pr-player-v2__achievements">
                {overview.clubHistory.map((c, i) => (
                  <li key={`${c.teamName}-${i}`} className="pr-player-v2__achievement-row">
                    <strong>{c.yearsLabel}</strong>
                    <span>{c.teamName}</span>
                    {c.apps != null ? <span>· {c.apps} apps</span> : null}
                    {c.points != null ? <span>· {c.points} pts</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pr-player-v2__card">
            <div className="pr-player-v2__card-head">
              <h2>International History</h2>
            </div>
            {overview.internationalHistory.length === 0 ? (
              <p className="pr-player-v2__empty">No international history recorded yet.</p>
            ) : (
              <ul className="pr-player-v2__achievements">
                {overview.internationalHistory.map((c, i) => (
                  <li key={`${c.teamName}-${i}`} className="pr-player-v2__achievement-row">
                    <strong>{c.yearsLabel}</strong>
                    <span>{c.teamName}</span>
                    {c.apps != null ? <span>· {c.apps} apps</span> : null}
                    {c.points != null ? <span>· {c.points} pts</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="pr-player-v2__note">
              Verified caps: {overview.verifiedInternationalCaps ?? "—"} · Verified points:{" "}
              {overview.verifiedInternationalPoints ?? "—"} · Linked appearances:{" "}
              {overview.linkedInternationalCaps}
            </p>
          </div>
        </div>

        <div className="pr-player-v2__card" id="honours">
          <div className="pr-player-v2__card-head">
            <h2>Honours &amp; Achievements</h2>
          </div>
          {overview.achievements.length === 0 ? (
            <p className="pr-player-v2__empty">No achievements recorded yet.</p>
          ) : (
            <ul className="pr-player-v2__achievements">
              {overview.achievements.map((a) => (
                <li key={a.id} className="pr-player-v2__achievement-row">
                  <strong>{a.year ?? "—"}</strong>
                  <span>{a.title}</span>
                  {a.detail ? <span>· {a.detail}</span> : null}
                  {a.verificationStatus !== "verified" ? (
                    <span className="pr-player-v2__achievement-note">
                      {a.verificationStatus === "title_record"
                        ? "Title record"
                        : a.verificationStatus === "review"
                          ? "Pending verification"
                          : "Unverified"}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pr-player-v2__card">
          <div className="pr-player-v2__card-head">
            <h2>Contract &amp; Representation</h2>
          </div>
          <dl className="pr-player-v2__facts" style={{ borderTop: "none", paddingTop: 0 }}>
            <div className="pr-player-v2__fact">
              <dt>Contract Expires</dt>
              <dd>{overview.contract.expiresLabel ?? "—"}</dd>
            </div>
            <div className="pr-player-v2__fact">
              <dt>Reported Salary</dt>
              <dd>{overview.contract.reportedSalaryLabel ?? "—"}</dd>
            </div>
            <div className="pr-player-v2__fact">
              <dt>Agent</dt>
              <dd>{overview.agent?.name ?? "—"}</dd>
            </div>
            <div className="pr-player-v2__fact">
              <dt>Agency</dt>
              <dd>{overview.agent?.agency ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </article>
  );
}
