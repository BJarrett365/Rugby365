/**
 * BMbets rugby-union odds → snapshots for Betting Intelligence.
 * Only stores rows that link to an existing CMS fixture (Union fixtures we already have).
 * Rejects Rugby League feeds misfiled under /rugby-union/ (e.g. Europe Super League).
 */
import "server-only";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import {
  fetchBmbetsHtml,
  parseBmbetsCompetitionLinks,
  parseBmbetsListingHtml,
  parseBmbetsMatchHtml,
  parseBmbetsUrl,
  previewBmbetsPage,
  type BmbetsListingMatch,
  type BmbetsListingPreview,
  type BmbetsMatchPreview,
  type BmbetsPreview,
} from "@rugby365/import-sdk";
import { fixtures, matchOddsSnapshots, teams } from "@rugby365/db";
import { getDb } from "./db";
import { captureRawResponse } from "./provider-raw-response-service";
import { PROVIDER_BMBETS } from "./provider-mapping-types";
import {
  pickStoredFixtureForRugbyPassMatch,
  type FixtureMatchCandidate,
} from "./rugbypass-fixture-match";

export { PROVIDER_BMBETS };

function implied(decimal: number | null | undefined): number | null {
  if (decimal == null || decimal <= 1) return null;
  return Math.round((1 / decimal) * 10000) / 10000;
}

function listingOutcomes(match: BmbetsListingMatch) {
  return [
    {
      name: match.homeName,
      selectionId: null,
      bestDecimal: match.bestHomeDecimal,
      bestFractional: null,
      bestBookmakerCodes: ["bmbets"],
      prices: [
        {
          bookmakerCode: "bmbets",
          bookmakerName: "BMbets consensus",
          fractional: null,
          decimal: match.bestHomeDecimal,
          impliedProbability: implied(match.bestHomeDecimal),
        },
      ],
    },
    {
      name: "Draw",
      selectionId: null,
      bestDecimal: match.bestDrawDecimal,
      bestFractional: null,
      bestBookmakerCodes: ["bmbets"],
      prices: [
        {
          bookmakerCode: "bmbets",
          bookmakerName: "BMbets consensus",
          fractional: null,
          decimal: match.bestDrawDecimal,
          impliedProbability: implied(match.bestDrawDecimal),
        },
      ],
    },
    {
      name: match.awayName,
      selectionId: null,
      bestDecimal: match.bestAwayDecimal,
      bestFractional: null,
      bestBookmakerCodes: ["bmbets"],
      prices: [
        {
          bookmakerCode: "bmbets",
          bookmakerName: "BMbets consensus",
          fractional: null,
          decimal: match.bestAwayDecimal,
          impliedProbability: implied(match.bestAwayDecimal),
        },
      ],
    },
  ];
}

async function loadFixtureCandidatesAround(
  kickoffAtIso: string | null,
): Promise<FixtureMatchCandidate[]> {
  const db = getDb();
  const center = kickoffAtIso ? new Date(kickoffAtIso) : new Date();
  const from = new Date(center);
  from.setUTCDate(from.getUTCDate() - 3);
  const to = new Date(center);
  to.setUTCDate(to.getUTCDate() + 3);

  const rows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      slug: fixtures.slug,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      competitionName: fixtures.competitionName,
    })
    .from(fixtures)
    .where(and(gte(fixtures.kickoffAt, from), lte(fixtures.kickoffAt, to)))
    .orderBy(desc(fixtures.kickoffAt))
    .limit(400);

  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const nameById = new Map(teamRows.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    id: r.id,
    kickoffAt: r.kickoffAt,
    slug: r.slug,
    competitionName: r.competitionName,
    homeName: r.homeTeamId ? (nameById.get(r.homeTeamId) ?? null) : null,
    awayName: r.awayTeamId ? (nameById.get(r.awayTeamId) ?? null) : null,
  }));
}

