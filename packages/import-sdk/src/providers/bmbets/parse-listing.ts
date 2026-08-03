import {
  classifyBmbetsLeagueContamination,
  parseBmbetsUrl,
} from "./parse-url";
import type { BmbetsListingMatch, BmbetsListingPreview, BmbetsMatchPreview } from "./types";

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseDecimal(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 1 ? Math.round(n * 1000) / 1000 : null;
}

function absoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `https://www.bmbets.com${href.startsWith("/") ? "" : "/"}${href}`;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeCompKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** True when page title/header refers to the same competition as the match URL slug. */
function pageCompetitionMatchesSlug(
  pageCompetition: string | null | undefined,
  competitionSlug: string | null | undefined,
): boolean {
  if (!pageCompetition?.trim() || !competitionSlug?.trim()) return false;
  const left = normalizeCompKey(pageCompetition);
  const right = normalizeCompKey(competitionSlug);
  if (!left || !right) return false;
  return left.includes(right.slice(0, Math.min(8, right.length))) || right.includes(left.slice(0, Math.min(6, left.length)));
}

/**
 * Last competition listing anchor before a match row (not a match URL / team link).
 * Used on mixed rugby-union index pages only.
 */
function nearbyCompetitionListingLabel(htmlBefore: string): string | null {
  const anchors = [
    ...htmlBefore.matchAll(/href="(\/rugby-union\/[a-z0-9-]+\/[a-z0-9-]+\/)"[^>]*>([^<]{2,80})<\/a>/gi),
  ];
  for (let i = anchors.length - 1; i >= 0; i--) {
    const href = anchors[i]![1]!;
    if (/-v-/i.test(href) || /\/(tables|results-fixtures)\//i.test(href)) continue;
    const label = stripTags(anchors[i]![2]!);
    if (label && !/rugby union|matches/i.test(label)) return label;
  }
  return null;
}

/**
 * Combine BMbets day label + HH:mm into an ISO timestamp (treat wall clock as UTC when TZ unknown).
 */
export function parseBmbetsKickoffIso(
  dayLabel: string | null | undefined,
  timeLabel: string | null | undefined,
): string | null {
  if (!dayLabel?.trim()) return null;
  const cleaned = dayLabel.replace(/^[A-Za-z]+,\s*/, "").trim();
  const time = (timeLabel ?? "12:00").trim();
  const d = new Date(`${cleaned} ${time} UTC`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(cleaned);
    if (Number.isNaN(fallback.getTime())) return null;
    return fallback.toISOString();
  }
  return d.toISOString();
}

function extractOddsFromRow(body: string): {
  home: number | null;
  draw: number | null;
  away: number | null;
  bookmakerCount: number | null;
} {
  const cells = [...body.matchAll(/<td class='odds-col4'[^>]*>[\s\S]*?<\/td>/gi)].map((m) => {
    const withoutMobile = m[0]!.replace(
      /<span class="mobile-bet-type"[^>]*>[\s\S]*?<\/span>/gi,
      "",
    );
    return parseDecimal(stripTags(withoutMobile));
  });

  const nums = cells.filter((n): n is number => n != null);
  let home: number | null = null;
  let draw: number | null = null;
  let away: number | null = null;
  if (nums.length >= 3) {
    home = nums[0]!;
    draw = nums[1]!;
    away = nums[2]!;
  } else if (nums.length === 2) {
    home = nums[0]!;
    away = nums[1]!;
  }

  const bkMatch = body.match(/badge-primary[^>]*>\s*(\d+)\s*</i);
  const bookmakerCount = bkMatch ? Number(bkMatch[1]) : null;

  return { home, draw, away, bookmakerCount: Number.isFinite(bookmakerCount) ? bookmakerCount : null };
}

/**
 * Parse BMbets competition or sport listing HTML for upcoming rugby-union matches.
 */
export function parseBmbetsListingHtml(html: string, sourceUrl: string): BmbetsListingPreview {
  const parsedUrl = parseBmbetsUrl(sourceUrl);
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? stripTags(titleMatch[1]!) : null;

  const matches: BmbetsListingMatch[] = [];
  const seen = new Set<string>();
  let currentDay: string | null = null;
  let currentCompetition: string | null =
    title && !/sporting events/i.test(title) ? title.replace(/\s*Beting.*$/i, "").trim() : null;

  // Competition headers often appear as <h2>Region</h2> + sidebar links; also match-info day rows.
  const rowRe = /<tr([^>]*)>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const attrs = row[1] ?? "";
    const body = row[2] ?? "";
    const className = attrs.match(/class="([^"]*)"/i)?.[1] ?? "";

    if (/\bmatch-info\b/.test(className)) {
      const firstTd = body.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      const dayText = firstTd ? stripTags(firstTd[1]!) : stripTags(body);
      if (
        /\d{4}/.test(dayText) ||
        /July|August|January|February|March|April|May|June|September|October|November|December/i.test(
          dayText,
        )
      ) {
        currentDay = dayText.replace(/\s*1\s*X\s*2.*$/i, "").trim() || currentDay;
      }
      continue;
    }

    if (!/\bmain-table-row\b/.test(className)) continue;

    const linkMatch = body.match(
      /href="(\/rugby-union\/[^"]+-v-[^"]+-\d+\/)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?href="\/rugby-union\/[^"]+-v-[^"]+-\d+\/"[^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!linkMatch) continue;

    const href = absoluteUrl(linkMatch[1]!);
    if (seen.has(href)) continue;
    seen.add(href);

    const homeName = stripTags(linkMatch[2]!);
    const awayName = stripTags(linkMatch[3]!);
    const hour = body.match(/class="hour"[^>]*>([^<]+)/i)?.[1]?.trim() ?? null;
    const odds = extractOddsFromRow(body);

    let regionSlug: string | null = parsedUrl.regionSlug;
    let competitionSlug: string | null = parsedUrl.competitionSlug;
    let competitionName: string | null = currentCompetition;
    try {
      const matchUrl = parseBmbetsUrl(href);
      regionSlug = matchUrl.regionSlug;
      competitionSlug = matchUrl.competitionSlug;
      // Match URL competition path is authoritative. Do not use nearby team-name
      // anchors (previous row's away side) — that polluted NPC / Currie Cup rows.
      if (competitionSlug) {
        competitionName = pageCompetitionMatchesSlug(currentCompetition, competitionSlug)
          ? currentCompetition
          : titleCaseSlug(competitionSlug);
      }
    } catch {
      /* ignore */
    }

    if (!competitionName) {
      const before = html.slice(Math.max(0, row.index - 1200), row.index);
      competitionName = nearbyCompetitionListingLabel(before);
    }

    const eventId = href.match(/-(\d+)\/?$/)?.[1] ?? null;
    const league = classifyBmbetsLeagueContamination({
      sourceUrl: href,
      competitionName,
      homeName,
      awayName,
    });

    matches.push({
      sourceUrl: href,
      eventId,
      competitionName,
      regionSlug,
      competitionSlug,
      homeName,
      awayName,
      dayLabel: currentDay,
      kickoffLabel: hour,
      kickoffAtIso: parseBmbetsKickoffIso(currentDay, hour),
      bestHomeDecimal: odds.home,
      bestDrawDecimal: odds.draw,
      bestAwayDecimal: odds.away,
      bookmakerCount: odds.bookmakerCount,
      rejectedAsLeague: league.rejectedAsLeague,
      rejectReason: league.rejectReason,
    });
  }

  const unionMatches = matches.filter((m) => !m.rejectedAsLeague);
  const rejectedLeagueMatches = matches.filter((m) => m.rejectedAsLeague);

  return {
    kind: "listing",
    sourceUrl: parsedUrl.sourceUrl,
    title,
    competitionName: currentCompetition,
    matches,
    unionMatches,
    rejectedLeagueMatches,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Parse a BMbets match page shell (odds grid is AJAX — use listing averages or paste later).
 */
export function parseBmbetsMatchHtml(html: string, sourceUrl: string): BmbetsMatchPreview {
  const parsedUrl = parseBmbetsUrl(sourceUrl);
  const home =
    html.match(/class="team home"[\s\S]*?class="team-name"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    parsedUrl.homeNameHint;
  const away =
    html.match(/class="team away"[\s\S]*?class="team-name"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ??
    parsedUrl.awayNameHint;
  const homeName = home ? stripTags(home) : parsedUrl.homeNameHint;
  const awayName = away ? stripTags(away) : parsedUrl.awayNameHint;

  const dateBits = [
    html.match(/class="match-info"[\s\S]*?<div>\s*([^<]+)\s*<\/div>\s*<div>\s*([^<]+)\s*<\/div>/i)?.[1],
    html.match(/class="match-info"[\s\S]*?<div>\s*[^<]+\s*<\/div>\s*<div>\s*([^<]+)\s*<\/div>/i)?.[1],
  ];
  const dayLabel = dateBits[0] ? stripTags(dateBits[0]) : null;
  const kickoffLabel = dateBits[1] ? stripTags(dateBits[1]) : null;

  const title = html.match(/<title>([^<]+)/i)?.[1] ?? null;
  const competitionName =
    title?.match(/,\s*([^-]+)\s*-\s*Rugby Union/i)?.[1]?.trim() ??
    (parsedUrl.competitionSlug
      ? parsedUrl.competitionSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : null);

  const league = classifyBmbetsLeagueContamination({
    sourceUrl: parsedUrl.sourceUrl,
    competitionName,
    homeName,
    awayName,
  });

  return {
    kind: "match",
    sourceUrl: parsedUrl.sourceUrl,
    eventId: parsedUrl.eventId,
    competitionName,
    regionSlug: parsedUrl.regionSlug,
    competitionSlug: parsedUrl.competitionSlug,
    homeName,
    awayName,
    kickoffLabel,
    kickoffAtIso: parseBmbetsKickoffIso(dayLabel, kickoffLabel),
    bestHomeDecimal: null,
    bestDrawDecimal: null,
    bestAwayDecimal: null,
    bookmakerCount: null,
    rejectedAsLeague: league.rejectedAsLeague,
    rejectReason: league.rejectReason,
    scrapedAt: new Date().toISOString(),
  };
}

/** Discover competition hrefs from a rugby-union index / sidebar. */
export function parseBmbetsCompetitionLinks(html: string): string[] {
  const links = new Set<string>();
  const re = /href="(\/rugby-union\/[a-z0-9-]+\/[a-z0-9-]+\/)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = absoluteUrl(m[1]!);
    if (classifyBmbetsLeagueContamination({ sourceUrl: href }).rejectedAsLeague) continue;
    if (/\/(tables|results-fixtures)\/?$/i.test(href)) continue;
    links.add(href);
  }
  return [...links];
}
