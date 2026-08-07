import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TeamOfWeekPicker } from "@/components/competitions/TeamOfWeekPicker";
import { getCompetitionBySlug, listSeasonsForPicker } from "@/lib/competition-admin-service";
import { buildTotwPickerSeasons } from "@/lib/team-of-week-picker";
import { listPublishedEditionsForCompetition } from "@/lib/team-of-week-service";
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

  const pickerSeasons = buildTotwPickerSeasons(editions);
  const latest = editions[0];

  // Canonical browse URL is season + round — send users to the latest published edition.
  if (latest?.seasonYear != null && latest.roundKey) {
    redirect(
      `/competitions/${slug}/team-of-the-week/${latest.seasonYear}/${latest.roundKey}`,
    );
  }

  return (
    <div>
      <p className="text-sm text-[var(--pr-grey,#9aa)] mt-3 mb-2">
        Choose a season, then a round. Generate and publish from{" "}
        <Link href="/admin/team-of-the-week">Admin → Team of the Week</Link>.
      </p>

      {pickerSeasons.length > 0 ? (
        <TeamOfWeekPicker
          slug={slug}
          seasons={pickerSeasons}
          selectedYear={pickerSeasons[0]!.year}
          selectedRoundKey={pickerSeasons[0]!.rounds[0]?.roundKey ?? ""}
        />
      ) : null}

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
    </div>
  );
}
