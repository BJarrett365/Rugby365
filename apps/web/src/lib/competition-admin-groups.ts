/**
 * Admin hierarchy for competitions (Teams picker + Competitions list).
 * Kept separate from `competitionType` (season-kind / feed rules).
 */

export type CompetitionAdminGroupId =
  | "international"
  | "club"
  | "provincial"
  | "regional"
  | "historic"
  | "other";

export const COMPETITION_ADMIN_GROUP_ORDER: CompetitionAdminGroupId[] = [
  "international",
  "club",
  "provincial",
  "regional",
  "historic",
  "other",
];

export const COMPETITION_ADMIN_GROUP_LABELS: Record<CompetitionAdminGroupId, string> = {
  international: "International",
  club: "Club",
  provincial: "Provincial",
  regional: "Regional",
  historic: "Historic",
  other: "Other",
};

type CatalogEntry = {
  group: CompetitionAdminGroupId;
  /** Sort within group (lower first). */
  order: number;
  /** Preferred admin display name when set. */
  label?: string;
};

/**
 * Preferred tree (known competitions). Unknown slugs fall back by competitionType.
 */
const BY_CANONICAL_SLUG: Record<string, CatalogEntry> = {
  // International
  "rugby-world-cup": { group: "international", order: 10, label: "Rugby World Cup" },
  "six-nations": { group: "international", order: 20, label: "Six Nations" },
  "rugby-championship": { group: "international", order: 30, label: "Rugby Championship" },
  "nations-championship": {
    group: "international",
    order: 40,
    label: "World Rugby Nations Championship",
  },
  "world-rugby-nations-cup": {
    group: "international",
    order: 50,
    label: "World Rugby Nations Cup",
  },
  "autumn-nations-cup": { group: "international", order: 60, label: "Autumn Nations Series" },
  "end-of-year-internationals": {
    group: "international",
    order: 65,
    label: "End-of-year Internationals",
  },
  "summer-internationals": { group: "international", order: 70, label: "Summer Internationals" },
  international: { group: "international", order: 72, label: "Summer Internationals" },
  "pacific-nations-cup": { group: "international", order: 80, label: "Pacific Nations Cup" },
  "british-irish-lions": {
    group: "international",
    order: 90,
    label: "British & Irish Lions Tours",
  },
  "world-rugby-u20-championship": {
    group: "international",
    order: 100,
    label: "World Rugby U20 Championship",
  },
  "world-rugby-u20-trophy": {
    group: "international",
    order: 110,
    label: "World Rugby U20 Trophy",
  },
  "world-rugby-pacific-challenge": {
    group: "international",
    order: 120,
    label: "World Rugby Pacific Challenge",
  },

  // Club
  "rugby-champions-cup": { group: "club", order: 10, label: "Investec Champions Cup" },
  "challenge-cup": { group: "club", order: 20, label: "EPCR Challenge Cup" },
  "united-rugby-championship": {
    group: "club",
    order: 30,
    label: "United Rugby Championship",
  },
  premiership: { group: "club", order: 40, label: "Premiership Rugby" },
  "top-14": { group: "club", order: 50, label: "Top 14" },
  "pro-d2": { group: "club", order: 55, label: "Pro D2" },
  nationale: { group: "club", order: 57, label: "Nationale" },
  "super-rugby": { group: "club", order: 60, label: "Super Rugby Pacific" },
  "japan-rugby-league-one": { group: "club", order: 70, label: "Japan Rugby League One" },
  "major-league-rugby": { group: "club", order: 80, label: "Major League Rugby" },
  "super-rugby-americas": { group: "club", order: 90, label: "Super Rugby Americas" },
  championship: { group: "club", order: 100, label: "Championship (England)" },
  "premiership-rugby-cup": { group: "club", order: 105, label: "Premiership Rugby Cup" },
  "national-league-1": { group: "club", order: 110, label: "National League 1" },
  "national-league-2": { group: "club", order: 115, label: "National League 2" },
  "all-ireland-league": { group: "club", order: 120, label: "All-Ireland League" },
  "welsh-premiership": { group: "club", order: 130, label: "Welsh Premiership" },
  "super-series": { group: "club", order: 140, label: "Super Series" },
  "serie-a-elite": { group: "club", order: 150, label: "Serie A Elite" },
  "campeonato-portugues": { group: "club", order: 160, label: "Campeonato Português" },
  "division-de-honor": { group: "club", order: 170, label: "División de Honor" },
  "liga-nationala": { group: "club", order: 180, label: "Liga Națională de Rugby" },
  "didi-10": { group: "club", order: 190, label: "Didi 10" },
  "varsity-cup": { group: "club", order: 200, label: "Varsity Cup" },
  "varsity-shield": { group: "club", order: 210, label: "Varsity Shield" },

  // Provincial
  npc: { group: "provincial", order: 10, label: "NPC" },
  "heartland-championship": { group: "provincial", order: 20, label: "Heartland Championship" },
  "currie-cup": { group: "provincial", order: 30, label: "Currie Cup Premier Division" },
  "currie-cup-first-division": {
    group: "provincial",
    order: 35,
    label: "Currie Cup First Division",
  },
  "ranfurly-shield": { group: "provincial", order: 40, label: "Ranfurly Shield" },
  "farah-palmer-cup": { group: "provincial", order: 45, label: "Farah Palmer Cup" },
  "sa-cup": { group: "provincial", order: 50, label: "SA Cup" },
  "craven-week": { group: "provincial", order: 60, label: "Craven Week" },
  "academy-week": { group: "provincial", order: 70, label: "Academy Week" },
  "sa-schools": { group: "provincial", order: 80, label: "SA Schools" },

  // Regional
  "rugby-europe-championship": {
    group: "regional",
    order: 10,
    label: "Rugby Europe Championship",
  },
  "rugby-europe-super-cup": { group: "regional", order: 20, label: "Rugby Europe Super Cup" },

  // Historic
  "celtic-league": { group: "historic", order: 10, label: "Celtic League" },
  pro12: { group: "historic", order: 20, label: "Pro12" },
  pro14: { group: "historic", order: 30, label: "Pro14" },
  "anglo-welsh-cup": { group: "historic", order: 40, label: "Anglo-Welsh Cup" },
  "heineken-cup": { group: "historic", order: 50, label: "Heineken Cup" },
  "european-challenge-cup-historic": {
    group: "historic",
    order: 60,
    label: "European Rugby Challenge Cup (historic)",
  },
  "air-new-zealand-cup": { group: "historic", order: 70, label: "Air New Zealand Cup" },
  "itm-cup": { group: "historic", order: 80, label: "ITM Cup" },
  "mitre-10-cup": { group: "historic", order: 90, label: "Mitre 10 Cup" },
};

