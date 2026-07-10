export const WIKIPEDIA_RUGBY_STADIUM_CAPACITY_LIST_TITLE =
  "List of rugby union stadiums by capacity";

export const WIKIPEDIA_RUGBY_STADIUM_CAPACITY_LIST_URL =
  "https://en.wikipedia.org/wiki/List_of_rugby_union_stadiums_by_capacity";

export type WikipediaStadiumCapacityRow = {
  name: string;
  capacity: number;
  city: string | null;
  country: string | null;
  wikipediaTitle: string | null;
  section: "current" | "closed";
};

const STOP_TOKENS = new Set([
  "stadium",
  "stade",
  "park",
  "ground",
  "arena",
  "field",
  "rugby",
  "sports",
  "soccer",
  "football",
  "oval",
  "centre",
  "center",
  "the",
  "and",
  "of",
  "at",
  "on",
  "in",
]);

function stripHtml(value: string): string {
  return value
    .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wikiTitleFromHref(href: string | null): string | null {
  if (!href) return null;
  const slug = href.replace(/^\.\//, "").split("#")[0]?.split("?")[0];
  if (!slug) return null;
  try {
    return decodeURIComponent(slug).replace(/_/g, " ");
  } catch {
    return slug.replace(/_/g, " ");
  }
}

function parseCapacity(value: string): number | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstLinkMeta(cellHtml: string): { text: string; title: string | null } {
  const link = cellHtml.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!link) {
    return { text: stripHtml(cellHtml), title: null };
  }
  return {
    text: stripHtml(link[2] ?? ""),
    title: wikiTitleFromHref(link[1] ?? null),
  };
}

function parseTableRows(tableHtml: string, section: WikipediaStadiumCapacityRow["section"]) {
  const rows: WikipediaStadiumCapacityRow[] = [];
  const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
      cell[1] ?? "",
    );
    if (cells.length < 3) continue;

    const firstCell = stripHtml(cells[0] ?? "");
    if (/^#$/i.test(firstCell) || /^stadium$/i.test(firstCell)) continue;

    const hasIndex = /^\d+$/.test(firstCell);
    const nameCell = hasIndex ? (cells[1] ?? "") : (cells[0] ?? "");
    const capacityCell = hasIndex ? (cells[2] ?? "") : (cells[1] ?? "");
    const cityCell = hasIndex ? (cells[3] ?? "") : (cells[2] ?? "");
    const countryCell = hasIndex ? (cells[4] ?? "") : (cells[3] ?? "");

    const stadium = firstLinkMeta(nameCell);
    const capacity = parseCapacity(stripHtml(capacityCell));
    if (!stadium.text || capacity == null) continue;

    rows.push({
      name: stadium.text,
      capacity,
      city: stripHtml(cityCell) || null,
      country: stripHtml(countryCell) || null,
      wikipediaTitle: stadium.title,
      section,
    });
  }

  return rows;
}

export function parseWikipediaStadiumCapacityListHtml(html: string): WikipediaStadiumCapacityRow[] {
  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)].map((match) => match[1] ?? "");
  if (tables.length === 0) return [];

  const current = parseTableRows(tables[0] ?? "", "current");
  const closed = tables[1] ? parseTableRows(tables[1], "closed") : [];

  const byKey = new Map<string, WikipediaStadiumCapacityRow>();
  for (const row of [...current, ...closed]) {
    byKey.set(normalizeVenueName(row.name), row);
  }
  return [...byKey.values()];
}

export function normalizeVenueName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function significantVenueTokens(name: string): string[] {
  return normalizeVenueName(name)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_TOKENS.has(token));
}

