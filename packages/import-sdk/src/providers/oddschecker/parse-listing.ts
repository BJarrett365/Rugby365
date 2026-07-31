import { parseOddscheckerUrl } from "./parse-url";
import type { OddscheckerListingMatch, OddscheckerListingPreview } from "./types";

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

function parseDecimalAttr(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.round(n * 1000) / 1000 : null;
}

/**
 * Parse Oddschecker rugby-union listing / coupon HTML for upcoming matches + best odds.
 */
export function parseOddscheckerListingHtml(
  html: string,
  sourceUrl: string,
): OddscheckerListingPreview {
  const parsedUrl = parseOddscheckerUrl(sourceUrl);
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleMatch ? stripTags(titleMatch[1]!) : null;

  const matches: OddscheckerListingMatch[] = [];
  const seen = new Set<string>();

  // Prefer match-on coupon rows
  const rowRe = /<tr[^>]*class="[^"]*match-on[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const openEnd = html.indexOf(">", row.index);
    const openTag = html.slice(row.index, openEnd + 1);
    const body = row[1] ?? "";
    const dayLabel = attr(openTag, "data-day");

    const names = [...body.matchAll(/class="fixtures-bet-name[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)].map(
      (m) => stripTags(m[1]!),
    );
    if (names.length < 2) continue;
    const homeName = names[0]!;
    const awayName = names[1]!;

    const timeMatch = body.match(/class="time-digits[^"]*"[^>]*>([^<]+)</i);
    const kickoffLabel = timeMatch ? stripTags(timeMatch[1]!) : null;

    const basket = [
      ...body.matchAll(
        /<td[^>]*data-bid="[^"]*"[^>]*data-best-dig="([^"]*)"[^>]*title="Add ([^"]+?) to betslip"[^>]*>[\s\S]*?<span[^>]*class="[^"]*odds[^"]*"[^>]*>([^<]+)</gi,
      ),
    ];

    let bestHomeFractional: string | null = null;
    let bestDrawFractional: string | null = null;
    let bestAwayFractional: string | null = null;
    let bestHomeDecimal: number | null = null;
    let bestDrawDecimal: number | null = null;
    let bestAwayDecimal: number | null = null;

    for (const m of basket) {
      const dig = parseDecimalAttr(m[1]);
      const who = decodeHtml(m[2] ?? "");
      const frac = stripTags(m[3] ?? "");
      if (/draw/i.test(who)) {
        bestDrawFractional = frac;
        bestDrawDecimal = dig;
      } else if (who === homeName || who.toLowerCase().includes(homeName.toLowerCase())) {
        bestHomeFractional = frac;
        bestHomeDecimal = dig;
      } else {
        bestAwayFractional = frac;
        bestAwayDecimal = dig;
      }
    }

    // Find winner market link near this row — scan forward in html
    const after = html.slice(row.index, row.index + body.length + 800);
    const linkMatch =
      after.match(/href="(\/rugby-union\/[^"]+-v-[^"]+\/winner)"/i) ??
      after.match(/href="(https:\/\/www\.oddschecker\.com\/rugby-union\/[^"]+-v-[^"]+\/winner)"/i);
    let matchUrl = linkMatch?.[1] ?? null;
    if (matchUrl && matchUrl.startsWith("/")) {
      matchUrl = `https://www.oddschecker.com${matchUrl}`;
    }
    if (!matchUrl) {
      // Build from names
      const slug = `${slugify(homeName)}-v-${slugify(awayName)}`;
      const comp = parsedUrl.competitionSlug ?? "rugby-union";
      const region = parsedUrl.regionSlug ?? "internationals";
      matchUrl = `https://www.oddschecker.com/rugby-union/${region}/${comp}/${slug}/winner`;
    }

    if (seen.has(matchUrl)) continue;
    seen.add(matchUrl);

    // Competition label from preceding heading if present
    const before = html.slice(Math.max(0, row.index - 500), row.index);
    const compMatch = before.match(/<(?:h2|h3|span)[^>]*>([^<]{2,60})<\/(?:h2|h3|span)>/gi);
    const competitionName = compMatch
      ? stripTags(compMatch[compMatch.length - 1]!.replace(/<[^>]+>/g, ""))
      : titleCase(parsedUrl.competitionSlug);

    matches.push({
      sourceUrl: matchUrl,
      competitionName,
      homeName,
      awayName,
      kickoffLabel,
      dayLabel,
      bestHomeFractional,
      bestDrawFractional,
      bestAwayFractional,
      bestHomeDecimal,
      bestDrawDecimal,
      bestAwayDecimal,
    });
  }

  // Fallback: collect -v- winner links from listing
  if (!matches.length) {
    const linkRe = /href="(\/rugby-union\/[^"]+-v-[^"]+\/winner)"/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html)) !== null) {
      const path = lm[1]!;
      const url = `https://www.oddschecker.com${path}`;
      if (seen.has(url)) continue;
      seen.add(url);
      const slug = path.split("/").find((p) => p.includes("-v-")) ?? "";
      const [h, a] = slug.split("-v-");
      matches.push({
        sourceUrl: url,
        competitionName: titleCase(parsedUrl.competitionSlug),
        homeName: titleCase(h) ?? "Home",
        awayName: titleCase(a) ?? "Away",
        kickoffLabel: null,
        dayLabel: null,
        bestHomeFractional: null,
        bestDrawFractional: null,
        bestAwayFractional: null,
        bestHomeDecimal: null,
        bestDrawDecimal: null,
        bestAwayDecimal: null,
      });
    }
  }

  return {
    kind: "listing",
    sourceUrl: parsedUrl.sourceUrl,
    title,
    matches,
    scrapedAt: new Date().toISOString(),
  };
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = tag.match(re);
  return m ? m[1]! : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function titleCase(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
