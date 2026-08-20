import type { Metadata } from "next";
import { PublicVenuesOverviewView } from "@/components/venues/PublicVenuesOverviewView";
import { getPublicVenuesOverview } from "@/lib/public-venue-product-service";
import "@/styles/pr-venues.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare Venues · Rugby365 Venues",
  description: "Compare rugby stadiums side-by-side — coming soon on Rugby365 Venues.",
  alternates: { canonical: "/venues/compare" },
};

export default async function VenuesCompareScaffoldPage() {
  const data = await getPublicVenuesOverview({ category: "best" });
  return <PublicVenuesOverviewView data={data} tab="compare" />;
}
