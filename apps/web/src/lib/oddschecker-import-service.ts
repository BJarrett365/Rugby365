/**
 * Oddschecker rugby odds scrape / paste → store snapshots for Betting Intelligence.
 */
import "server-only";
import { desc } from "drizzle-orm";
import {
  previewOddscheckerPage,
  type OddscheckerMarketPreview,
  type OddscheckerPreview,
} from "@rugby365/import-sdk";
import { fixtures, matchOddsSnapshots, teams } from "@rugby365/db";
import { getDb } from "./db";
import { captureRawResponse } from "./provider-raw-response-service";
import { PROVIDER_ODDSCHECKER } from "./provider-mapping-types";

export { PROVIDER_ODDSCHECKER };

function implied(decimal: number | null | undefined): number | null {
  if (decimal == null || decimal <= 1) return null;
  return Math.round((1 / decimal) * 10000) / 10000;
}

function outcomeDecimal(
  preview: OddscheckerMarketPreview,
  matcher: (name: string) => boolean,
): number | null {
  const row = preview.outcomes.find((o) => matcher(o.name));
  return row?.bestDecimal ?? null;
}

async function tryLinkFixture(input: {
  homeName: string | null;
  awayName: string | null;
}): Promise<string | null> {
  if (!input.homeName || !input.awayName) return null;
  const db = getDb();
  const needle = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const homeN = needle(input.homeName);
  const awayN = needle(input.awayName);

  const recent = await db
    .select({
      id: fixtures.id,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .orderBy(desc(fixtures.kickoffAt))
    .limit(120);

  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const nameById = new Map(teamRows.map((t) => [t.id, t.name]));

  for (const f of recent) {
    const hn = f.homeTeamId ? needle(nameById.get(f.homeTeamId) ?? "") : "";
    const an = f.awayTeamId ? needle(nameById.get(f.awayTeamId) ?? "") : "";
    if (!hn || !an) continue;
    const homeOk = hn.includes(homeN) || homeN.includes(hn);
    const awayOk = an.includes(awayN) || awayN.includes(an);
    if (homeOk && awayOk) return f.id;
  }

  return null;
}

export async function previewOddschecker(
  sourceUrl: string,
  options: { html?: string } = {},
): Promise<OddscheckerPreview> {
  return previewOddscheckerPage(sourceUrl, { html: options.html });
}

export async function importOddscheckerMarket(input: {
  sourceUrl: string;
  html?: string;
  fixtureId?: string | null;
}): Promise<{
  snapshotId: string;
  fixtureId: string | null;
  preview: OddscheckerMarketPreview;
}> {
  const preview = await previewOddscheckerPage(input.sourceUrl, { html: input.html });
  if (preview.kind !== "market") {
    throw new Error("Import expects a match market URL (…/winner), not a listing page.");
  }

  const rawId = await captureRawResponse({
    provider: PROVIDER_ODDSCHECKER,
    endpoint: preview.sourceUrl,
    entityType: "match_odds",
    externalId: preview.matchSlug ?? preview.sourceUrl,
    requestParams: { market: preview.marketSlug, via: input.html ? "paste" : "fetch" },
    responseStatus: 200,
    importStatus: "imported",
    payload: preview,
  });

  const homeDec = outcomeDecimal(preview, (n) => n === preview.homeName);
  const awayDec = outcomeDecimal(preview, (n) => n === preview.awayName);
  const drawDec = outcomeDecimal(preview, (n) => /^draw$/i.test(n));

  const fixtureId =
    input.fixtureId ??
    (await tryLinkFixture({ homeName: preview.homeName, awayName: preview.awayName }));

  const db = getDb();
  const [row] = await db
    .insert(matchOddsSnapshots)
    .values({
      fixtureId,
      provider: PROVIDER_ODDSCHECKER,
      sourceUrl: preview.sourceUrl,
      marketKey: preview.marketSlug,
      marketLabel: preview.marketLabel,
      competitionName: preview.competitionName,
      homeName: preview.homeName,
      awayName: preview.awayName,
      bookmakerCount: preview.bookmakerCount,
      outcomes: preview.outcomes,
      bestHomeDecimal: homeDec,
      bestDrawDecimal: drawDec,
      bestAwayDecimal: awayDec,
      impliedHome: implied(homeDec),
      impliedDraw: implied(drawDec),
      impliedAway: implied(awayDec),
      rawResponseId: rawId,
      scrapedAt: new Date(preview.scrapedAt),
      updatedAt: new Date(),
    })
    .returning({ id: matchOddsSnapshots.id });

  return { snapshotId: row.id, fixtureId, preview };
}

export async function listRecentOddsSnapshots(limit = 30) {
  const { listRecentOddsSnapshots: listAll } = await import("./match-odds-service");
  return listAll(limit);
}

export async function getLatestOddsForFixture(fixtureId: string) {
  const { getLatestOddsForFixture: getLatest } = await import("./match-odds-service");
  return getLatest(fixtureId);
}