async function linkFixtureForMatch(match: BmbetsListingMatch): Promise<string | null> {
  if (!match.kickoffAtIso) {
    // Fall back: try team match against recent fixtures without day constraint via ±14d window around now
    const candidates = await loadFixtureCandidatesAround(new Date().toISOString());
    return pickStoredFixtureForRugbyPassMatch(candidates, {
      kickoffAt: new Date(),
      teamName: match.homeName,
      opponentName: match.awayName,
      competitionName: match.competitionName,
    });
  }

  const candidates = await loadFixtureCandidatesAround(match.kickoffAtIso);
  return pickStoredFixtureForRugbyPassMatch(candidates, {
    kickoffAt: new Date(match.kickoffAtIso),
    teamName: match.homeName,
    opponentName: match.awayName,
    competitionName: match.competitionName,
  });
}

function parentCompetitionUrl(matchSourceUrl: string): string {
  const parsed = parseBmbetsUrl(matchSourceUrl);
  if (!parsed.regionSlug || !parsed.competitionSlug) {
    throw new Error("Could not resolve parent competition URL for match");
  }
  return `https://www.bmbets.com/rugby-union/${parsed.regionSlug}/${parsed.competitionSlug}/`;
}

function listingMatchForEvent(
  listing: BmbetsListingPreview,
  match: BmbetsMatchPreview,
): BmbetsListingMatch | null {
  const byEvent = match.eventId
    ? listing.unionMatches.find((m) => m.eventId === match.eventId)
    : null;
  if (byEvent) return byEvent;

  const byUrl = listing.unionMatches.find(
    (m) => m.sourceUrl.replace(/\/$/, "") === match.sourceUrl.replace(/\/$/, ""),
  );
  if (byUrl) return byUrl;

  const home = (match.homeName ?? "").toLowerCase();
  const away = (match.awayName ?? "").toLowerCase();
  return (
    listing.unionMatches.find(
      (m) =>
        m.homeName.toLowerCase().includes(home.slice(0, 6)) &&
        m.awayName.toLowerCase().includes(away.slice(0, 6)),
    ) ?? null
  );
}

/**
 * Resolve a match URL to a listing row (odds live on the competition page; match pages are AJAX).
 */
export async function resolveBmbetsMatchFromListing(input: {
  sourceUrl: string;
  html?: string;
  listingHtml?: string;
}): Promise<{ matchPreview: BmbetsMatchPreview; listingMatch: BmbetsListingMatch; listing: BmbetsListingPreview }> {
  const parsed = parseBmbetsUrl(input.sourceUrl);
  if (parsed.kind !== "match") {
    throw new Error("Expected a BMbets match URL");
  }

  const matchHtml = input.html?.trim()
    ? input.html
    : await fetchBmbetsHtml(parsed.sourceUrl);
  const matchPreview = parseBmbetsMatchHtml(matchHtml, parsed.sourceUrl);
  if (matchPreview.rejectedAsLeague) {
    throw new Error(matchPreview.rejectReason ?? "Rejected as Rugby League");
  }

  const competitionUrl = parentCompetitionUrl(parsed.sourceUrl);
  const listingHtml = input.listingHtml?.trim()
    ? input.listingHtml
    : await fetchBmbetsHtml(competitionUrl);
  const listing = parseBmbetsListingHtml(listingHtml, competitionUrl);
  const listingMatch = listingMatchForEvent(listing, matchPreview);
  if (!listingMatch) {
    throw new Error(
      `Could not find ${matchPreview.homeName} v ${matchPreview.awayName} on ${competitionUrl}`,
    );
  }
  if (listingMatch.rejectedAsLeague) {
    throw new Error(listingMatch.rejectReason ?? "Rejected as Rugby League");
  }

  return { matchPreview, listingMatch, listing };
}

