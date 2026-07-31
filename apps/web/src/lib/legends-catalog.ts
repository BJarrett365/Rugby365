/**
 * Planet Rugby Legends catalog — editorial seed for eras + collections.
 * Profiles are always real `players` rows; this never forks a second identity.
 */

export type LegendEraSlug =
  | "1880s-1890s"
  | "1900s"
  | "1910s"
  | "1920s"
  | "1930s"
  | "1940s"
  | "1950s"
  | "1960s"
  | "1970s"
  | "1980s"
  | "1990s"
  | "2000s"
  | "2010s"
  | "2020s";

export type LegendCollectionSlug =
  | "greatest-players"
  | "greatest-captains"
  | "greatest-coaches"
  | "greatest-lions"
  | "greatest-springboks"
  | "greatest-all-blacks";

export type LegendCatalogEntry = {
  name: string;
  era: LegendEraSlug;
  /** Nation / union hint for resolve + profile country */
  countryName?: string;
  note?: string;
  /** Optional Wikipedia title hint (without wiki URL) */
  wikipediaTitle?: string;
  collections?: LegendCollectionSlug[];
};

export const LEGEND_ERAS: Array<{ slug: LegendEraSlug; label: string; sortOrder: number }> = [
  { slug: "1880s-1890s", label: "1880s–1890s", sortOrder: 1 },
  { slug: "1900s", label: "1900s", sortOrder: 2 },
  { slug: "1910s", label: "1910s", sortOrder: 3 },
  { slug: "1920s", label: "1920s", sortOrder: 4 },
  { slug: "1930s", label: "1930s", sortOrder: 5 },
  { slug: "1940s", label: "1940s", sortOrder: 6 },
  { slug: "1950s", label: "1950s", sortOrder: 7 },
  { slug: "1960s", label: "1960s", sortOrder: 8 },
  { slug: "1970s", label: "1970s", sortOrder: 9 },
  { slug: "1980s", label: "1980s", sortOrder: 10 },
  { slug: "1990s", label: "1990s", sortOrder: 11 },
  { slug: "2000s", label: "2000s", sortOrder: 12 },
  { slug: "2010s", label: "2010s", sortOrder: 13 },
  { slug: "2020s", label: "2020s", sortOrder: 14 },
];

export const LEGEND_COLLECTIONS: Array<{
  slug: LegendCollectionSlug;
  label: string;
  description: string;
  /** Coaches live on `coaches` — Phase 4 */
  entityKind: "player" | "coach";
}> = [
  {
    slug: "greatest-players",
    label: "Greatest Players of All Time",
    description: "The players who defined rugby across every generation.",
    entityKind: "player",
  },
  {
    slug: "greatest-captains",
    label: "Greatest Captains",
    description: "Leaders who shaped teams, tours and World Cups.",
    entityKind: "player",
  },
  {
    slug: "greatest-coaches",
    label: "Greatest Coaches",
    description: "The coaches who shaped modern rugby — linked to coach profiles.",
    entityKind: "coach",
  },
  {
    slug: "greatest-lions",
    label: "Greatest British & Irish Lions",
    description: "Icons of the Lions jersey across eras.",
    entityKind: "player",
  },
  {
    slug: "greatest-springboks",
    label: "Greatest Springboks",
    description: "South Africa’s defining Test and club giants.",
    entityKind: "player",
  },
  {
    slug: "greatest-all-blacks",
    label: "Greatest All Blacks",
    description: "New Zealand’s most influential players.",
    entityKind: "player",
  },
];

function e(
  name: string,
  era: LegendEraSlug,
  countryName?: string,
  collections?: LegendCollectionSlug[],
  note?: string,
): LegendCatalogEntry {
  return { name, era, countryName, collections, note };
}

/**
 * Editorial seed list. Duplicates across eras are OK — seed merges into one profile.
 */
