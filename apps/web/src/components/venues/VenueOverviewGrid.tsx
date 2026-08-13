"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicVenueCard, VenueProductCategory } from "@/lib/public-venue-product-types";
import { buildVenueFilterQuery, categoryShortLabel } from "@/lib/public-venue-product-math";
import { VenueCard } from "./VenueShared";

type SortKey = "ranking" | "capacity" | "name";

function effectiveCapacity(v: PublicVenueCard): number {
  return v.rugbyCapacity ?? v.capacity ?? 0;
}

function matchesCapacityBand(cap: number | null, band: string): boolean {
  if (!band || band === "any") return true;
  const c = cap ?? 0;
  switch (band) {
    case "40k+":
      return c >= 40000;
    case "20k-40k":
      return c >= 20000 && c < 40000;
    case "10k-20k":
      return c >= 10000 && c < 20000;
    case "under10k":
      return c > 0 && c < 10000;
    default:
      return true;
  }
}

export function VenueOverviewGrid({
  venues,
  category,
  pageTitle,
  sectionSubtitle,
  basePath,
  filters,
}: {
  venues: PublicVenueCard[];
  category: VenueProductCategory;
  pageTitle: string;
  sectionSubtitle: string;
  basePath: string;
  filters: Record<string, string | null | undefined>;
}) {
  const [query, setQuery] = useState("");
  const [capacityBand, setCapacityBand] = useState("any");
  const [surfaceFilter, setSurfaceFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("ranking");
  const [view, setView] = useState<"grid" | "list">("grid");

  const surfaces = useMemo(() => {
    const set = new Set<string>();
    for (const v of venues) {
      if (v.surface?.trim()) set.add(v.surface.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [venues]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = venues.filter((v) => {
      if (q) {
        const hay = [v.name, v.city, v.countryName].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!matchesCapacityBand(v.rugbyCapacity ?? v.capacity, capacityBand)) return false;
      if (surfaceFilter && (v.surface?.trim() ?? "") !== surfaceFilter) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "capacity") return effectiveCapacity(b) - effectiveCapacity(a);
      if (sort === "name") return a.name.localeCompare(b.name);
      return a.rank - b.rank;
    });
    return list;
  }, [venues, query, capacityBand, surfaceFilter, sort]);

  const viewAllHref = `${basePath}${buildVenueFilterQuery({
    category,
    country: filters.countrySlug,
    competition: filters.competitionSlug,
    season: filters.seasonSlug,
    type: filters.venueType,
    top: "100",
  })}`;

  return (
    <>
      <div className="pr-venues__toolbar">
        <div className="pr-venues__search">
          <span className="pr-venues__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="pr-venues__search-input"
            placeholder="Search venues, stadiums or grounds…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search venues"
          />
        </div>

        <label className="pr-venues__toolbar-field">
          <span>Capacity</span>
          <select
            value={capacityBand}
            onChange={(e) => setCapacityBand(e.target.value)}
            aria-label="Filter by capacity"
          >
            <option value="any">Any</option>
            <option value="40k+">40,000+</option>
            <option value="20k-40k">20,000 – 40,000</option>
            <option value="10k-20k">10,000 – 20,000</option>
            <option value="under10k">Under 10,000</option>
          </select>
        </label>

        <label className="pr-venues__toolbar-field">
          <span>Surface</span>
          <select
            value={surfaceFilter}
            onChange={(e) => setSurfaceFilter(e.target.value)}
            aria-label="Filter by surface"
          >
            <option value="">All</option>
            {surfaces.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="pr-venues__toolbar-field">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort venues">
            <option value="ranking">Ranking</option>
            <option value="capacity">Capacity</option>
            <option value="name">Name</option>
          </select>
        </label>

        <div className="pr-venues__view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === "grid" ? "is-active" : undefined}
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            title="Grid view"
          >
            ▦
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : undefined}
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            title="List view"
          >
            ☰
          </button>
        </div>
      </div>

      <div className="pr-venues__section-head">
        <div>
          <h2 className="pr-venues__section-title">
            <span className="pr-venues__section-star" aria-hidden>
              ★
            </span>
            {pageTitle}
          </h2>
          <p className="pr-venues__section-sub">{sectionSubtitle}</p>
        </div>
        <Link href={viewAllHref} className="pr-venues__section-link">
          View All
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="pr-venues__empty">No venues match this search or filter combination.</p>
      ) : (
        <div className={view === "grid" ? "pr-venues__grid" : "pr-venues__grid is-list"}>
          {filtered.map((v) => (
            <VenueCard key={v.id} venue={v} compact={view === "list"} />
          ))}
        </div>
      )}

      <Link href={viewAllHref} className="pr-venues__view-all">
        View All {categoryShortLabel(category)} Stadiums
      </Link>
    </>
  );
}
