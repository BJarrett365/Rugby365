import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCountryVenuesView } from "@/components/venues/PublicCountryVenuesView";
import { parseVenueRankingFilters } from "@/components/venues/venue-filter-utils";
import { getCountryVenuePage } from "@/lib/public-venue-product-service";
import "@/styles/pr-venues.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ countrySlug: string }>;
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { countrySlug } = await params;
  const data = await getCountryVenuePage(countrySlug, { category: "best" });
  if (!data) return { title: "Country venues not found | Rugby365" };
  const { stats } = data;
  return {
    title: `${stats.countryName} Rugby Venues | Rugby365`,
    description: `Browse ${stats.venueCount} rugby venues in ${stats.countryName} — capacities, home teams and maps from the Rugby365 database.`,
    alternates: { canonical: `/venues/country/${stats.countrySlug}` },
  };
}

export default async function CountryVenuesPage({ params, searchParams }: PageProps) {
  const { countrySlug } = await params;
  const sp = (await searchParams) ?? {};
  const filters = parseVenueRankingFilters(sp);
  const view = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const data = await getCountryVenuePage(countrySlug, {
    ...filters,
    countrySlug,
    view: view === "map" ? "map" : undefined,
  });
  if (!data) notFound();
  return <PublicCountryVenuesView data={data} />;
}
