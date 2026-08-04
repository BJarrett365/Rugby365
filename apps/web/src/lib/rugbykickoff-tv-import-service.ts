/**
 * Assign UK where-to-watch from rugbykickoff.com onto existing CMS fixtures only.
 * Never creates fixtures. Re-runs replace the kickoff-sourced TV rows (no duplicates).
 */
import "server-only";
import { and, gte, lte } from "drizzle-orm";
import {
  previewRugbyKickoffUk,
  RUGBYKICKOFF_UK_URL,
  type RugbyKickoffListing,
} from "@rugby365/import-sdk";
import { fixtures, teams } from "@rugby365/db";
import { getDb } from "./db";
import {
  assignFixtureBroadcastersFromSource,
  type FixtureBroadcasterInput,
} from "./fixture-broadcasters-service";
import {
  pickStoredFixtureForRugbyPassMatch,
  type FixtureMatchCandidate,
} from "./rugbypass-fixture-match";
import type { BroadcasterPlatform } from "./rugby-broadcaster-presets";

export const PROVIDER_RUGBY_KICKOFF = "rugby_kickoff";

const STREAMING_HINTS = [
  "youtube",
  "rugbypass",
  "flo",
  "paramount",
  "discovery+",
  "discovery plus",
  "now",
  "itvx",
  "iplayer",
  "stan",
  "kayo",
  "peacock",
  "showmax",
];

function slugifyProvider(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function platformForProvider(name: string): BroadcasterPlatform {
  const n = name.toLowerCase();
  if (STREAMING_HINTS.some((h) => n.includes(h))) return "streaming";
  return "tv";
}

/** Kickoff ISO for day-matching + broadcaster startAt. */
function kickoffIsoFromListing(listing: RugbyKickoffListing): string {
  const time = listing.kickoffLocalTime?.trim() || "12:00";
  const hhmm = time.length === 5 ? `${time}:00` : time;
  const d = new Date(`${listing.kickoffDate}T${hhmm}+00:00`);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return `${listing.kickoffDate}T12:00:00.000Z`;
}

function broadcasterRowsForListing(listing: RugbyKickoffListing): FixtureBroadcasterInput[] {
  const startAt = kickoffIsoFromListing(listing);
  return listing.providers.map((provider, index) => ({
    broadcasterName: provider.name,
    channelName: null,
    region: "UK",
    platform: platformForProvider(provider.name),
    startAt,
    endAt: null,
    url: provider.url,
    sourceProvider: PROVIDER_RUGBY_KICKOFF,
    externalId: `${listing.externalId}:${slugifyProvider(provider.name)}`,
    sortOrder: index,
  }));
}

function mergeBroadcasterRows(
  existing: FixtureBroadcasterInput[],
  incoming: FixtureBroadcasterInput[],
): FixtureBroadcasterInput[] {
  const byKey = new Map<string, FixtureBroadcasterInput>();
  for (const row of [...existing, ...incoming]) {
    const key = `${(row.region ?? "").trim().toUpperCase()}::${row.broadcasterName.trim().toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()].map((row, sortOrder) => ({ ...row, sortOrder }));
}

async function loadFixtureCandidatesBetween(
  fromDate: string,
  toDate: string,
): Promise<FixtureMatchCandidate[]> {
  const db = getDb();
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(`${toDate}T23:59:59.999Z`);
  to.setUTCDate(to.getUTCDate() + 1);

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
    .limit(2000);

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

export type RugbyKickoffTvSyncResult = {
  ok: true;
  sourceUrl: string;
  country: "UK";
  internationalOnly: boolean;
  listingsParsed: number;
  matched: number;
  unmatched: number;
  fixturesUpdated: number;
  broadcastersUpserted: number;
  matches: Array<{
    externalId: string;
    homeName: string;
    awayName: string;
    competition: string;
    fixtureId: string | null;
    providers: string[];
  }>;
};

/**
 * Match Kick Off UK listings to existing fixtures and assign TV channels.
 * Skips listings with no CMS fixture — never inserts fixtures.
 */
export async function syncRugbyKickoffUkTvSchedule(options: {
  html?: string;
  internationalOnly?: boolean;
  dryRun?: boolean;
} = {}): Promise<RugbyKickoffTvSyncResult> {
  const internationalOnly = options.internationalOnly !== false;
  const preview = await previewRugbyKickoffUk({
    html: options.html,
    sourceUrl: RUGBYKICKOFF_UK_URL,
    internationalOnly,
  });

  const listings = preview.listings;
  if (!listings.length) {
    return {
      ok: true,
      sourceUrl: preview.sourceUrl,
      country: "UK",
      internationalOnly,
      listingsParsed: 0,
      matched: 0,
      unmatched: 0,
      fixturesUpdated: 0,
      broadcastersUpserted: 0,
      matches: [],
    };
  }

  const dates = listings.map((l) => l.kickoffDate).sort();
  const candidates = await loadFixtureCandidatesBetween(dates[0]!, dates[dates.length - 1]!);

  let matched = 0;
  let unmatched = 0;
  const matches: RugbyKickoffTvSyncResult["matches"] = [];
  /** One write per fixture — merge providers if multiple listings resolve to the same match. */
  const rowsByFixtureId = new Map<string, FixtureBroadcasterInput[]>();

  for (const listing of listings) {
    const fixtureId = pickStoredFixtureForRugbyPassMatch(candidates, {
      kickoffAt: new Date(kickoffIsoFromListing(listing)),
      teamName: listing.homeName,
      opponentName: listing.awayName,
      competitionName: listing.competition,
    });

    const providers = listing.providers.map((p) => p.name);
    matches.push({
      externalId: listing.externalId,
      homeName: listing.homeName,
      awayName: listing.awayName,
      competition: listing.competition,
      fixtureId,
      providers,
    });

    if (!fixtureId) {
      unmatched += 1;
      continue;
    }
    matched += 1;

    const rows = broadcasterRowsForListing(listing);
    if (!rows.length) continue;
    const prev = rowsByFixtureId.get(fixtureId) ?? [];
    rowsByFixtureId.set(fixtureId, mergeBroadcasterRows(prev, rows));
  }

  let fixturesUpdated = 0;
  let broadcastersUpserted = 0;

  if (!options.dryRun) {
    for (const [fixtureId, rows] of rowsByFixtureId) {
      await assignFixtureBroadcastersFromSource(fixtureId, PROVIDER_RUGBY_KICKOFF, rows);
      fixturesUpdated += 1;
      broadcastersUpserted += rows.length;
    }
  } else {
    fixturesUpdated = rowsByFixtureId.size;
    for (const rows of rowsByFixtureId.values()) broadcastersUpserted += rows.length;
  }

  return {
    ok: true,
    sourceUrl: preview.sourceUrl,
    country: "UK",
    internationalOnly,
    listingsParsed: listings.length,
    matched,
    unmatched,
    fixturesUpdated,
    broadcastersUpserted,
    matches,
  };
}

export async function previewRugbyKickoffUkTvSchedule(options: {
  html?: string;
  internationalOnly?: boolean;
} = {}) {
  return syncRugbyKickoffUkTvSchedule({ ...options, dryRun: true });
}