/** Collapse provider-suffixed / alias slugs to catalog keys. */
export function canonicalCompetitionAdminSlug(slug: string): string {
  if (slug.startsWith("npc-")) return "npc";
  if (slug === "currie-cup-first-division" || slug.startsWith("currie-cup-first")) {
    return "currie-cup-first-division";
  }
  if (slug.startsWith("currie-cup")) return "currie-cup";
  if (slug.startsWith("autumn-nations-cup")) return "autumn-nations-cup";
  if (slug.startsWith("summer-internationals")) return "summer-internationals";
  if (slug.startsWith("international")) return "international";
  if (slug.startsWith("heartland")) return "heartland-championship";
  if (slug.startsWith("pacific-nations")) return "pacific-nations-cup";
  if (slug.includes("lions") && (slug.includes("british") || slug.includes("irish"))) {
    return "british-irish-lions";
  }
  if (slug.includes("u20-trophy") || slug.includes("under-20-trophy")) {
    return "world-rugby-u20-trophy";
  }
  if (slug.includes("pacific-challenge")) return "world-rugby-pacific-challenge";
  if (slug.includes("u20") || slug.includes("under-20")) return "world-rugby-u20-championship";
  if (slug.startsWith("super-rugby-americas")) return "super-rugby-americas";
  if (slug.includes("league-one") || slug.includes("jrlo")) return "japan-rugby-league-one";
  if (slug.includes("major-league-rugby") || slug === "mlr") return "major-league-rugby";
  if (slug.startsWith("pro-d2") || slug.includes("pro-d2")) return "pro-d2";
  if (slug.startsWith("farah-palmer")) return "farah-palmer-cup";
  if (slug.startsWith("ranfurly")) return "ranfurly-shield";
  if (slug.startsWith("heineken")) return "heineken-cup";
  if (slug.startsWith("celtic-league")) return "celtic-league";
  if (slug === "pro12" || slug.startsWith("pro-12")) return "pro12";
  if (slug === "pro14" || slug.startsWith("pro-14")) return "pro14";
  return slug;
}

function catalogEntryFor(slug: string): CatalogEntry | null {
  return BY_CANONICAL_SLUG[canonicalCompetitionAdminSlug(slug)] ?? null;
}

export function competitionAdminGroup(comp: {
  slug: string;
  competitionType?: string | null;
}): CompetitionAdminGroupId {
  const entry = catalogEntryFor(comp.slug);
  if (entry) return entry.group;

  const type = comp.competitionType ?? "domestic";
  if (type === "international" || type === "world_cup") return "international";
  if (type === "european") return "club";
  return "other";
}

export function competitionAdminDisplayName(comp: { slug: string; name: string }): string {
  const entry = catalogEntryFor(comp.slug);
  if (entry?.label) return entry.label;
  return comp.name;
}

function sortKey(comp: { slug: string; name: string }): number {
  const entry = catalogEntryFor(comp.slug);
  if (entry) return entry.order;
  return 500 + competitionAdminDisplayName(comp).toLowerCase().charCodeAt(0);
}

export type CompetitionAdminGroup<
  T extends { slug: string; name: string; competitionType?: string | null },
> = {
  id: CompetitionAdminGroupId;
  label: string;
  competitions: T[];
};

/** Group competitions for admin lists / pickers. Empty groups are omitted. */
export function groupCompetitionsForAdmin<
  T extends { slug: string; name: string; competitionType?: string | null },
>(rows: T[]): CompetitionAdminGroup<T>[] {
  const buckets = new Map<CompetitionAdminGroupId, T[]>();
  for (const id of COMPETITION_ADMIN_GROUP_ORDER) buckets.set(id, []);

  for (const row of rows) {
    const group = competitionAdminGroup(row);
    buckets.get(group)!.push(row);
  }

  for (const [, list] of buckets) {
    list.sort((a, b) => {
      const byOrder = sortKey(a) - sortKey(b);
      if (byOrder !== 0) return byOrder;
      return competitionAdminDisplayName(a).localeCompare(competitionAdminDisplayName(b));
    });
  }

  return COMPETITION_ADMIN_GROUP_ORDER.filter((id) => (buckets.get(id)?.length ?? 0) > 0).map(
    (id) => ({
      id,
      label: COMPETITION_ADMIN_GROUP_LABELS[id],
      competitions: buckets.get(id)!,
    }),
  );
}