export async function previewBmbets(
  sourceUrl: string,
  options: { html?: string } = {},
): Promise<BmbetsPreview> {
  const parsed = parseBmbetsUrl(sourceUrl);
  if (parsed.kind === "match") {
    const resolved = await resolveBmbetsMatchFromListing({
      sourceUrl,
      html: options.html,
    });
    // Surface as a one-row listing so the admin UI stays consistent
    return {
      kind: "listing",
      sourceUrl: resolved.listing.sourceUrl,
      title: resolved.listing.title,
      competitionName: resolved.listing.competitionName,
      matches: [resolved.listingMatch],
      unionMatches: [resolved.listingMatch],
      rejectedLeagueMatches: [],
      scrapedAt: new Date().toISOString(),
    };
  }
  return previewBmbetsPage(sourceUrl, { html: options.html });
}

export type BmbetsImportResult = {
  preview: BmbetsListingPreview;
  imported: Array<{
    snapshotId: string;
    fixtureId: string;
    homeName: string;
    awayName: string;
    sourceUrl: string;
  }>;
  skippedNoFixture: Array<{ homeName: string; awayName: string; sourceUrl: string }>;
  rejectedLeague: Array<{ homeName: string; awayName: string; sourceUrl: string; reason: string | null }>;
};

/**
 * Import BMbets rugby-union odds for fixtures already in CMS only.
 * Accepts competition listings or a single match URL (odds taken from parent listing).
 */
export async function importBmbetsListing(input: {
  sourceUrl: string;
  html?: string;
}): Promise<BmbetsImportResult> {
  const parsed = parseBmbetsUrl(input.sourceUrl);
  let preview: BmbetsListingPreview;
  let matchesToImport: BmbetsListingMatch[];

  if (parsed.kind === "match") {
    const resolved = await resolveBmbetsMatchFromListing({
      sourceUrl: input.sourceUrl,
      html: input.html,
    });
    preview = {
      kind: "listing",
      sourceUrl: resolved.listing.sourceUrl,
      title: resolved.listing.title,
      competitionName: resolved.listing.competitionName,
      matches: [resolved.listingMatch],
      unionMatches: [resolved.listingMatch],
      rejectedLeagueMatches: [],
      scrapedAt: new Date().toISOString(),
    };
    matchesToImport = [resolved.listingMatch];
  } else {
    const html = input.html?.trim() ? input.html : await fetchBmbetsHtml(parsed.sourceUrl);
    preview = parseBmbetsListingHtml(html, parsed.sourceUrl);
    matchesToImport = preview.unionMatches;
  }

  await captureRawResponse({
    provider: PROVIDER_BMBETS,
    endpoint: preview.sourceUrl,
    entityType: "match_odds_listing",
    externalId: preview.sourceUrl,
    requestParams: {
      via: input.html ? "paste" : "fetch",
      requestedUrl: input.sourceUrl,
      matchScoped: parsed.kind === "match",
    },
    responseStatus: 200,
    importStatus: "imported",
    payload: {
      unionCount: matchesToImport.length,
      rejectedLeagueCount: preview.rejectedLeagueMatches.length,
      matches: matchesToImport.map((m) => ({
        sourceUrl: m.sourceUrl,
        homeName: m.homeName,
        awayName: m.awayName,
        competitionName: m.competitionName,
      })),
    },
  });

  const imported: BmbetsImportResult["imported"] = [];
  const skippedNoFixture: BmbetsImportResult["skippedNoFixture"] = [];
  const rejectedLeague = preview.rejectedLeagueMatches.map((m) => ({
    homeName: m.homeName,
    awayName: m.awayName,
    sourceUrl: m.sourceUrl,
    reason: m.rejectReason,
  }));

  const db = getDb();

  for (const match of matchesToImport) {
    const fixtureId = await linkFixtureForMatch(match);
    if (!fixtureId) {
      skippedNoFixture.push({
        homeName: match.homeName,
        awayName: match.awayName,
        sourceUrl: match.sourceUrl,
      });
      continue;
    }

    const rawId = await captureRawResponse({
      provider: PROVIDER_BMBETS,
      endpoint: match.sourceUrl,
      entityType: "match_odds",
      externalId: match.eventId ?? match.sourceUrl,
      requestParams: { market: "1x2", via: input.html ? "paste" : "fetch" },
      responseStatus: 200,
      importStatus: "imported",
      payload: match,
    });

    const [row] = await db
      .insert(matchOddsSnapshots)
      .values({
        fixtureId,
        provider: PROVIDER_BMBETS,
        sourceUrl: match.sourceUrl,
        marketKey: "1x2",
        marketLabel: "Match result (1X2)",
        competitionName: match.competitionName,
        homeName: match.homeName,
        awayName: match.awayName,
        kickoffLabel: [match.dayLabel, match.kickoffLabel].filter(Boolean).join(" · ") || null,
        bookmakerCount: match.bookmakerCount ?? 0,
        outcomes: listingOutcomes(match),
        bestHomeDecimal: match.bestHomeDecimal,
        bestDrawDecimal: match.bestDrawDecimal,
        bestAwayDecimal: match.bestAwayDecimal,
        impliedHome: implied(match.bestHomeDecimal),
        impliedDraw: implied(match.bestDrawDecimal),
        impliedAway: implied(match.bestAwayDecimal),
        rawResponseId: rawId,
        scrapedAt: new Date(preview.scrapedAt),
        updatedAt: new Date(),
      })
      .returning({ id: matchOddsSnapshots.id });

    imported.push({
      snapshotId: row.id,
      fixtureId,
      homeName: match.homeName,
      awayName: match.awayName,
      sourceUrl: match.sourceUrl,
    });
  }

  return { preview, imported, skippedNoFixture, rejectedLeague };
}

