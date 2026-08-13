import type { Metadata } from "next";
import { PublicVenuesOverviewView } from "@/components/venues/PublicVenuesOverviewView";
import { parseVenueRankingFilters } from "@/components/venues/venue-filter-utils";
import { getPublicVenuesOverview } from "@/lib/public-venue-product-service";
import "@/styles/pr-venues.css";

export const dynamic = "force-dynamic";

type SearchParams =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: SearchParams;
}): Promise<Metadata> {
  const sp = (await searchParams) ?? {};
  const filters = parseVenueRankingFilters(sp);
  const data = await getPublicVenuesOverview(filters);
  return {
    title: `${data.pageTitle} | Rugby365 Venues`,
    description:
      "Browse rugby stadiums and grounds worldwide. Capacities, countries and competition venues derived from the Rugby365 database.",
    alternates: { canonical: "/venues" },
  };
}

export default async function VenuesOverviewPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = (await searchParams) ?? {};
  const filters = parseVenueRankingFilters(sp);
  const data = await getPublicVenuesOverview(filters);

  return <PublicVenuesOverviewView data={data} tab="overview" />;
}
