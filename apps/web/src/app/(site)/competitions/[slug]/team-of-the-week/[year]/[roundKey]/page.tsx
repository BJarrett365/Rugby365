import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamOfWeekView } from "@/components/competitions/TeamOfWeekView";
import { getCompetitionBySlug } from "@/lib/competition-admin-service";
import {
  findPublishedEditionByRound,
  getTeamOfWeekEditionBundle,
} from "@/lib/team-of-week-service";
import { presentTeamOfWeekBundle } from "@/lib/team-of-week-public";
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

  const edition = await findPublishedEditionByRound({
    competitionId: competition.id,
    year: yearNum,
    roundKey,
  });
  if (!edition) notFound();

  const bundle = await getTeamOfWeekEditionBundle(edition.id);
  if (!bundle) notFound();

  const view = presentTeamOfWeekBundle(bundle);

  return (
    <div>
      <p className="text-sm mt-3 mb-0">
        <Link href={`/competitions/${slug}/team-of-the-week`}>← All rounds</Link>
      </p>
      <TeamOfWeekView data={view} showArchiveLink />
    </div>
  );
}