/**
 * Discover rugby-union competitions from the sport index, then import each listing
 * (League-contaminated competitions are skipped by the parser blocklist).
 */
export async function importBmbetsRugbyUnionHub(options: {
  html?: string;
  maxCompetitions?: number;
} = {}): Promise<{
  competitions: string[];
  results: BmbetsImportResult[];
}> {
  const hubUrl = "https://www.bmbets.com/rugby-union/";
  const html = options.html?.trim() ? options.html : await fetchBmbetsHtml(hubUrl);
  let competitions = parseBmbetsCompetitionLinks(html);
  const max = options.maxCompetitions ?? 12;
  competitions = competitions.slice(0, max);

  const results: BmbetsImportResult[] = [];
  for (const url of competitions) {
    try {
      results.push(await importBmbetsListing({ sourceUrl: url }));
    } catch {
      /* skip failed competition fetch */
    }
  }
  return { competitions, results };
}

export async function listRecentBmbetsOddsSnapshots(limit = 40) {
  const db = getDb();
  return db
    .select({
      id: matchOddsSnapshots.id,
      fixtureId: matchOddsSnapshots.fixtureId,
      sourceUrl: matchOddsSnapshots.sourceUrl,
      marketLabel: matchOddsSnapshots.marketLabel,
      homeName: matchOddsSnapshots.homeName,
      awayName: matchOddsSnapshots.awayName,
      competitionName: matchOddsSnapshots.competitionName,
      bookmakerCount: matchOddsSnapshots.bookmakerCount,
      bestHomeDecimal: matchOddsSnapshots.bestHomeDecimal,
      bestDrawDecimal: matchOddsSnapshots.bestDrawDecimal,
      bestAwayDecimal: matchOddsSnapshots.bestAwayDecimal,
      impliedHome: matchOddsSnapshots.impliedHome,
      impliedDraw: matchOddsSnapshots.impliedDraw,
      impliedAway: matchOddsSnapshots.impliedAway,
      scrapedAt: matchOddsSnapshots.scrapedAt,
    })
    .from(matchOddsSnapshots)
    .where(eq(matchOddsSnapshots.provider, PROVIDER_BMBETS))
    .orderBy(desc(matchOddsSnapshots.scrapedAt))
    .limit(limit);
}
