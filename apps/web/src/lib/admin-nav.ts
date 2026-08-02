import { KNOWLEDGE_NAV_ITEMS } from "./knowledge-catalog";

export type AdminNavItem = {
  href: string;
  label: string;
  short: string;
};

export type AdminNavSection = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export type AdminHubLink = {
  title: string;
  href: string;
  description: string;
  status?: "Live" | "Admin" | "API";
};

export type AdminHubKey = {
  id: string;
  label: string;
  value: string;
  description: string;
  href: string;
  /** Paths that should highlight this key in navigation */
  matchPrefixes: string[];
};

export const ADMIN_HUB_KEYS: AdminHubKey[] = [
  {
    id: "imports",
    label: "Data imports",
    value: "Imports",
    description: "Planet Rugby, LiveSport, matches, RugbyPass players and World Rugby rankings.",
    href: "/admin/imports",
    matchPrefixes: [
      "/admin/imports",
      "/admin/competitions/import",
      "/admin/competitions/import-livesport",
      "/admin/matches/import",
      "/admin/players/import",
      "/admin/coaches/import",
      "/admin/referees/import",
      "/admin/world-rankings",
    ],
  },
  {
    id: "sandbox",
    label: "Operator sandbox",
    value: "Sandbox",
    description: "Agent runs, commentary research and live match operator tools.",
    href: "/admin/sandbox",
    matchPrefixes: ["/admin/sandbox", "/admin/agent-sandbox", "/admin/commentary-research", "/admin/operator"],
  },
  {
    id: "api",
    label: "Parse & sync APIs",
    value: "API",
    description: "Data-source parse endpoints for Planet Rugby, LiveSport, Sport365, Wikipedia and RugbyPass.",
    href: "/admin/api",
    matchPrefixes: ["/admin/api", "/api/admin/data-sources"],
  },
  {
    id: "openai",
    label: "AI providers",
    value: "OpenAI",
    description: "OpenAI API key and default model for bios, enrichment and commentary.",
    href: "/admin/keys/openai",
    matchPrefixes: ["/admin/keys/openai"],
  },
  {
    id: "rugby-data",
    label: "Rugby Data API",
    value: "Rugby Data",
    description: "Primary provider base URL and token for comps, teams, matches, stats and tables.",
    href: "/admin/keys/rugby-data",
    matchPrefixes: ["/admin/keys/rugby-data"],
  },
  {
    id: "supabase",
    label: "Supabase",
    value: "Supabase",
    description: "Supabase project URL, anon key and service role for Auth, DB and Storage.",
    href: "/admin/keys/supabase",
    matchPrefixes: ["/admin/keys/supabase"],
  },
  {
    id: "wiki",
    label: "Wikipedia & Wikimedia",
    value: "Wiki",
    description: "Wikipedia entity import, Wikimedia credentials and enrichment.",
    href: "/admin/wiki",
    matchPrefixes: ["/admin/wiki", "/admin/wikipedia", "/admin/integrations/wikimedia"],
  },
];

export const ADMIN_OPTA_STATS_LINKS: AdminHubLink[] = [
  {
    title: "Players",
    href: "/admin/players",
    description:
      "Player profiles with availability, season stats and match-by-match SDMS performance on each edit page.",
    status: "Live",
  },
  {
    title: "Teams",
    href: "/admin/teams",
    description: "Team season stats and match aggregates imported from Planet Rugby / SDMS.",
    status: "Live",
  },
  {
    title: "Matches",
    href: "/admin/matches",
    description: "Fixture-level team and player stats after Planet Rugby match import.",
    status: "Live",
  },
  {
    title: "Import match stats",
    href: "/admin/matches/import",
    description: "Pull SDMS performance data from Planet Rugby match URLs.",
    status: "Live",
  },
  {
    title: "Insight Stats",
    href: "/admin/insight-stats",
    description: "Central insight generation and publishing hub (Stats Brain).",
    status: "Admin",
  },
  {
    title: "Injuries",
    href: "/admin/availability/injuries",
    description: "Public injury availability — status, return dates and matches missed.",
    status: "Live",
  },
  {
    title: "Suspensions",
    href: "/admin/availability/suspensions",
    description: "Public disciplinary availability — hearings, bans and return dates.",
    status: "Live",
  },
];