export const PLANET_RUGBY_LEGENDS_CATALOG: LegendCatalogEntry[] = [
  // Eras
  e("William Webb Ellis", "1880s-1890s", "England", undefined, "Symbolic founder"),
  e("Arthur Gould", "1880s-1890s", "Wales"),
  e("Andrew Stoddart", "1880s-1890s", "England"),
  e("Billy Millar", "1900s", "Ireland"),
  e("Dave Gallaher", "1900s", "New Zealand"),
  e("Blair Swannell", "1900s", "Australia", ["greatest-lions"]),
  e("Billy Wallace", "1910s", "Ireland"),
  e("Jimmy Hunter", "1910s", "Scotland"),
  e("Tom Richards", "1910s", "Australia", ["greatest-lions"]),
  e("George Nepia", "1920s", "New Zealand", ["greatest-all-blacks"]),
  e("Cliff Porter", "1920s", "New Zealand", ["greatest-all-blacks"]),
  e("Mark Sugden", "1920s", "England"),
  e("Alexander Obolensky", "1930s", "England", undefined, "Prince Alexander Obolensky"),
  e("Viv Griffiths", "1930s", "Wales"),
  e("Cyril Towers", "1930s", "Australia"),
  e("Charlie Saxton", "1940s", "New Zealand", ["greatest-all-blacks"]),
  e("Bleddyn Williams", "1940s", "Wales"),
  e("Karl Mullen", "1940s", "Ireland"),
  e("Tony O'Reilly", "1950s", "Ireland", ["greatest-lions"]),
  e("Ken Farrington", "1950s", "England"),
  e("Wilson Whineray", "1950s", "New Zealand", ["greatest-all-blacks", "greatest-captains"]),
  e("Barry John", "1960s", "Wales", ["greatest-lions"]),
  e("Colin Meads", "1960s", "New Zealand", ["greatest-all-blacks", "greatest-players"]),
  e("John Dawes", "1960s", "Wales", ["greatest-lions", "greatest-captains"]),
  e("Mike Gibson", "1960s", "Ireland", ["greatest-lions"]),
  e("Gareth Edwards", "1970s", "Wales", ["greatest-players", "greatest-lions"]),
  e("JPR Williams", "1970s", "Wales", ["greatest-lions"]),
  e("Jean-Pierre Rives", "1970s", "France", ["greatest-captains"]),
  e("Andy Irvine", "1970s", "Scotland", ["greatest-lions"]),
  e("Willie John McBride", "1970s", "Ireland", ["greatest-captains", "greatest-lions"]),
  e("David Campese", "1980s", "Australia", ["greatest-players"]),
  e("Serge Blanco", "1980s", "France", ["greatest-players"]),
  e("Michael Jones", "1980s", "New Zealand", ["greatest-all-blacks"]),
  e("Hugo Porta", "1980s", "Argentina"),
  e("Naas Botha", "1980s", "South Africa", ["greatest-springboks"]),
  e("Jonah Lomu", "1990s", "New Zealand", ["greatest-players", "greatest-all-blacks"]),
  e("Francois Pienaar", "1990s", "South Africa", ["greatest-captains", "greatest-springboks"]),
  e("Tim Horan", "1990s", "Australia"),
  e("Philippe Sella", "1990s", "France"),
  e("Martin Johnson", "1990s", "England", [
    "greatest-players",
    "greatest-captains",
    "greatest-lions",
  ]),
  e("Joost van der Westhuizen", "1990s", "South Africa", ["greatest-springboks"]),
  e("Jonny Wilkinson", "2000s", "England"),
  e("Brian O'Driscoll", "2000s", "Ireland", ["greatest-players", "greatest-lions", "greatest-captains"]),
  e("George Gregan", "2000s", "Australia", ["greatest-captains"]),
  e("John Eales", "2000s", "Australia", ["greatest-players", "greatest-captains"]),
  e("Fabien Pelous", "2000s", "France"),
  e("Schalk Burger", "2000s", "South Africa", ["greatest-springboks"]),
  e("Richie McCaw", "2000s", "New Zealand", [
    "greatest-players",
    "greatest-captains",
    "greatest-all-blacks",
  ]),
  e("Richie McCaw", "2010s", "New Zealand", [
    "greatest-players",
    "greatest-captains",
    "greatest-all-blacks",
  ]),
  e("Dan Carter", "2010s", "New Zealand", ["greatest-players", "greatest-all-blacks"]),
  e("Bryan Habana", "2010s", "South Africa", ["greatest-springboks"]),
  e("Thierry Dusautoir", "2010s", "France", ["greatest-captains"]),
  e("Beauden Barrett", "2010s", "New Zealand", ["greatest-all-blacks"]),
  e("Alun Wyn Jones", "2010s", "Wales", ["greatest-lions", "greatest-captains"]),
  e("Sergio Parisse", "2010s", "Italy", ["greatest-captains"]),
  e("Owen Farrell", "2010s", "England", ["greatest-captains"]),
  e("Antoine Dupont", "2020s", "France", ["greatest-players"]),
  e("Eben Etzebeth", "2020s", "South Africa", ["greatest-springboks"]),
  e("Ardie Savea", "2020s", "New Zealand", ["greatest-all-blacks"]),
  e("Siya Kolisi", "2020s", "South Africa", ["greatest-captains", "greatest-springboks"]),
  e("Cheslin Kolbe", "2020s", "South Africa", ["greatest-springboks"]),
  e("Pieter-Steph du Toit", "2020s", "South Africa", ["greatest-springboks"]),
  e("Maro Itoje", "2020s", "England", ["greatest-lions"]),
  e("Caelan Doris", "2020s", "Ireland"),

  // Extra collection-only names not already in eras
  e("Sam Warburton", "2010s", "Wales", ["greatest-lions", "greatest-captains"]),
  e("Frik du Preez", "1960s", "South Africa", ["greatest-springboks"]),
  e("Victor Matfield", "2000s", "South Africa", ["greatest-springboks", "greatest-captains"]),
  e("Sean Fitzpatrick", "1990s", "New Zealand", ["greatest-all-blacks", "greatest-captains"]),
];

