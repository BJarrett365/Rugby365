import Link from "next/link";
import type { VenueProductCategory } from "@/lib/public-venue-product-types";
import type { getDivisionVenuePage } from "@/lib/public-venue-product-service";
import { COUNTRY_PAGE_CATEGORIES } from "@/lib/public-venue-ranking-engine";
import { buildVenueFilterQuery, categoryLabel } from "@/lib/public-venue-product-math";
import { VenueCategoryPills } from "./VenueCategoryPills";
import { VenueFilterBar } from "./VenueFilterBar";
import { VenueCard, VenueSimpleMap } from "./VenueShared";

type DivisionPageData = NonNullable<Awaited<ReturnType<typeof getDivisionVenuePage>>>;

export function PublicDivisionVenuesView({
  data,
  showMap,
}: {
  data: DivisionPageData;
  showMap?: boolean;
}) {
  const { stats, venues, markers, filters, filterOptions, pageTitle } = data;
  const basePath = `/venues/competition/${stats.competitionSlug}`;
  const active = showMap ? "map" : filters.category;

  const tabHref = (c: VenueProductCategory | "map") => {
    if (c === "map") {
      return `${basePath}${buildVenueFilterQuery({
        view: "map",
        category: filters.category,
        country: filters.countrySlug,
        season: filters.seasonSlug,
        type: filters.venueType,
        top: filters.top ? String(filters.top) : undefined,
      })}`;
    }
    return `${basePath}${buildVenueFilterQuery({
      category: c,
      country: filters.countrySlug,
      season: filters.seasonSlug,
      type: filters.venueType,
      top: filters.top ? String(filters.top) : undefined,
    })}`;
  };

  return (
    <div className="pr-venues">
      <div className="pr-venues__inner">
        <nav className="pr-venues__crumb" aria-label="Breadcrumb">
          <Link href="/matches">Home</Link>
          <span aria-hidden>/</span>
          <Link href="/venues">Venues</Link>
          <span aria-hidden>/</span>
          <span aria-current="page">{stats.competitionName}</span>
        </nav>

        <header className="pr-venues__hero">
          <p className="pr-venues__kicker">Venues by Competition</p>
          <h1 className="pr-venues__section-title" style={{ fontSize: "1.45rem" }}>
            {stats.competitionName}
          </h1>
          <p className="pr-venues__lede">
            Home grounds and fixture venues for {stats.competitionName}, derived from fixtures and
            team home venues — not a static competition field.
            {stats.seasonLabel ? ` Season: ${stats.seasonLabel}.` : ""}
          </p>

          <div className="pr-venues__stats">
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Teams</p>
                <p className="pr-venues__stat-value">{stats.teamCount}</p>
              </div>
            </div>
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Venues</p>
                <p className="pr-venues__stat-value">{stats.venueCount}</p>
              </div>
            </div>
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Countries</p>
                <p className="pr-venues__stat-value">{stats.countryCount}</p>
              </div>
            </div>
            <div className="pr-venues__stat">
              <div>
                <p className="pr-venues__stat-label">Season</p>
                <p className="pr-venues__stat-value">{stats.seasonLabel ?? "Current"}</p>
              </div>
            </div>
          </div>
        </header>

        <VenueCategoryPills basePath={basePath} filters={filters} />

        <VenueFilterBar basePath={basePath} filters={filters} filterOptions={filterOptions} />

        <nav className="pr-venues__tabs" aria-label="Competition venue categories">
          {COUNTRY_PAGE_CATEGORIES.map((c) => (
            <Link key={c} href={tabHref(c)} className={active === c ? "is-active" : undefined}>
              {categoryLabel(c)}
            </Link>
          ))}
          <Link href={tabHref("map")} className={active === "map" ? "is-active" : undefined}>
            Map
          </Link>
        </nav>

        {showMap ? (
          <section>
            <h2 className="pr-venues__section-title">Map — {stats.competitionName}</h2>
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
      </div>
    </div>
  );
}
