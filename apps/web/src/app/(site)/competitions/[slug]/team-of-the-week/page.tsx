import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamOfWeekView } from "@/components/competitions/TeamOfWeekView";
import { getCompetitionBySlug, listSeasonsForPicker } from "@/lib/competition-admin-service";
import {
  getTeamOfWeekEditionBundle,
  listPublishedEditionsForCompetition,
} from "@/lib/team-of-week-service";
import { presentTeamOfWeekBundle } from "@/lib/team-of-week-public";
import "@/styles/team-of-week.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  return {
    title: competition
      ? `${competition.name} Team of the Week · Rugby365`
      : "Team of the Week · Rugby365",
    description: competition
      ? `Rugby365 Team of the Week archive for ${competition.name} — best XV, impact bench and round awards.`
      : "Rugby365 Team of the Week",
  };
}

export default async function TeamOfWeekArchivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const [editions, seasons] = await Promise.all([
    listPublishedEditionsForCompetition(competition.id),
    listSeasonsForPicker(competition.id),
  ]);

  const latest = editions[0];
  let latestView = null;
  if (latest) {
    const bundle = await getTeamOfWeekEditionBundle(latest.id);
    if (bundle) latestView = presentTeamOfWeekBundle(bundle);
  }

  const bySeason = new Map<string, typeof editions>();
  for (const ed of editions) {
    const key = ed.seasonLabel || String(ed.seasonYear ?? "Season");
    const list = bySeason.get(key) ?? [];
    list.push(ed);
    bySeason.set(key, list);
  }

  return (
    <div>
      <p className="text-sm text-[var(--pr-grey,#9aa)] mt-3 mb-2">
        Round-based Team of the Week — published editions only. Generate and publish from{" "}
        <Link href="/admin/team-of-the-week">Admin → Team of the Week</Link>.
      </p>

      {latestView ? (
        <TeamOfWeekView data={latestView} />
      ) : (
        <section className="totw">
          <div className="totw-empty">
            <h2 className="totw__title" style={{ fontSize: "1.25rem" }}>
              No published Team of the Week yet
            </h2>
            <p>
              When a round is complete, generate the XV in the CMS and publish it. Seasons
              available:{" "}
              {seasons
                .slice(0, 5)
                .map((s) => s.label)
                .join(", ") || "none loaded"}
              .
            </p>
          </div>
        </section>
      )}

      {editions.length > 0 ? (
        <div className="totw-archive" style={{ marginTop: "1.5rem" }}>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Archive</h3>
          {[...bySeason.entries()].map(([label, rows]) => (
            <div key={label}>
              <p style={{ margin: "0.75rem 0 0.35rem", opacity: 0.7, fontSize: "0.8rem" }}>
                {label}
              </p>
              {rows.map((ed) => {
                const year = ed.seasonYear ?? new Date().getFullYear();
                const href = `/competitions/${slug}/team-of-the-week/${year}/${ed.roundKey}`;
                return (
                  <Link key={ed.id} href={href}>
                    <span>{ed.roundName}</span>
                    <span style={{ opacity: 0.65 }}>
                      {ed.publishedAt
                        ? new Date(ed.publishedAt).toLocaleDateString("en-GB")
                        : "Published"}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
