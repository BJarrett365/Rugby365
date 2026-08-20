import type { Metadata } from "next";
import { PublicVenuesOverviewView } from "@/components/venues/PublicVenuesOverviewView";
import { getPublicVenuesOverview } from "@/lib/public-venue-product-service";
import "@/styles/pr-venues.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Venue Map View · Rugby365 Venues",
  description: "Interactive venues map — scaffolding while geocoding coverage grows.",
  alternates: { canonical: "/venues/map" },
};

export default async function VenuesMapScaffoldPage() {
  const data = await getPublicVenuesOverview({ category: "best" });
  return <PublicVenuesOverviewView data={data} tab="map" />;
}