export const ADMIN_HUB_LINKS: Record<AdminHubKey["id"], AdminHubLink[]> = {
  imports: [
    {
      title: "Planet Rugby leagues",
      href: "/admin/competitions/import",
      description: "Import competition tables, fixtures and results from planetrugby.com tournament pages.",
      status: "Live",
    },
    {
      title: "LiveSport leagues",
      href: "/admin/competitions/import-livesport",
      description: "Import tables, fixtures and results from livesport.com for Premiership, Top 14, URC, Super Rugby, Six Nations and more.",
      status: "Live",
    },
    {
      title: "Match import",
      href: "/admin/matches/import",
      description: "Import single matches or bulk tournament results from Planet Rugby and Sport365 URLs.",
      status: "Live",
    },
    {
      title: "RugbyPass players",
      href: "/admin/players/import",
      description: "Preview and import player profiles from rugbypass.com player pages.",
      status: "Live",
    },
    {
      title: "Wikipedia coaches",
      href: "/admin/coaches/import",
      description: "Import coaches from Wikipedia articles or category pages (e.g. England national team coaches).",
      status: "Live",
    },
    {
      title: "Wikipedia referees",
      href: "/admin/referees/import",
      description: "Import referees from Wikipedia articles or category pages (e.g. English rugby union referees).",
      status: "Live",
    },
    {
      title: "World Rugby rankings",
      href: "/admin/world-rankings",
      description: "Sync men's and women's World Rugby ranking tables into the CMS.",
      status: "Live",
    },
  ],
  sandbox: [
    {
      title: "Agent sandbox",
      href: "/admin/agent-sandbox",
      description: "Run the match operator agent against a live Sport365 fixture with approval gates.",
      status: "Admin",
    },
    {
      title: "Commentary research",
      href: "/admin/commentary-research",
      description: "R&D workspace for commentary rules, knowledge base and pipeline experiments.",
      status: "Admin",
    },
    {
      title: "Operator console",
      href: "/admin/operator",
      description: "Live fixture console for commentary production and match-day operations.",
      status: "Live",
    },
  ],
  api: [
    {
      title: "Planet Rugby parse",
      href: "/api/admin/data-sources/planet-rugby/parse?url=https://www.planetrugby.com/tournament/premiership/results",
      description: "Parse Planet Rugby match, tournament or fixtures pages as JSON.",
      status: "API",
    },
    {
      title: "LiveSport parse",
      href: "/api/admin/data-sources/livesport/parse?url=https://www.livesport.com/uk/rugby-union/europe/six-nations/",
      description: "Parse LiveSport competition pages for fixtures, results and computed standings.",
      status: "API",
    },
    {
      title: "Sport365 parse",
      href: "/api/admin/data-sources/sport365/parse?url=https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586",
      description: "Parse Sport365 match pages for lineups, incidents and metadata.",
      status: "API",
    },
    {
      title: "Wikipedia parse",
      href: "/api/admin/data-sources/wikipedia/parse?url=https://en.wikipedia.org/wiki/Blair_Kinghorn",
      description: "Parse Wikipedia infoboxes for players, teams and competitions.",
      status: "API",
    },
    {
      title: "RugbyPass parse",
      href: "/api/admin/data-sources/rugbypass/parse?url=https://www.rugbypass.com/players/pierre-schoeman/",
      description: "Parse RugbyPass player pages for profile and recent match history.",
      status: "API",
    },
    {
      title: "Rugby Union API",
      href: "/api/v1/rugby-union/teams",
      description:
        "Local Rugby Union API (match, league, team, discovery). Same contract as Postman collection.",
      status: "API",
    },
    {
      title: "OpenAI keys",
      href: "/admin/keys/openai",
      description: "Configure OpenAI API key and default model for AI-assisted CMS features.",
      status: "Admin",
    },
    {
      title: "Rugby Data API keys",
      href: "/admin/keys/rugby-data",
      description: "Configure Rugby Data API base URL and token (P1 provider).",
      status: "Admin",
    },
    {
      title: "Supabase keys",
      href: "/admin/keys/supabase",
      description: "Configure Supabase project URL, anon key and service role.",
      status: "Admin",
    },
  ],
  wiki: [
    {
      title: "Wikipedia season import",
      href: "/admin/wikipedia/season-import",
      description: "Import Premiership season tables, fixtures, playoffs, attendance and champions from Wikipedia.",
      status: "Live",
    },
    {
      title: "Wikipedia import",
      href: "/admin/wikipedia/import",
      description: "Import or enrich players, teams and competitions from Wikipedia URLs.",
      status: "Live",
    },
    {
      title: "Wikimedia integration",
      href: "/admin/integrations/wikimedia",
      description: "Configure Wikimedia Enterprise API credentials for authenticated Wikipedia access.",
      status: "Admin",
    },
    {
      title: "OpenAI keys",
      href: "/admin/keys/openai",
      description: "Same Plexa-style provider key template for OpenAI API access and model defaults.",
      status: "Admin",
    },
    {
      title: "Rugby Data API keys",
      href: "/admin/keys/rugby-data",
      description: "Primary rugby data provider credentials for sync and mapping.",
      status: "Admin",
    },
    {
      title: "Supabase keys",
      href: "/admin/keys/supabase",
      description: "Supabase project credentials for Auth, Database and Storage.",
      status: "Admin",
    },
  ],
};

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    id: "home",
    label: "",
    items: [{ href: "/admin", label: "Dashboard", short: "Home" }],
  },
  {
    id: "content",
    label: "Content",
    items: [
      { href: "/admin/matches", label: "Matches", short: "Matches" },
      { href: "/admin/teams", label: "Teams", short: "Teams" },
      { href: "/admin/competitions", label: "Competitions", short: "Comps" },
      { href: "/admin/players", label: "Players", short: "Players" },
      { href: "/admin/coaches", label: "Coaches", short: "Coaches" },
      { href: "/admin/transfers", label: "Transfers", short: "Xfer" },
      { href: "/admin/squad-audit", label: "Squad audit", short: "SqAud" },
      { href: "/admin/venues", label: "Venues", short: "Venues" },
      { href: "/admin/referees", label: "Referees", short: "Refs" },
      { href: "/admin/squads", label: "Squads", short: "Squads" },
      { href: "/admin/data-audit", label: "Data audit", short: "Audit" },
      { href: "/admin/season-repair", label: "Season repair", short: "Seasons" },
      { href: "/admin/data-audit/squads", label: "Membership audit", short: "Memb" },
      { href: "/admin/opta-stats", label: "Opta Stats", short: "Stats" },
      { href: "/admin/tables", label: "Tables", short: "Tables" },
      { href: "/admin/rating-lab", label: "Rating Lab", short: "Ratings" },
    ],
  },
  {
    id: "availability",
    label: "Availability",
    items: [
      { href: "/admin/availability/injuries", label: "Injuries", short: "Inj" },
      { href: "/admin/availability/suspensions", label: "Suspensions", short: "Susp" },
    ],
  },
  {
    id: "keys",
    label: "Keys",
    items: [
      { href: "/admin/knowledge", label: "Knowledge Base", short: "KB" },
      ...KNOWLEDGE_NAV_ITEMS,
      ...ADMIN_HUB_KEYS.map((key) => ({
        href: key.href,
        label: key.value,
        short: key.value.slice(0, 4),
      })),
    ],
  },
];

/** Flat list for mobile bottom nav */
export const ADMIN_BOTTOM_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", short: "Home" },
  { href: "/admin/matches", label: "Matches", short: "Matches" },
  { href: "/admin/players", label: "Players", short: "Players" },
  ...ADMIN_HUB_KEYS.map((key) => ({
    href: key.href,
    label: key.value,
    short: key.value.slice(0, 4),
  })),
];

export function navItemActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  if (href.startsWith("/api")) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hubKeyActive(pathname: string, key: AdminHubKey): boolean {
  return key.matchPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isNavItemActive(pathname: string, item: AdminNavItem, sectionId?: string): boolean {
  if (sectionId === "keys") {
    const key = ADMIN_HUB_KEYS.find((k) => k.href === item.href);
    if (key) return hubKeyActive(pathname, key);
  }
  return navItemActive(pathname, item.href);
}

export function flattenNavSections(sections: AdminNavSection[]): AdminNavItem[] {
  return sections.flatMap((section) => section.items);
}
