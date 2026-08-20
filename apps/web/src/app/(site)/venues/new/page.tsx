import type { Metadata } from "next";
import { PublicVenuesOverviewView } from "@/components/venues/PublicVenuesOverviewView";
import { getPublicVenuesOverview } from "@/lib/public-venue-product-service";
import "@/styles/pr-venues.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Venues · Rugby365 Venues",
  description: "Recently added rugby grounds — coming soon on Rugby365 Venues.",
  alternates: { canonical: "/venues/new" },
};

export default async function VenuesNewScaffoldPage() {
  const data = await getPublicVenuesOverview({ category: "best" });
  return <PublicVenuesOverviewView data={data} tab="new" />;
}
