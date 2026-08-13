import type { VenueFilterOptions, VenueRankingFilters } from "@/lib/public-venue-product-types";

type FilterBarProps = {
  basePath: string;
  filters: VenueRankingFilters;
  filterOptions: VenueFilterOptions;
};

export function VenueFilterBar({ filters, filterOptions }: FilterBarProps) {
  return (
    <form className="pr-venues__filters pr-venues__filters--bar" method="get">
      <input type="hidden" name="category" value={filters.category} />

      <label className="pr-venues__filter-field">
        <span>Country</span>
        <select name="country" defaultValue={filters.countrySlug ?? ""} aria-label="Country">
          <option value="">All</option>
          {filterOptions.countries.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
              {c.count != null ? ` (${c.count})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="pr-venues__filter-field">
        <span>Type</span>
        <select name="type" defaultValue={filters.venueType ?? ""} aria-label="Venue type">
          <option value="">All</option>
          {filterOptions.venueTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
              {t.count != null ? ` (${t.count})` : ""}
            </option>
          ))}
        </select>
      </label>

      <details className="pr-venues__filters-details">
        <summary className="pr-venues__more-filters">More Filters</summary>
        <div className="pr-venues__filters-more">
          <label className="pr-venues__filter-field">
            <span>Division / Competition</span>
            <select name="competition" defaultValue={filters.competitionSlug ?? ""}>
              <option value="">All competitions</option>
              {filterOptions.competitions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                  {c.count != null ? ` (${c.count})` : ""}
                </option>
              ))}
            </select>
          </label>
          {filterOptions.seasons.length > 0 ? (
            <label className="pr-venues__filter-field">
              <span>Season</span>
              <select name="season" defaultValue={filters.seasonSlug ?? ""}>
                <option value="">Current season</option>
                {filterOptions.seasons.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="pr-venues__filter-field">
            <span>Show</span>
            <select name="top" defaultValue={String(filters.top ?? 10)}>
              {filterOptions.topLimits.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <button type="submit" className="pr-venues__apply-filters">
        Apply
      </button>
    </form>
  );
}
