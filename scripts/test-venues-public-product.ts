import { getCountryVenuePage, getDivisionVenuePage, getPublicVenuesOverview } from "../apps/web/src/lib/public-venue-product-service";

async function main() {
  const overview = await getPublicVenuesOverview({ category: "best" });
  const england = await getCountryVenuePage("england", { category: "biggest" });
  const urc = await getDivisionVenuePage("united-rugby-championship", { category: "all" });
  const prem = await getDivisionVenuePage("premiership", { category: "biggest" });
  const saUrc = await getPublicVenuesOverview({
    category: "best",
    countrySlug: "south-africa",
    competitionSlug: "united-rugby-championship",
    top: 10,
  });

  console.log(
    JSON.stringify(
      {
        aggregates: overview.aggregates,
        rankedTop3: overview.rankedVenues.slice(0, 3).map((v) => ({
          rank: v.rank,
          name: v.name,
          capacity: v.capacity,
          rating: v.r365Rating,
        })),
        countryCount: overview.countries.length,
        divisionCount: overview.divisions.length,
        england: england
          ? {
              venueCount: england.stats.venueCount,
              top: england.venues.slice(0, 3).map((v) => v.name),
              markers: england.markers.length,
            }
          : null,
        urc: urc
          ? { venueCount: urc.stats.venueCount, teams: urc.stats.teamCount, rows: urc.venues.length }
          : null,
        prem: prem
          ? { venueCount: prem.stats.venueCount, teams: prem.stats.teamCount, rows: prem.venues.length }
          : null,
        saUrcBest: {
          title: saUrc.pageTitle,
          top3: saUrc.rankedVenues.slice(0, 3).map((v) => ({
            rank: v.rank,
            name: v.name,
            source: v.rankSource,
          })),
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
