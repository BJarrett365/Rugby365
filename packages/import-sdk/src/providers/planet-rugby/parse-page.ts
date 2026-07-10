import type { PlanetRugbyLink, PlanetRugbyMatchUrlParts, PlanetRugbyPageSection } from "../types";
import { slugToDisplayName } from "./parse-url";

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(text: string): string {
  return decodeHtml(text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function readMetaContent(html: string, attr: string, value: string): string | undefined {
  const re = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${value}["']`, "i");
  return html.match(re)?.[1] ?? html.match(alt)?.[1];
}

function readSportsEventJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1] ?? "") as Record<string, unknown>;
      if (parsed["@type"] === "SportsEvent") return parsed;
    } catch {
      /* skip */
    }
  }
  return null;
}

function parseTitleTeams(title: string): { home?: string; away?: string; competition?: string } {
  const m = title.match(/^(.+?)\s+v\s+(.+?)(?:\s+\[(.+?)\])?(?:\s+\(|$)/i);
  if (!m) return {};
  return { home: m[1]?.trim(), away: m[2]?.trim(), competition: m[3]?.trim() };
}

function extractWidgetCompCode(html: string, widgetId: string): string | undefined {
  const re = new RegExp(`data-widget-id=["']${widgetId}["'][^>]*data-comp-code=["']([^"']+)["']`, "i");
  const alt = new RegExp(`data-comp-code=["']([^"']+)["'][^>]*data-widget-id=["']${widgetId}["']`, "i");
  return html.match(re)?.[1] ?? html.match(alt)?.[1];
}

function sectionPresent(html: string, title: string, widgetId: string): boolean {
  const hasHeading = new RegExp(`<h2[^>]*>\\s*${title}\\s*<\\/h2>`, "i").test(html);
  const hasWidget = html.includes(`data-widget-id="${widgetId}"`);
  return hasHeading || hasWidget;
}

export function extractPlanetRugbyLinks(html: string, baseUrl: string): {
  teamLinks: PlanetRugbyLink[];
  competitionLinks: PlanetRugbyLink[];
} {
  const teamLinks: PlanetRugbyLink[] = [];
  const competitionLinks: PlanetRugbyLink[] = [];
  const seen = new Set<string>();

  const re = /href=["'](https:\/\/www\.planetrugby\.com\/[^"']+|\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const hrefRaw = m[1] ?? "";
    const label = stripTags(m[2] ?? "");
    if (!label || label.length > 80) continue;
    let href: string;
    try {
      href = new URL(hrefRaw, baseUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);

    if (/\/team\/[^/]+/.test(href)) {
      teamLinks.push({ href, label, kind: "team" });
    } else if (/\/tournament\/[^/]+/.test(href)) {
      competitionLinks.push({ href, label, kind: "competition" });
    }
  }

  return { teamLinks, competitionLinks };
}

export function parsePlanetRugbyMatchPageHtml(
  html: string,
  sourceUrl: string,
  urlParts: PlanetRugbyMatchUrlParts,
): {
  matchTitle: string;
  competition: string;
  kickoffAt?: string;
  kickoffLabel?: string;
  matchStatus: string;
  homeTeamName: string;
  awayTeamName: string;
  venue?: string;
  sdmsMatchId?: string;
  sections: {
    table: PlanetRugbyPageSection;
    fixtures: PlanetRugbyPageSection;
    results: PlanetRugbyPageSection;
  };
  teamLinks: PlanetRugbyLink[];
  competitionLinks: PlanetRugbyLink[];
} {
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const twitterTitle = readMetaContent(html, "name", "twitter:title");
  const description = readMetaContent(html, "name", "description");
  const rawTitle = stripTags(twitterTitle ?? titleTag?.[1] ?? "");
  const fromTitle = parseTitleTeams(rawTitle);

  const sportsEvent = readSportsEventJsonLd(html);
  const homeFromLd =
    sportsEvent && typeof sportsEvent.homeTeam === "object" && sportsEvent.homeTeam !== null
      ? String((sportsEvent.homeTeam as Record<string, unknown>).name ?? "")
      : "";
  const awayFromLd =
    sportsEvent && typeof sportsEvent.awayTeam === "object" && sportsEvent.awayTeam !== null
      ? String((sportsEvent.awayTeam as Record<string, unknown>).name ?? "")
      : "";

  const homeTeamName =
    fromTitle.home ?? (homeFromLd || slugToDisplayName(urlParts.home_team));
  const awayTeamName =
    fromTitle.away ?? (awayFromLd || slugToDisplayName(urlParts.away_team));
  const competition =
    fromTitle.competition ?? slugToDisplayName(urlParts.competition_slug);

  const widgetHome = html.match(/data-home-team-name=["']([^"']+)["']/i)?.[1];
  const widgetAway = html.match(/data-away-team-name=["']([^"']+)["']/i)?.[1];
  const sdmsMatchId = html.match(/data-match-id=["']([^"']+)["']/i)?.[1];

  const kickoffLabel = description?.match(/\((\d{1,2}\s+\w+\s+\d{4},\s*[^)]+)\)/i)?.[1];
  const kickoffAt =
    sportsEvent && typeof sportsEvent.startDate === "string"
      ? sportsEvent.startDate
      : urlParts.match_date;

  let matchStatus = "unknown";
  if (/\- Live$/i.test(rawTitle)) matchStatus = "live";
  else if (/\- Result$/i.test(rawTitle) || /full.?time|finished/i.test(description ?? ""))
    matchStatus = "result";
  else if (/fixture|upcoming/i.test(description ?? "")) matchStatus = "fixture";

  const venue = description?.match(/from\s+(.+?)\./i)?.[1];

  const tableComp = extractWidgetCompCode(html, "ps-table-league-lite");
  const fixturesComp = extractWidgetCompCode(html, "ps-fixtures-lite");
  const resultsComp = extractWidgetCompCode(html, "ps-results-lite");

  const { teamLinks, competitionLinks } = extractPlanetRugbyLinks(html, sourceUrl);

  if (!teamLinks.some((l) => l.href.includes(urlParts.home_team))) {
    teamLinks.unshift({
      href: `https://www.planetrugby.com/team/${urlParts.home_team}`,
      label: widgetHome ?? homeTeamName,
      kind: "team",
    });
  }
  if (!teamLinks.some((l) => l.href.includes(urlParts.away_team))) {
    teamLinks.unshift({
      href: `https://www.planetrugby.com/team/${urlParts.away_team}`,
      label: widgetAway ?? awayTeamName,
      kind: "team",
    });
  }
  if (!competitionLinks.some((l) => l.href.includes(urlParts.competition_slug))) {
    competitionLinks.unshift({
      href: `https://www.planetrugby.com/tournament/${urlParts.competition_slug}`,
      label: competition,
      kind: "competition",
    });
  }

  return {
    matchTitle: rawTitle || `${homeTeamName} v ${awayTeamName}`,
    competition,
    kickoffAt,
    kickoffLabel,
    matchStatus,
    homeTeamName: widgetHome ?? homeTeamName,
    awayTeamName: widgetAway ?? awayTeamName,
    venue,
    sdmsMatchId,
    sections: {
      table: {
        id: "table",
        title: "Table",
        present: sectionPresent(html, "Table", "ps-table-league-lite"),
        widgetId: "ps-table-league-lite",
        competitionExternalId: tableComp ?? urlParts.competition_external_id,
      },
      fixtures: {
        id: "fixtures",
        title: "Fixtures",
        present: sectionPresent(html, "Fixtures", "ps-fixtures-lite"),
        widgetId: "ps-fixtures-lite",
        competitionExternalId: fixturesComp ?? urlParts.competition_external_id,
      },
      results: {
        id: "results",
        title: "Results",
        present: sectionPresent(html, "Results", "ps-results-lite"),
        widgetId: "ps-results-lite",
        competitionExternalId: resultsComp ?? urlParts.competition_external_id,
      },
    },
    teamLinks,
    competitionLinks,
  };
}

export function parsePlanetRugbyFixturesPageHtml(html: string, sourceUrl: string): {
  pageTitle: string;
  description?: string;
  sections: PlanetRugbyPageSection[];
  teamLinks: PlanetRugbyLink[];
  competitionLinks: PlanetRugbyLink[];
} {
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const twitterTitle = readMetaContent(html, "name", "twitter:title");
  const description = readMetaContent(html, "name", "description");
  const { teamLinks, competitionLinks } = extractPlanetRugbyLinks(html, sourceUrl);

  const sections: PlanetRugbyPageSection[] = [
    {
      id: "fixtures_all",
      title: "Fixtures",
      present: html.includes('data-widget-id="ps-fixtures-league-all"'),
      widgetId: "ps-fixtures-league-all",
    },
  ];

  return {
    pageTitle: stripTags(twitterTitle ?? titleTag?.[1] ?? "Fixtures"),
    description,
    sections,
    teamLinks,
    competitionLinks,
  };
}

const TOURNAMENT_WIDGET_IDS = [
  "ps-table-league",
  "ps-table-league-lite",
  "ps-fixtures-league",
  "ps-fixtures-league-lite",
  "ps-results-league",
  "ps-results-league-lite",
] as const;

export function extractSdmsCompCodeFromTournamentHtml(html: string): string | undefined {
  for (const widgetId of TOURNAMENT_WIDGET_IDS) {
    const code = extractWidgetCompCode(html, widgetId);
    if (code) return code;
  }
  const generic = html.match(/data-comp-code=["']([a-z0-9]+)["']/i);
  return generic?.[1];
}

export function parsePlanetRugbyTournamentPageHtml(
  html: string,
  sourceUrl: string,
  competitionSlug: string,
  pageType: "table" | "fixtures" | "results" | "overview",
): {
  competitionName: string;
  sdmsCompCode?: string;
} {
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const twitterTitle = readMetaContent(html, "name", "twitter:title");
  const rawTitle = stripTags(twitterTitle ?? titleTag?.[1] ?? slugToDisplayName(competitionSlug));
  const competitionName = rawTitle
    .replace(/\s+(Table|Fixtures|Results).*$/i, "")
    .replace(/\s*\|.*$/, "")
    .trim();

  return {
    competitionName: competitionName || slugToDisplayName(competitionSlug),
    sdmsCompCode: extractSdmsCompCodeFromTournamentHtml(html),
  };
}
