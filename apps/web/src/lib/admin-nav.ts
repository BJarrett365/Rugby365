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
    id: "odds",
    label: "Odds & betting",
    value: "Odds",
    description: "BMbets Rugby Union odds import, market snapshots and Betting Intelligence value bets.",
    href: "/admin/odds",
    matchPrefixes: ["/admin/odds"],
  },
  {
    id: "scout",
    label: "Recruitment Index",
    value: "RRI",
    description: "Enhances player Scouting with RRI scores, notes and recruitment targets.",
    href: "/admin/scout",
    matchPrefixes: ["/admin/scout"],
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
    id: "open-meteo",
    label: "Open-Meteo weather",
    value: "Weather",
    description: "Open-Meteo forecast and geocoding for match venue weather and wind (no API key).",
    href: "/admin/keys/open-meteo",
    matchPrefixes: ["/admin/keys/open-meteo"],
  },
  {
    id: "tv-schedule",
    label: "TV Schedule",
    value: "TV",
    description: "Gracenote / PA Media EPG keys for rugby where-to-watch (CMS manual until synced).",
    href: "/admin/keys/tv-schedule",
    matchPrefixes: ["/admin/keys/tv-schedule"],
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

export const ADMIN_ODDS_LINKS: AdminHubLink[] = [
  {
    title: "BMbets import",
    href: "/admin/odds/bmbets",
    description:
      "Primary odds importer — multi-bookmaker consensus from bmbets.com. Rugby Union only, League contaminants rejected, CMS fixtures only.",
    status: "Live",
  },
  {
    title: "Model pick accuracy",
    href: "/admin/odds/model-accuracy",
    description:
      "Graph of Betting Intelligence win-probability leans vs finished results — cumulative correct / wrong %.",
    status: "Live",
  },
  {
    title: "Match Centre Betting Intel",
    href: "/matches",
    description:
      "Public Match Centre Betting Intelligence tab — prediction, value bets and odds when a snapshot is linked.",
    status: "Live",
  },
  {
    title: "BMbets parse API",
    href: "/api/admin/data-sources/bmbets/parse?url=https://www.bmbets.com/rugby-union/south-africa/currie-cup-1st-division/",
    description:
      "JSON preview for BMbets rugby-union listings or match URLs (League rows filtered; match odds resolved from parent listing).",
    status: "API",
  },
];

export const ADMIN_SCOUT_LINKS: AdminHubLink[] = [
  {
    title: "Recruitment targets",
    href: "/admin/scout/targets",
    description: "Players ranked by RRI — an enhancement layer on top of existing Scouting profiles.",
    status: "Live",
  },
  {
    title: "Players CMS",
    href: "/admin/players",
    description:
      "Per-player RRI + scout notes. Scouting bios stay in Bio automation; this panel only adds recruitment scoring.",
    status: "Admin",
  },
  {
    title: "Public Scouting view",
    href: "/players",
    description:
      "Existing /scouting profiles — editorial report first, Recruitment Index scorecard added below.",
    status: "Live",
  },
];

export const ADMIN_HUB_LINKS: Record<AdminHubKey["id"], AdminHubLink[]> = {
  odds: ADMIN_ODDS_LINKS,
  scout: ADMIN_SCOUT_LINKS,
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
    {
      title: "Open-Meteo weather",
      href: "/admin/keys/open-meteo",
      description: "Venue weather and wind via Open-Meteo (no API key; needs venue coordinates).",
      status: "Admin",
    },
    {
      title: "TV Schedule",
      href: "/admin/keys/tv-schedule",
      description: "Gracenote / PA Media keys for rugby TV listings (CMS broadcasters work without keys).",
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
    {
      title: "Open-Meteo weather",
      href: "/admin/keys/open-meteo",
      description: "Open-Meteo weather and geocoding for match venue conditions.",
      status: "Admin",
    },
    {
      title: "TV Schedule",
      href: "/admin/keys/tv-schedule",
      description: "EPG provider credentials for automated where-to-watch sync.",
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
      { href: "/legends", label: "Legends", short: "Legends" },
      { href: "/admin/legends", label: "Legends admin", short: "LegAdm" },
      { href: "/players/compare", label: "Compare players", short: "Compare" },
      { href: "/teams/compare", label: "Compare teams", short: "TeamsCmp" },
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
    id: "odds",
    label: "Odds",
    items: [
      { href: "/admin/odds", label: "Odds hub", short: "Odds" },
      { href: "/admin/odds/bmbets", label: "BMbets import", short: "BMbets" },
      { href: "/admin/odds/model-accuracy", label: "Model accuracy", short: "Accuracy" },
    ],
  },
  {
    id: "scout",
    label: "RRI",
    items: [
      { href: "/admin/scout", label: "RRI hub", short: "RRI" },
      { href: "/admin/scout/targets", label: "RRI targets", short: "Targets" },
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
  // Keys hub chips use prefix match (Odds highlights under /admin/odds/*)
  if (sectionId === "keys") {
    const key = ADMIN_HUB_KEYS.find((k) => k.href === item.href);
    if (key) return hubKeyActive(pathname, key);
  }
  // Odds / Scout hubs: exact so child routes do not light both items
  if (item.href === "/admin/odds" || item.href === "/admin/scout") {
    return pathname === item.href;
  }
  return navItemActive(pathname, item.href);
}

export function flattenNavSections(sections: AdminNavSection[]): AdminNavItem[] {
  return sections.flatMap((section) => section.items);
}
