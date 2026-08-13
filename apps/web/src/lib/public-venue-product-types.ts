/**
 * Public Venues product — shared types.
 * Editorial picks are stored separately from data-derived ranks and R365 ratings.
 */

/** Primary ranking categories shown under the VENUES header. */
export type VenueProductCategory =
  | "best"
  | "atmosphere"
  | "fortress"
  | "historic"
  | "iconic"
  | "picturesque"
  | "remote"
  | "biggest"
  | "smallest"
  | "club_ground"
  | "matchday"
  | "all";

export type VenueType =
  | "dedicated_rugby"
  | "multi_sport"
  | "occasional_rugby"
  | "historic_rugby";

export type VenueRankSource = "editorial" | "data" | "provisional";

export type VenueProductTab = "overview" | "map" | "compare" | "new";

export type VenueTopLimit = 10 | 25 | 50 | 100;

export type PublicVenueCard = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  countryName: string | null;
  countrySlug: string | null;
  countryCode: string | null;
  flagUrl: string | null;
  capacity: number | null;
  /** Verified rugby-configuration capacity when set. */
  rugbyCapacity: number | null;
  openedYear: number | null;
  surface: string | null;
  venueType: VenueType | null;
  /** R365 venue rating — only when modelled; never fabricated from editorial. */
  r365Rating: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  homeTeams: Array<{ id: string; name: string; slug: string }>;
  fixtureCount: number;
  /** Display rank within active category cohort (1-based). */
  rank: number;
  /** Data-derived rank when applicable — null for pure editorial picks. */
  dataRank: number | null;
  rankSource: VenueRankSource;
  categoryLabel: string;
  reason: string | null;
  editorialRank: number | null;
  editorialCategory: VenueProductCategory | null;
  remotenessKm: number | null;
};

/** Published category ranks for venue profile (future hook). */
export type VenueProfileCategoryRank = {
  category: VenueProductCategory;
  categoryLabel: string;
  rank: number;
  rankSource: VenueRankSource;
  reason: string | null;
  isPublished: boolean;
};

export type VenueFilterOption = {
  value: string;
  label: string;
  count?: number;
};

export type VenueFilterOptions = {
  countries: VenueFilterOption[];
  competitions: VenueFilterOption[];
  seasons: VenueFilterOption[];
  venueTypes: VenueFilterOption[];
  topLimits: VenueFilterOption[];
};

export type VenueRankingFilters = {
  category: VenueProductCategory;
  countrySlug?: string | null;
  competitionSlug?: string | null;
  seasonSlug?: string | null;
  venueType?: VenueType | null;
  top?: VenueTopLimit;
};

export type VenueAggregates = {
  totalVenues: number;
  countries: number;
  internationalVenues: number;
  largeCapacityVenues: number;
  withCoordinates: number;
  withCapacity: number;
  totalCapacity: number | null;
  avgCapacity: number | null;
  maxCapacity: number | null;
  minCapacity: number | null;
};

export type CountryVenueStats = {
  countryName: string;
  countrySlug: string;
  countryCode: string | null;
  flagUrl: string | null;
  venueCount: number;
  internationalVenueCount: number;
  totalCapacity: number | null;
  avgCapacity: number | null;
  maxCapacity: number | null;
  minCapacity: number | null;
  withCoordinates: number;
  largestVenue: { name: string; slug: string; capacity: number | null } | null;
  topRatedVenue: { name: string; slug: string; r365Rating: number | null } | null;
  competitions: DivisionBrowseCard[];
};

export type DivisionVenueStats = {
  competitionId: string;
  competitionSlug: string;
  competitionName: string;
  competitionType: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  seasons: Array<{ id: string; slug: string; label: string; year: number; isActive: boolean }>;
  teamCount: number;
  venueCount: number;
  countryCount: number;
  totalCapacity: number | null;
  avgCapacity: number | null;
  maxCapacity: number | null;
};

export type DivisionBrowseCard = {
  competitionId: string;
  competitionSlug: string;
  competitionName: string;
  competitionType: string | null;
  venueCount: number;
  teamCount: number;
  countryCount: number;
  avgCapacity: number | null;
  maxCapacity: number | null;
};

export type VenueFacts = {
  oldestStadium: { name: string; slug: string; year: number | null } | null;
  largestCapacity: { name: string; slug: string; capacity: number | null } | null;
  highestAltitude: { name: string; slug: string; altitudeM: number | null } | null;
  lowestCapacity: { name: string; slug: string; capacity: number | null } | null;
};

export type VenueMapMarker = {
  id: string;
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity: number | null;
  city: string | null;
  countryName: string | null;
};

export type PublicVenuesOverview = {
  aggregates: VenueAggregates;
  filters: VenueRankingFilters;
  filterOptions: VenueFilterOptions;
  pageTitle: string;
  categoryCounts: Partial<Record<VenueProductCategory, number | null>>;
  featuredVenue: PublicVenueCard | null;
  rankedVenues: PublicVenueCard[];
  byCapacity: PublicVenueCard[];
  mostRemote: PublicVenueCard[];
  facts: VenueFacts;
  countries: CountryVenueStats[];
  divisions: DivisionBrowseCard[];
  scaffolds: {
    mapView: true;
    compare: true;
    newVenues: true;
    ratings: true;
    openedYear: true;
    surface: true;
    altitude: true;
  };
};
