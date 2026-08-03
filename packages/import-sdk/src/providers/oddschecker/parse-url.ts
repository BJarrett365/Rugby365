import type { OddscheckerParsedUrl } from "./types";

const ODDSCHECKER_HOST = "www.oddschecker.com";

/**
 * Parse Oddschecker rugby-union URLs.
 *
 * Examples:
 * - https://www.oddschecker.com/rugby-union
 * - https://www.oddschecker.com/rugby-union/south-africa/currie-cup
 * - https://www.oddschecker.com/rugby-union/south-africa/currie-cup/griquas-v-cheetahs/winner
 */
export function parseOddscheckerUrl(raw: string): OddscheckerParsedUrl {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Invalid Oddschecker URL");
  }

  if (!/oddschecker\.com$/i.test(url.hostname.replace(/^www\./, "")) && url.hostname !== ODDSCHECKER_HOST) {
    // allow oddschecker.com without www
    if (!url.hostname.toLowerCase().includes("oddschecker.com")) {
      throw new Error("URL must be an oddschecker.com page");
    }
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const rugbyIdx = parts.findIndex((p) => p === "rugby-union");
  if (rugbyIdx < 0) {
    throw new Error("URL must be under /rugby-union");
  }

  const after = parts.slice(rugbyIdx + 1);
  const sourceUrl = `https://${ODDSCHECKER_HOST}${url.pathname.replace(/\/$/, "")}${url.pathname.endsWith("/") ? "" : ""}`;
  const normalized = sourceUrl.replace(/\/$/, "") || `https://${ODDSCHECKER_HOST}/rugby-union`;

  if (after.length === 0) {
    return {
      sourceUrl: `https://${ODDSCHECKER_HOST}/rugby-union`,
      kind: "listing",
      regionSlug: null,
      competitionSlug: null,
      matchSlug: null,
      marketSlug: null,
      homeNameHint: null,
      awayNameHint: null,
    };
  }

  // Match market: region?/competition?/home-v-away/market
  const matchPart = after.find((p) => /-v-/.test(p));
  if (matchPart) {
    const matchIdx = after.indexOf(matchPart);
    const marketSlug = after[matchIdx + 1] ?? "winner";
    const before = after.slice(0, matchIdx);
    const regionSlug = before[0] ?? null;
    const competitionSlug = before.length > 1 ? before[before.length - 1]! : null;
    const [homeHint, awayHint] = matchPart.split("-v-");
    return {
      sourceUrl: normalized,
      kind: "market",
      regionSlug,
      competitionSlug,
      matchSlug: matchPart,
      marketSlug,
      homeNameHint: homeHint ? titleFromSlug(homeHint) : null,
      awayNameHint: awayHint ? titleFromSlug(awayHint) : null,
    };
  }

  // Competition or region listing
  return {
    sourceUrl: normalized,
    kind: "listing",
    regionSlug: after[0] ?? null,
    competitionSlug: after[1] ?? after[0] ?? null,
    matchSlug: null,
    marketSlug: null,
    homeNameHint: null,
    awayNameHint: null,
  };
}

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function isOddscheckerRugbyUrl(raw: string): boolean {
  try {
    parseOddscheckerUrl(raw);
    return true;
  } catch {
    return false;
  }
}
