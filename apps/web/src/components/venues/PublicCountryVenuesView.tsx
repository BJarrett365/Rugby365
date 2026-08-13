import Link from "next/link";
import type { getCountryVenuePage } from "@/lib/public-venue-product-service";
import { COUNTRY_PAGE_CATEGORIES } from "@/lib/public-venue-ranking-engine";
import { categoryLabel, formatCapacity } from "@/lib/public-venue-product-math";
import { VenueCategoryPills } from "./VenueCategoryPills";
import { VenueFilterBar } from "./VenueFilterBar";
import { VenueCard, VenueSimpleMap } from "./VenueShared";

type CountryPageData = NonNullable<Awaited<ReturnType<typeof getCountryVenuePage>>>;

export function PublicCountryVenuesView({ data }: { data: CountryPageData }) {
  const { stats, venues, markers, aggregates, filters, filterOptions, pageTitle, showMap } = data;
  const basePath = `/venues/country/${stats.countrySlug}`;

  return (
    <div className="pr-venues">
      <div className="pr-venues__inner">
        <nav className="pr-venues__crumb" aria-label="Breadcrumb">
          <Link href="/matches">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/venues">Venues</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{stats.countryName}</span>
        </nav>

        <header className="pr-venues__hero">
          <p className="pr-venues__kicker">Venues by Country</p>
          <h1 className="pr-venues__section-title" style={{ fontSize: "1.45rem" }}>
            {stats.flagUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={stats.flagUrl}
                alt=""
                className="pr-venues__flag"
                width={20}
                height={15}
                style={{ width: 20, height: 15, marginRight: 8 }}
              />
            ) : null}
            {stats.countryName}
          </h1>
          <p className="pr-venues__lede">
            Stadiums and grounds in {stats.countryName}, aggregated from the Rugby365 venue database.
          </p>

          <div className="pr-venues__stats">
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Venues</p>
                <p className="pr-venues__stat-value">{stats.venueCount}</p>
              </div>
            </div>
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">International</p>
                <p className="pr-venues__stat-value">{stats.internationalVenueCount}</p>
              </div>
            </div>
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Total Capacity</p>
                <p className="pr-venues__stat-value">{formatCapacity(stats.totalCapacity)}</p>
              </div>
            </div>
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Avg Capacity</p>
                <p className="pr-venues__stat-value">{formatCapacity(stats.avgCapacity)}</p>
                <p className="pr-venues__stat-hint">
                  Max {formatCapacity(stats.maxCapacity)} · Geocoded {aggregates.withCoordinates}
                </p>
              </div>
            </div>
          </div>
        </header>

        <VenueCategoryPills basePath={basePath} filters={filters} />

        <VenueFilterBar basePath={basePath} filters={filters} filterOptions={filterOptions} />

        <nav className="pr-venues__tabs" aria-label="Country venue views">
          {COUNTRY_PAGE_CATEGORIES.map((c) => (
            <Link
              key={c}
              href={`${basePath}?category=${c}`}
              className={filters.category === c ? "is-active" : undefined}
            >
              {categoryLabel(c)}
            </Link>
          ))}
          <Link
            href={`${basePath}?view=map`}
            className={showMap ? "is-active" : undefined}
          >
            Map
          </Link>
        </nav>

        {showMap ? (
          <section>
            <h2 className="pr-venues__section-title">Venue Map — {stats.countryName}</h2>
            <VenueSimpleMap markers={markers} />
          </section>
        ) : (
          <section>
            <h2 className="pr-venues__section-title">{pageTitle}</h2>
            {venues.length === 0 ? (
              <p className="pr-venues__empty">No venues for this filter combination.</p>
            ) : (
              <div className="pr-venues__grid">
                {venues.map((v) => (
                  <VenueCard key={v.id} venue={v} />
                ))}
              </div>
            )}
          </section>
        )}

        {stats.competitions.length > 0 ? (
          <section className="pr-venues__browse">
            <h2 className="pr-venues__section-title">Competitions in {stats.countryName}</h2>
            <div className="pr-venues__browse-grid">
              {stats.competitions.map((d) => (
                <Link
                  key={d.competitionId}
                  href={`/venues/competition/${d.competitionSlug}?country=${stats.countrySlug}`}
                  className="pr-venues__browse-card"
                >
                  <h3 className="pr-venues__browse-title">{d.competitionName}</h3>
                  <p className="pr-venues__browse-meta">
                    {d.venueCount.toLocaleString("en-GB")} venues in {stats.countryName}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
