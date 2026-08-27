import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamOfWeekPicker } from "@/components/competitions/TeamOfWeekPicker";
import { TeamOfWeekView } from "@/components/competitions/TeamOfWeekView";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";
import { buildTotwPickerSeasons } from "@/lib/team-of-week-picker";
import {
  findPublishedEditionByRound,
  getTeamOfWeekEditionBundle,
  listPublishedEditionsForCompetition,
} from "@/lib/team-of-week-service";
import { presentTeamOfWeekBundle } from "@/lib/team-of-week-public";
import { hydrateTotwLiveImages } from "@/lib/team-of-week-hydrate";
import "@/styles/team-of-week.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; year: string; roundKey: string }>;
}) {
  const { slug, year, roundKey } = await params;
  const competition = await getCompetitionBySlug(slug);
  const titleComp = competition?.name ?? "Competition";
  return {
    title: `${titleComp} Team of the Week: ${roundKey.replace(/-/g, " ")} (${year}) · Rugby365`,
    description: `The Rugby365 ${titleComp} Team of the Week for ${roundKey}, including the best XV, impact bench and awards.`,
  };
}

export default async function TeamOfWeekRoundPage({
  params,
}: {
  params: Promise<{ slug: string; year: string; roundKey: string }>;
}) {
  const { slug, year, roundKey } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const yearNum = Number(year);
  if (!Number.isFinite(yearNum)) notFound();

  const [edition, allEditions] = await Promise.all([
    findPublishedEditionByRound({
      competitionId: competition.id,
      year: yearNum,
      roundKey,
    }),
    listPublishedEditionsForCompetition(competition.id),
  ]);
  if (!edition) notFound();

  const bundle = await getTeamOfWeekEditionBundle(edition.id);
  if (!bundle) notFound();

  const view = await hydrateTotwLiveImages(presentTeamOfWeekBundle(bundle));
  const pickerSeasons = buildTotwPickerSeasons(allEditions);

  return (
    <div>
      <p className="text-sm text-[var(--pr-grey,#9aa)] mt-3 mb-2">
        Select a season, then a round for that season.{" "}
        <Link href={`/competitions/${slug}/team-of-the-week`}>Latest</Link>
      </p>
      {pickerSeasons.length > 0 ? (
        <TeamOfWeekPicker
          slug={slug}
          seasons={pickerSeasons}
          selectedYear={yearNum}
          selectedRoundKey={roundKey}
        />
      ) : null}
      <TeamOfWeekView data={view} />
    </div>
  );
}
