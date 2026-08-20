import Link from "next/link";
import type { PublicVenuesOverview } from "@/lib/public-venue-product-types";
import { formatCapacity } from "@/lib/public-venue-product-math";
import { VenueCategoryPills } from "./VenueCategoryPills";
import { VenueFilterBar } from "./VenueFilterBar";
import { categorySectionSubtitle } from "./venue-filter-utils";
import { VenueMiniList } from "./VenueShared";
import { VenueOverviewGrid } from "./VenueOverviewGrid";

export function PublicVenuesOverviewView({
  data,
  tab = "overview",
}: {
  data: PublicVenuesOverview;
  tab?: "overview" | "map" | "compare" | "new";
}) {
  const a = data.aggregates;
  const featured = data.featuredVenue;

  return (
    <div className="pr-venues">
      <div className="pr-venues__inner">
        <nav className="pr-venues__crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden>›</span>
          <span aria-current="page">Venues</span>
        </nav>

        <header className="pr-venues__hero">
          <div className="pr-venues__hero-grid">
            <div className="pr-venues__hero-copy">
              <h1 className="pr-venues__title">Rugby365 Venues</h1>
              <p className="pr-venues__lede">
                Explore and compare rugby venues, stadiums and grounds from around the world.
              </p>

              <div className="pr-venues__stats">
                <div className="pr-venues__stat">
                  <div className="pr-venues__stat-icon" aria-hidden>
                    ▣
                  </div>
                  <div>
                    <p className="pr-venues__stat-label">Total Venues</p>
                    <p className="pr-venues__stat-value">{a.totalVenues.toLocaleString("en-GB")}</p>
                  </div>
                </div>
                <div className="pr-venues__stat">
                  <div className="pr-venues__stat-icon" aria-hidden>
                    ◎
                  </div>
                  <div>
                    <p className="pr-venues__stat-label">Countries</p>
                    <p className="pr-venues__stat-value">{a.countries.toLocaleString("en-GB")}</p>
                  </div>
                </div>
                <div className="pr-venues__stat">
                  <div className="pr-venues__stat-icon" aria-hidden>
                    ♛
                  </div>
                  <div>
                    <p className="pr-venues__stat-label">International Venues</p>
                    <p className="pr-venues__stat-value">
                      {a.internationalVenues.toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
                <div className="pr-venues__stat">
                  <div className="pr-venues__stat-icon" aria-hidden>
                    ☰
                  </div>
                  <div>
                    <p className="pr-venues__stat-label">Capacity 40,000+</p>
                    <p className="pr-venues__stat-value">
                      {a.largeCapacityVenues.toLocaleString("en-GB")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {featured ? (
              <div
                className="pr-venues__featured"
                style={
                  featured.imageUrl
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(11, 17, 27, 0.05), rgba(11, 17, 27, 0.88)), url(${featured.imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              >
                <div className="pr-venues__featured-meta">
                  <p className="pr-venues__featured-name">{featured.name}</p>
                  <p className="pr-venues__featured-loc">
                    {[featured.city, featured.countryName].filter(Boolean).join(", ") || "Stadium"}
                  </p>
                </div>
                <Link href={`/venues/${featured.slug}`} className="pr-venues__featured-btn">
                  View Details
                </Link>
              </div>
            ) : null}
          </div>
        </header>

        <nav className="pr-venues__tabs" aria-label="Venues sections">
          <Link href="/venues" className={tab === "overview" ? "is-active" : undefined}>
            Overview
          </Link>
          <Link href="/venues/map" className={tab === "map" ? "is-active" : undefined}>
            Map View
          </Link>
          <Link href="/venues/compare" className={tab === "compare" ? "is-active" : undefined}>
            Compare
          </Link>
          <Link href="/venues/new" className={tab === "new" ? "is-active" : undefined}>
            New Venues
          </Link>
        </nav>

        {tab !== "overview" ? (
          <section>
            <h2 className="pr-venues__section-title">
              {tab === "map" ? "Map View" : tab === "compare" ? "Compare" : "New Venues"}
            </h2>
            <p className="pr-venues__scaffold-note">
              {tab === "map"
                ? "Interactive world map is scaffolded. Country and division pages already plot geocoded markers when coordinates exist."
                : tab === "compare"
                  ? "Venue compare (side-by-side and all-time) is under development."
                  : "New venues feed will list recently added grounds once enrichment timestamps are exposed on the public product."}
            </p>
            <p className="pr-venues__scaffold-note">
              <Link href="/venues">← Back to Overview</Link>
            </p>
          </section>
        ) : (
          <>
            <VenueCategoryPills
              basePath="/venues"
              filters={data.filters}
              categoryCounts={data.categoryCounts}
              totalVenues={a.totalVenues}
            />

            <VenueFilterBar
              basePath="/venues"
              filters={data.filters}
              filterOptions={data.filterOptions}
            />

            <div className="pr-venues__layout">
              <section className="pr-venues__main">
                {data.rankedVenues.length === 0 ? (
                  <p className="pr-venues__empty">
                    No venues available for this filter combination.
                  </p>
                ) : (
                  <VenueOverviewGrid
                    venues={data.rankedVenues}
                    category={data.filters.category}
                    pageTitle={data.pageTitle}
                    sectionSubtitle={categorySectionSubtitle(data.filters.category)}
                    basePath="/venues"
                    filters={{
                      countrySlug: data.filters.countrySlug,
                      competitionSlug: data.filters.competitionSlug,
                      seasonSlug: data.filters.seasonSlug,
                      venueType: data.filters.venueType,
                    }}
                  />
                )}
              </section>

              <aside className="pr-venues__side">
                <div className="pr-venues__side-card">
                  <h3>By Capacity</h3>
                  <VenueMiniList venues={data.byCapacity} valueKey="capacity" />
                </div>
                <div className="pr-venues__side-card">
                  <h3>Most Remote Venues</h3>
                  {data.mostRemote.length === 0 ? (
                    <p className="pr-venues__empty">
                      Needs coordinates — {a.withCoordinates} venues geocoded so far.
                    </p>
                  ) : (
                    <VenueMiniList venues={data.mostRemote} valueKey="remotenessKm" />
                  )}
                </div>
                <div className="pr-venues__side-card">
                  <h3>Venue Facts</h3>
                  <dl className="pr-venues__facts">
                    <div className="pr-venues__fact">
                      <span className="pr-venues__fact-icon" aria-hidden>
                        ⏳
                      </span>
                      <dt>Oldest Stadium</dt>
                      <dd>
                        {data.facts.oldestStadium ? (
                          <>
                            <Link href={`/venues/${data.facts.oldestStadium.slug}`}>
                              {data.facts.oldestStadium.name}
                            </Link>
                            {data.facts.oldestStadium.year != null
                              ? ` (${data.facts.oldestStadium.year})`
                              : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div className="pr-venues__fact">
                      <span className="pr-venues__fact-icon" aria-hidden>
                        ▲
                      </span>
                      <dt>Largest Capacity</dt>
                      <dd>
                        {data.facts.largestCapacity ? (
                          <>
                            <Link href={`/venues/${data.facts.largestCapacity.slug}`}>
                              {data.facts.largestCapacity.name}
                            </Link>
                            {data.facts.largestCapacity.capacity != null
                              ? ` (${formatCapacity(data.facts.largestCapacity.capacity)})`
                              : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div className="pr-venues__fact">
                      <span className="pr-venues__fact-icon" aria-hidden>
                        ⌂
                      </span>
                      <dt>Highest Altitude</dt>
                      <dd>
                        {data.facts.highestAltitude ? (
                          <>
                            <Link href={`/venues/${data.facts.highestAltitude.slug}`}>
                              {data.facts.highestAltitude.name}
                            </Link>
                            {data.facts.highestAltitude.altitudeM != null
                              ? ` (${data.facts.highestAltitude.altitudeM.toLocaleString("en-GB")}m)`
                              : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div className="pr-venues__fact">
                      <span className="pr-venues__fact-icon" aria-hidden>
                        ▼
                      </span>
                      <dt>Lowest Capacity</dt>
                      <dd>
                        {data.facts.lowestCapacity ? (
                          <>
                            <Link href={`/venues/${data.facts.lowestCapacity.slug}`}>
                              {data.facts.lowestCapacity.name}
                            </Link>
                            {data.facts.lowestCapacity.capacity != null
                              ? ` (${formatCapacity(data.facts.lowestCapacity.capacity)})`
                              : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </aside>
            </div>

            <section className="pr-venues__browse" id="by-country">
              <div className="pr-venues__browse-head">
                <h2 className="pr-venues__section-title">Browse by Country</h2>
                <Link href="/venues#by-country" className="pr-venues__section-link">
                  All countries
                </Link>
              </div>
              <div className="pr-venues__browse-grid">
                {data.countries.map((c) => (
                  <Link
                    key={c.countrySlug}
                    href={`/venues/country/${c.countrySlug}`}
                    className="pr-venues__browse-card"
                  >
                    <h3 className="pr-venues__browse-title">
                      {c.flagUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.flagUrl}
                          alt=""
                          className="pr-venues__flag"
                          width={16}
                          height={12}
                        />
                      ) : null}
                      {c.countryName}
                    </h3>
                    <p className="pr-venues__browse-meta">
                      {c.venueCount.toLocaleString("en-GB")} venues
                      {c.largestVenue
                        ? ` · Largest: ${c.largestVenue.name}${
                            c.largestVenue.capacity != null
                              ? ` (${formatCapacity(c.largestVenue.capacity)})`
                              : ""
                          }`
                        : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section className="pr-venues__browse" id="by-division">
              <div className="pr-venues__browse-head">
                <h2 className="pr-venues__section-title">Browse by Division</h2>
              </div>
              <div className="pr-venues__browse-grid">
                {data.divisions.map((d) => (
                  <Link
                    key={d.competitionId}
                    href={`/venues/competition/${d.competitionSlug}`}
                    className="pr-venues__browse-card"
                  >
                    <h3 className="pr-venues__browse-title">{d.competitionName}</h3>
                    <p className="pr-venues__browse-meta">
                      {d.venueCount.toLocaleString("en-GB")} venues ·{" "}
                      {d.teamCount.toLocaleString("en-GB")} teams ·{" "}
                      {d.countryCount.toLocaleString("en-GB")} countries
                      {d.avgCapacity != null
                        ? ` · Avg capacity ${formatCapacity(d.avgCapacity)}`
                        : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
