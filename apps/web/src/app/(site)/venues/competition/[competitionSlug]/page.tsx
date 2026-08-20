import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicDivisionVenuesView } from "@/components/venues/PublicDivisionVenuesView";
import { parseVenueRankingFilters } from "@/components/venues/venue-filter-utils";
import { getDivisionVenuePage } from "@/lib/public-venue-product-service";
import "@/styles/pr-venues.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ competitionSlug: string }>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { competitionSlug } = await params;
  const data = await getDivisionVenuePage(competitionSlug);
  if (!data) return { title: "Competition venues not found | Rugby365" };
  const { stats } = data;
  return {
    title: `${stats.competitionName} Venues | Rugby365`,
    description: `Stadiums used in ${stats.competitionName} — ${stats.venueCount} venues across ${stats.countryCount} countries, from fixtures and team home grounds.`,
    alternates: { canonical: `/venues/competition/${stats.competitionSlug}` },
  };
}

export default async function CompetitionVenuesPage({ params, searchParams }: PageProps) {
  const { competitionSlug } = await params;
  const sp = (await searchParams) ?? {};
  const filters = parseVenueRankingFilters(sp);
  const view = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const data = await getDivisionVenuePage(competitionSlug, {
    category: filters.category,
    countrySlug: filters.countrySlug,
    seasonSlug: filters.seasonSlug,
    venueType: filters.venueType,
    top: filters.top,
    view: view === "map" ? "map" : undefined,
  });
  if (!data) notFound();
  return <PublicDivisionVenuesView data={data} showMap={data.showMap} />;
}
