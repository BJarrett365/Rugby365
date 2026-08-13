"use client";

import Link from "next/link";
import { useState } from "react";
import type { VenueProductCategory, VenueRankingFilters } from "@/lib/public-venue-product-types";
import {
  buildVenueFilterQuery,
  categoryLabel,
  categorySubtitle,
} from "@/lib/public-venue-product-math";

/** Primary discovery row aligned to approved overview mock. */
export const OVERVIEW_DISCOVERY_CATEGORIES: VenueProductCategory[] = [
  "all",
  "best",
  "biggest",
  "smallest",
  "remote",
  "iconic",
];

/** Secondary categories — expandable beyond mock row. */
export const OVERVIEW_MORE_CATEGORIES: VenueProductCategory[] = [
  "atmosphere",
  "fortress",
  "historic",
  "picturesque",
  "club_ground",
  "matchday",
];

const CATEGORY_ICONS: Partial<Record<VenueProductCategory, string>> = {
  all: "▦",
  best: "★",
  biggest: "▲",
  smallest: "▼",
  remote: "⌖",
  iconic: "◆",
  atmosphere: "◎",
  fortress: "⛊",
  historic: "⏳",
  picturesque: "◐",
  club_ground: "▣",
  matchday: "⚑",
};

function discoveryLabel(category: VenueProductCategory): string {
  switch (category) {
    case "best":
      return "Best Stadiums";
    case "iconic":
      return "Iconic Grounds";
    case "all":
      return "All Venues";
    default:
      return categoryLabel(category);
  }
}

export function VenueCategoryPills({
  basePath,
  filters,
  categoryCounts,
  totalVenues,
}: {
  basePath: string;
  filters: VenueRankingFilters;
  categoryCounts?: Partial<Record<string, number | null>>;
  totalVenues?: number;
}) {
  const [showMore, setShowMore] = useState(false);

  const buildHref = (key: VenueProductCategory) =>
    `${basePath}${buildVenueFilterQuery({
      category: key,
      country: filters.countrySlug,
      competition: filters.competitionSlug,
      season: filters.seasonSlug ?? undefined,
      type: filters.venueType,
      top: filters.top ? String(filters.top) : undefined,
    })}`;

  const renderCat = (key: VenueProductCategory) => {
    const count = key === "all" ? totalVenues : categoryCounts?.[key];
    const active = filters.category === key;
    return (
      <Link
        key={key}
        href={buildHref(key)}
        className={`pr-venues__cat${active ? " is-active" : ""}`}
      >
        <span className="pr-venues__cat-icon" aria-hidden>
          {CATEGORY_ICONS[key] ?? "▣"}
        </span>
        <p className="pr-venues__cat-title">{discoveryLabel(key)}</p>
        <p className="pr-venues__cat-sub">
          {count == null ? categorySubtitle(key) : count.toLocaleString("en-GB")}
        </p>
      </Link>
    );
  };

  return (
    <div className="pr-venues__cats-wrap">
      <div className="pr-venues__cats" role="navigation" aria-label="Venue ranking categories">
        {OVERVIEW_DISCOVERY_CATEGORIES.map(renderCat)}
        {showMore ? OVERVIEW_MORE_CATEGORIES.map(renderCat) : null}
        <button
          type="button"
          className="pr-venues__cat pr-venues__cat--more"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
        >
          <span className="pr-venues__cat-icon" aria-hidden>
            {showMore ? "−" : "+"}
          </span>
          <p className="pr-venues__cat-title">{showMore ? "Fewer" : "More"}</p>
          <p className="pr-venues__cat-sub">Categories</p>
        </button>
      </div>
    </div>
  );
}
