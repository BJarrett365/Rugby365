import { bookmakerNameForCode } from "./bookmakers";
import { parseOddscheckerUrl } from "./parse-url";
import type {
  OddscheckerBookmakerPrice,
  OddscheckerMarketPreview,
  OddscheckerOutcome,
} from "./types";

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

function titleCaseSlug(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function marketLabel(slug: string): string {
  if (slug === "winner") return "Winner";
  return titleCaseSlug(slug) ?? slug;
}

function parseDecimal(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 1 ? Math.round(n * 1000) / 1000 : null;
}

function impliedFromDecimal(decimal: number | null): number | null {
  if (decimal == null || decimal <= 1) return null;
  return Math.round((1 / decimal) * 10000) / 10000;
}

function fractionalFromDecimal(decimal: number): string {
  // Prefer common fractions; otherwise decimal string
  const approx = decimal - 1;
  const dens = [1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 14, 16, 20, 25];
  for (const d of dens) {
    const n = Math.round(approx * d);
    if (Math.abs(n / d - approx) < 0.01) return `${n}/${d}`;
  }
  return decimal.toFixed(2);
}

/**
 * Parse Oddschecker market grid HTML.
 * Primary source: `data-initial-odds-state` on each outcome row (complete even when TD empty).
 */
export function parseOddscheckerMarketHtml(
  html: string,
  sourceUrl: string,
): OddscheckerMarketPreview {
  const parsedUrl = parseOddscheckerUrl(sourceUrl);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]!) : null;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1 = h1Match ? stripTags(h1Match[1]!) : null;

  const rowRe =
    /<tr[^>]*class="[^"]*diff-row[^"]*"[^>]*data-bname="([^"]+)"[^>]*>([\s\S]*?)<\/tr>/gi;
  const outcomes: OddscheckerOutcome[] = [];
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(html)) !== null) {
    const fullOpen = rowMatch[0]!;
    // Prefer attributes from opening tag — re-match the open tag only
    const openTag = fullOpen.slice(0, fullOpen.indexOf(">") + 1);
    const name = decodeHtml(rowMatch[1]!);
    const selectionId = attr(openTag, "data-bid");
    const bestDig = parseDecimal(attr(openTag, "data-best-dig"));
    const bestBks = (attr(openTag, "data-best-bks") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const state = attr(openTag, "data-initial-odds-state") ?? "";

    const prices = parseInitialOddsState(state);
    // Fallback: parse TD cells if state empty
    if (!prices.length) {
      const body = rowMatch[2] ?? "";
      const tdRe =
        /<td[^>]*class="[^"]*\bo\b[^"]*"[^>]*data-bk="([^"]+)"[^>]*(?:data-odig="([^"]*)")?[^>]*(?:data-o="([^"]*)")?[^>]*>/gi;
      let td: RegExpExecArray | null;
      while ((td = tdRe.exec(body)) !== null) {
        const code = td[1]!;
        const decimal = parseDecimal(td[2] ?? null);
        const fractional = td[3] ? decodeHtml(td[3]) || null : null;
        if (decimal == null && !fractional) continue;
        prices.push({
          bookmakerCode: code,
          bookmakerName: bookmakerNameForCode(code),
          fractional: fractional || (decimal != null ? fractionalFromDecimal(decimal) : null),
          decimal,
          impliedProbability: impliedFromDecimal(decimal),
        });
      }
    }

    const bestFromPrices = prices
      .filter((p) => p.decimal != null)
      .sort((a, b) => (b.decimal ?? 0) - (a.decimal ?? 0))[0];

    outcomes.push({
      name,
      selectionId,
      bestDecimal: bestDig ?? bestFromPrices?.decimal ?? null,
      bestFractional:
        bestFromPrices?.fractional ??
        (bestDig != null ? fractionalFromDecimal(bestDig) : null),
      bestBookmakerCodes: bestBks.length
        ? bestBks
        : bestFromPrices
          ? [bestFromPrices.bookmakerCode]
          : [],
      prices,
    });
  }

  if (!outcomes.length) {
    throw new Error(
      "No Oddschecker outcome rows found. Paste full market HTML (View Source) if Cloudflare blocked fetch.",
    );
  }

  const bookmakerCodes = new Set<string>();
  for (const o of outcomes) {
    for (const p of o.prices) bookmakerCodes.add(p.bookmakerCode);
  }

  const homeName =
    outcomes.find((o) => !/^draw$/i.test(o.name))?.name ??
    parsedUrl.homeNameHint;
  const awayCandidates = outcomes.filter(
    (o) => !/^draw$/i.test(o.name) && o.name !== homeName,
  );
  const awayName = awayCandidates[0]?.name ?? parsedUrl.awayNameHint;

  return {
    kind: "market",
    sourceUrl: parsedUrl.sourceUrl,
    marketSlug: parsedUrl.marketSlug ?? "winner",
    marketLabel: marketLabel(parsedUrl.marketSlug ?? "winner"),
    competitionSlug: parsedUrl.competitionSlug,
    competitionName: titleCaseSlug(parsedUrl.competitionSlug),
    regionSlug: parsedUrl.regionSlug,
    matchSlug: parsedUrl.matchSlug,
    homeName,
    awayName,
    title: h1 || title,
    outcomes,
    bookmakerCount: bookmakerCodes.size,
    scrapedAt: new Date().toISOString(),
  };
}

/**
 * Format: `selectionId_BK_fractional_decimal_flag,...`
 * Empty price: `selectionId_BK__0_1`
 */
export function parseInitialOddsState(state: string): OddscheckerBookmakerPrice[] {
  if (!state.trim()) return [];
  const prices: OddscheckerBookmakerPrice[] = [];
  for (const part of state.split(",")) {
    const bits = part.split("_");
    // selectionId may contain nothing with underscores usually numeric; bookmaker can be multi-char
    // Pattern: bid_CODE_frac_dec_flag — CODE is letters/digits, frac may be empty
    if (bits.length < 5) continue;
    const flag = bits[bits.length - 1]!;
    const decimalRaw = bits[bits.length - 2]!;
    const fractionalRaw = bits[bits.length - 3]!;
    const code = bits[bits.length - 4]!;
    // bits[0..-5] is selection id (usually one segment)
    if (!/^[A-Z0-9]+$/i.test(code)) continue;
    const decimal = parseDecimal(decimalRaw);
    const fractional = fractionalRaw ? decodeHtml(fractionalRaw) : null;
    if (decimal == null && (!fractional || fractional === "0")) continue;
    // flag 1 often means unavailable / suspended empty
    if (flag === "1" && decimal == null) continue;
    prices.push({
      bookmakerCode: code,
      bookmakerName: bookmakerNameForCode(code),
      fractional: fractional || null,
      decimal,
      impliedProbability: impliedFromDecimal(decimal),
    });
  }
  return prices;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}="([^"]*)"`, "i");
  const m = tag.match(re);
  return m ? m[1]! : null;
}