/** Known sponsor / CMS names mapped to Wikipedia list labels. */
export const VENUE_CAPACITY_LIST_ALIASES: Record<string, string> = {
  [normalizeVenueName("BT Murrayfield")]: "Murrayfield Stadium",
  [normalizeVenueName("Affidea Stadium")]: "Ravenhill Stadium",
  [normalizeVenueName("Millennium Stadium")]: "Principality Stadium",
  [normalizeVenueName("Ashton Gate")]: "Ashton Gate Stadium",
  [normalizeVenueName("Accor Stadium")]: "Stadium Australia",
  [normalizeVenueName("ANZ Stadium")]: "Stadium Australia",
  [normalizeVenueName("Emirates Airline Park")]: "Ellis Park Stadium",
  [normalizeVenueName("Hollywoodbets Kings Park, Durban")]: "Kings Park Stadium",
  [normalizeVenueName("Kings Park")]: "Kings Park Stadium",
  [normalizeVenueName("Dexcom Stadium")]: "Sandy Park",
  [normalizeVenueName("DAM Health Stadium")]: "Kingston Park",
  [normalizeVenueName("The Dam Health Stadium")]: "Kingston Park",
  [normalizeVenueName("Chichibunomiya Stadium")]: "Chichibunomiya Rugby Stadium",
  [normalizeVenueName("Ernest Wallon Stadium")]: "Stade Ernest-Wallon",
  [normalizeVenueName("Stade Ernest Wallon")]: "Stade Ernest-Wallon",
  [normalizeVenueName("Jose Amalfitani")]: "Estadio José Amalfitani",
  [normalizeVenueName("Mt. Smart Stadium")]: "Mt Smart Stadium",
  [normalizeVenueName("Cardiff Arms Park")]: "BT Sport Cardiff Arms Park",
  [normalizeVenueName("Allianz Stadium")]: "Sydney Football Stadium",
  [normalizeVenueName("Amedee-Domenech Stadium")]: "Stade Amédée-Domenech",
  [normalizeVenueName("StoneX Stadium")]: "Allianz Park",
  [normalizeVenueName("Swansea.com Stadium")]: "Liberty Stadium",
  [normalizeVenueName("Gtech COmmunity Stadium")]: "Brentford Community Stadium",
  [normalizeVenueName("Cardiff City Stadium")]: "Cardiff City Stadium",
  [normalizeVenueName("One NZ Stadium")]: "One New Zealand Stadium",
  [normalizeVenueName("Welford Road Stadium")]: "Welford Road",
  [normalizeVenueName("Hnry Stadium")]: "Sky Stadium",
  [normalizeVenueName("HNRY Stadium")]: "Sky Stadium",
  [normalizeVenueName("Wellington Regional Stadium")]: "Sky Stadium",
};

export function buildStadiumCapacityListIndex(rows: WikipediaStadiumCapacityRow[]) {
  const byName = new Map<string, WikipediaStadiumCapacityRow>();
  const byNorm = new Map<string, WikipediaStadiumCapacityRow>();
  for (const row of rows) {
    byName.set(row.name, row);
    byNorm.set(normalizeVenueName(row.name), row);
  }
  return { byName, byNorm };
}

export function matchVenueToStadiumCapacityRow(
  venueName: string,
  index: ReturnType<typeof buildStadiumCapacityListIndex>,
): { row: WikipediaStadiumCapacityRow; method: string } | null {
  const trimmed = venueName.trim();
  if (!trimmed) return null;

  const aliasTarget = VENUE_CAPACITY_LIST_ALIASES[normalizeVenueName(trimmed)];
  if (aliasTarget) {
    const aliasRow = index.byName.get(aliasTarget) ?? index.byNorm.get(normalizeVenueName(aliasTarget));
    if (aliasRow) return { row: aliasRow, method: "alias" };
  }

  const norm = normalizeVenueName(trimmed);
  const exact = index.byNorm.get(norm);
  if (exact) return { row: exact, method: "exact" };

  if (norm.length >= 8) {
    for (const [candidateNorm, row] of index.byNorm.entries()) {
      if (candidateNorm.includes(norm) || norm.includes(candidateNorm)) {
        return { row, method: "substring" };
      }
    }
  }

  const venueTokens = significantVenueTokens(trimmed);
  if (venueTokens.length === 0) return null;

  let best: { row: WikipediaStadiumCapacityRow; score: number } | null = null;
  for (const row of index.byNorm.values()) {
    const rowTokens = significantVenueTokens(row.name);
    if (rowTokens.length === 0) continue;
    const overlap = venueTokens.filter((token) => rowTokens.includes(token));
    if (overlap.length < 2) continue;
    const score = overlap.length / Math.max(venueTokens.length, rowTokens.length);
    if (score >= 0.75 && (!best || score > best.score)) {
      best = { row, score };
    }
  }

  return best ? { row: best.row, method: "tokens" } : null;
}

const USER_AGENT = "Rugby365ArchiveImport/1.0 (read-only; venue capacity import)";

export async function fetchWikipediaStadiumCapacityListHtml(
  lang = "en",
): Promise<string> {
  const slug = WIKIPEDIA_RUGBY_STADIUM_CAPACITY_LIST_TITLE.replace(/ /g, "_");
  const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(slug)}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`Wikipedia stadium capacity list fetch failed (${res.status})`);
  }
  return res.text();
}

export async function fetchWikipediaStadiumCapacityList(): Promise<WikipediaStadiumCapacityRow[]> {
  const html = await fetchWikipediaStadiumCapacityListHtml();
  return parseWikipediaStadiumCapacityListHtml(html);
}
