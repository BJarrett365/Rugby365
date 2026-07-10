export type InternationalCoachCategory = {
  country: string;
  url: string;
  teamSlugs?: string[];
  teamNames?: string[];
  isHub?: boolean;
};

export const INTERNATIONAL_COACH_WIKIPEDIA_HUB =
  "https://en.wikipedia.org/wiki/Category:Coaches_of_international_rugby_union_teams";

/** Wikipedia national-team coach categories for bulk import. */
export const INTERNATIONAL_COACH_WIKIPEDIA_CATEGORIES: InternationalCoachCategory[] = [
  {
    country: "International hub",
    url: INTERNATIONAL_COACH_WIKIPEDIA_HUB,
    isHub: true,
  },
  {
    country: "Argentina",
    url: "https://en.wikipedia.org/wiki/Category:Argentina_national_rugby_union_team_coaches",
    teamSlugs: ["argentina"],
    teamNames: ["Argentina"],
  },
  {
    country: "Australia",
    url: "https://en.wikipedia.org/wiki/Category:Australia_national_rugby_union_team_coaches",
    teamSlugs: ["australia"],
    teamNames: ["Australia"],
  },
  {
    country: "British & Irish Lions",
    url: "https://en.wikipedia.org/wiki/Category:British_%26_Irish_Lions_coaches",
    teamSlugs: ["british-and-irish-lions", "british-irish-lions"],
    teamNames: ["British & Irish Lions", "British and Irish Lions"],
  },
  {
    country: "England",
    url: "https://en.wikipedia.org/wiki/Category:England_national_rugby_union_team_coaches",
    teamSlugs: ["england"],
    teamNames: ["England"],
  },
  {
    country: "Fiji",
    url: "https://en.wikipedia.org/wiki/Category:Fiji_national_rugby_union_team_coaches",
    teamSlugs: ["fiji"],
    teamNames: ["Fiji"],
  },
  {
    country: "France",
    url: "https://en.wikipedia.org/wiki/Category:France_national_rugby_union_team_coaches",
    teamSlugs: ["france"],
    teamNames: ["France"],
  },
  {
    country: "Ireland",
    url: "https://en.wikipedia.org/wiki/Category:Ireland_national_rugby_union_team_coaches",
    teamSlugs: ["ireland"],
    teamNames: ["Ireland"],
  },
  {
    country: "Italy",
    url: "https://en.wikipedia.org/wiki/Category:Italy_national_rugby_team_coaches",
    teamSlugs: ["italy"],
    teamNames: ["Italy"],
  },
  {
    country: "Japan",
    url: "https://en.wikipedia.org/wiki/Category:Japan_national_rugby_team_coaches",
    teamSlugs: ["japan"],
    teamNames: ["Japan"],
  },
  {
    country: "New Zealand",
    url: "https://en.wikipedia.org/wiki/Category:New_Zealand_national_rugby_union_team_coaches",
    teamSlugs: ["new-zealand"],
    teamNames: ["New Zealand"],
  },
  {
    country: "Romania",
    url: "https://en.wikipedia.org/wiki/Category:Romania_national_rugby_union_team_coaches",
    teamSlugs: ["romania"],
    teamNames: ["Romania"],
  },
  {
    country: "Samoa",
    url: "https://en.wikipedia.org/wiki/Category:Samoa_national_rugby_union_team_coaches",
    teamSlugs: ["samoa"],
    teamNames: ["Samoa"],
  },
  {
    country: "Scotland",
    url: "https://en.wikipedia.org/wiki/Category:Scotland_national_rugby_union_team_coaches",
    teamSlugs: ["scotland"],
    teamNames: ["Scotland"],
  },
  {
    country: "South Africa",
    url: "https://en.wikipedia.org/wiki/Category:South_Africa_national_rugby_union_team_coaches",
    teamSlugs: ["south-africa"],
    teamNames: ["South Africa"],
  },
  {
    country: "United States",
    url: "https://en.wikipedia.org/wiki/Category:United_States_national_rugby_union_team_coaches",
    teamSlugs: ["usa", "united-states"],
    teamNames: ["United States", "USA"],
  },
  {
    country: "Wales",
    url: "https://en.wikipedia.org/wiki/Category:Wales_national_rugby_union_team_coaches",
    teamSlugs: ["wales"],
    teamNames: ["Wales"],
  },
];

export const IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES = INTERNATIONAL_COACH_WIKIPEDIA_CATEGORIES.filter(
  (entry) => !entry.isHub,
);

export function parseCountryFromCoachCategory(categoryTitleOrUrl: string): string | null {
  let title = categoryTitleOrUrl.trim();
  if (title.includes("/wiki/Category:")) {
    title = decodeURIComponent(title.split("/wiki/Category:")[1] ?? title);
  }
  title = title.replace(/^Category:/i, "").replace(/_/g, " ").trim();
  if (!title || /^coaches of international rugby union teams$/i.test(title)) {
    return null;
  }

  const patterns = [
    /^(.+?)\s+national rugby union team coaches$/i,
    /^(.+?)\s+national rugby team coaches$/i,
    /^(.+?)\s+coaches$/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function findCoachCategoryByUrl(url: string): InternationalCoachCategory | undefined {
  const normalized = url.trim().toLowerCase();
  return INTERNATIONAL_COACH_WIKIPEDIA_CATEGORIES.find(
    (entry) => entry.url.toLowerCase() === normalized,
  );
}

export function findCoachCategoryByCountry(country: string): InternationalCoachCategory | undefined {
  const normalized = country.trim().toLowerCase();
  return IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES.find(
    (entry) => entry.country.toLowerCase() === normalized,
  );
}