/** Merge catalog rows that share the same player name (case-insensitive). */
export function mergeLegendCatalogByName(entries = PLANET_RUGBY_LEGENDS_CATALOG): Array<{
  name: string;
  eras: LegendEraSlug[];
  countryName?: string;
  note?: string;
  wikipediaTitle?: string;
  collections: LegendCollectionSlug[];
}> {
  const map = new Map<
    string,
    {
      name: string;
      eras: LegendEraSlug[];
      countryName?: string;
      note?: string;
      wikipediaTitle?: string;
      collections: Set<LegendCollectionSlug>;
    }
  >();

  for (const entry of entries) {
    const key = entry.name.trim().toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        name: entry.name.trim(),
        eras: [entry.era],
        countryName: entry.countryName,
        note: entry.note,
        wikipediaTitle: entry.wikipediaTitle,
        collections: new Set(entry.collections ?? []),
      });
      continue;
    }
    if (!prev.eras.includes(entry.era)) prev.eras.push(entry.era);
    if (!prev.countryName && entry.countryName) prev.countryName = entry.countryName;
    if (!prev.note && entry.note) prev.note = entry.note;
    if (!prev.wikipediaTitle && entry.wikipediaTitle) prev.wikipediaTitle = entry.wikipediaTitle;
    for (const c of entry.collections ?? []) prev.collections.add(c);
  }

  return [...map.values()].map((row) => ({
    name: row.name,
    eras: row.eras,
    countryName: row.countryName,
    note: row.note,
    wikipediaTitle: row.wikipediaTitle,
    collections: [...row.collections],
  }));
}

export function legendEraLabel(slug: string): string {
  return LEGEND_ERAS.find((e) => e.slug === slug)?.label ?? slug;
}

export function legendCollectionMeta(slug: string) {
  return LEGEND_COLLECTIONS.find((c) => c.slug === slug) ?? null;
}

/** Greatest Coaches catalog — resolves to `coaches` profiles, never players. */
export type LegendCoachCatalogEntry = {
  name: string;
  nationality?: string;
  wikipediaTitle?: string;
};

export const PLANET_RUGBY_LEGEND_COACHES_CATALOG: LegendCoachCatalogEntry[] = [
  { name: "Graham Henry", nationality: "New Zealand", wikipediaTitle: "Graham Henry" },
  { name: "Clive Woodward", nationality: "England", wikipediaTitle: "Clive Woodward" },
  { name: "Kitch Christie", nationality: "South Africa", wikipediaTitle: "Kitch Christie" },
  { name: "Jake White", nationality: "South Africa", wikipediaTitle: "Jake White" },
  { name: "Steve Hansen", nationality: "New Zealand", wikipediaTitle: "Steve Hansen" },
  { name: "Rassie Erasmus", nationality: "South Africa", wikipediaTitle: "Rassie Erasmus" },
];
