/**
 * Assign YouTube match highlights onto existing CMS fixtures.
 * Uses public Atom feeds (no API key). Never creates fixtures or renames teams.
 */
import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  previewYoutubeChannelFeed,
  type YoutubeHighlightListing,
} from "@rugby365/import-sdk";
import { competitions, fixtures, teams } from "@rugby365/db";
import { getDb } from "./db";
import {
  pickStoredFixtureForYoutubeHighlight,
  type FixtureMatchCandidate,
} from "./rugbypass-fixture-match";
import {
  getYoutubeHighlightsChannel,
  YOUTUBE_HIGHLIGHTS_CHANNELS,
  type YoutubeHighlightsChannel,
} from "./youtube-highlights-channels";
import { youtubeWatchUrl } from "./youtube-embed";

async function resolveCompetitionId(channel: YoutubeHighlightsChannel): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ id: competitions.id, slug: competitions.slug })
    .from(competitions);
  for (const slug of channel.competitionSlugs) {
    const hit = rows.find((r) => r.slug === slug || r.slug.startsWith(`${slug}-`));
    if (hit) return hit.id;
  }
  // Fallback: slug contains key fragment
  const fragment = channel.competitionSlugs[0]?.split("-")[0];
  if (fragment) {
    const hit = rows.find((r) => r.slug.includes(fragment));
    if (hit) return hit.id;
  }
  return null;
}

function listingPassesChannelFilter(
  listing: YoutubeHighlightListing,
  channel: YoutubeHighlightsChannel,
): boolean {
  if (!listing.match) return false;
  if (!channel.titleIncludes?.length) return true;
  const title = listing.title.toLowerCase();
  const hint = (listing.match.competitionHint ?? "").toLowerCase();
  return channel.titleIncludes.some(
    (needle) => title.includes(needle.toLowerCase()) || hint.includes(needle.toLowerCase()),
  );
}

async function loadCompetitionFixturesAround(
  competitionId: string,
  from: Date,
  to: Date,
): Promise<{
  candidates: FixtureMatchCandidate[];
  existingHighlights: Map<string, string | null>;
}> {
  const db = getDb();
  // Videos often publish same day or up to a few days after kickoff.
  const windowFrom = new Date(from);
  windowFrom.setUTCDate(windowFrom.getUTCDate() - 5);
  const windowTo = new Date(to);
  windowTo.setUTCDate(windowTo.getUTCDate() + 3);

  const rows = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      slug: fixtures.slug,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      competitionName: fixtures.competitionName,
      round: fixtures.round,
      highlightsYoutubeUrl: fixtures.highlightsYoutubeUrl,
    })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, competitionId),
        gte(fixtures.kickoffAt, windowFrom),
        lte(fixtures.kickoffAt, windowTo),
      ),
    )
    .limit(800);

  const teamIds = [
    ...new Set(
      rows.flatMap((r) => [r.homeTeamId, r.awayTeamId].filter(Boolean) as string[]),
    ),
  ];
  const teamRows = teamIds.length
    ? await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(inArray(teams.id, teamIds))
    : [];
  const nameById = new Map(teamRows.map((t) => [t.id, t.name]));

  const existingHighlights = new Map<string, string | null>();
  const candidates: FixtureMatchCandidate[] = rows.map((r) => {
    existingHighlights.set(r.id, r.highlightsYoutubeUrl ?? null);
    return {
      id: r.id,
      kickoffAt: r.kickoffAt,
      slug: r.slug,
      competitionName: r.competitionName,
      round: r.round,
      // Keep CMS display names as stored — fuzzy match happens in the picker.
      homeName: r.homeTeamId ? nameById.get(r.homeTeamId) ?? null : null,
      awayName: r.awayTeamId ? nameById.get(r.awayTeamId) ?? null : null,
    };
  });

  return { candidates, existingHighlights };
}

export type YoutubeHighlightsSyncResult = {
  ok: true;
  channelKey: string;
  channelLabel: string;
  sourceUrl: string;
  videosParsed: number;
  highlightVideos: number;
  matched: number;
  assigned: number;
  skippedExisting: number;
  unmatched: number;
  matches: Array<{
    videoId: string;
    title: string;
    homeName: string;
    awayName: string;
    roundHint: string | null;
    watchUrl: string;
    fixtureId: string | null;
    assigned: boolean;
    reason?: string;
  }>;
};

export async function syncYoutubeHighlightsForChannel(options: {
  channelKey: string;
  xml?: string;
  dryRun?: boolean;
  /** When true, replace existing highlights URLs. Default: only fill empty. */
  overwrite?: boolean;
}): Promise<YoutubeHighlightsSyncResult> {
  const channel = getYoutubeHighlightsChannel(options.channelKey);
  if (!channel) {
    throw new Error(`Unknown highlights channel: ${options.channelKey}`);
  }

  const competitionId = await resolveCompetitionId(channel);
  if (!competitionId) {
    throw new Error(
      `No CMS competition for ${channel.label} (slugs: ${channel.competitionSlugs.join(", ")})`,
    );
  }

  const preview = await previewYoutubeChannelFeed(channel.channelId, { xml: options.xml });
  const listings = preview.highlightListings.filter((l) => listingPassesChannelFilter(l, channel));

  const publishedDates = listings
    .map((l) => new Date(l.publishedAt))
    .filter((d) => !Number.isNaN(d.getTime()));
  const from = publishedDates.length
    ? new Date(Math.min(...publishedDates.map((d) => d.getTime())))
    : new Date();
  const to = publishedDates.length
    ? new Date(Math.max(...publishedDates.map((d) => d.getTime())))
    : new Date();

  const { candidates, existingHighlights } = await loadCompetitionFixturesAround(
    competitionId,
    from,
    to,
  );

  let matched = 0;
  let assigned = 0;
  let skippedExisting = 0;
  let unmatched = 0;
  const matches: YoutubeHighlightsSyncResult["matches"] = [];
  const db = getDb();

  for (const listing of listings) {
    const homeName = listing.match!.homeName;
    const awayName = listing.match!.awayName;
    const published = new Date(listing.publishedAt);
    const kickoffAt = Number.isNaN(published.getTime()) ? new Date() : published;

    const fixtureId = pickStoredFixtureForYoutubeHighlight(candidates, {
      kickoffAt,
      homeName,
      awayName,
      competitionName: listing.match!.competitionHint ?? channel.label,
      roundNumber: listing.match!.roundNumber,
      maxDayGap: 3,
    });

    if (!fixtureId) {
      unmatched += 1;
      matches.push({
        videoId: listing.videoId,
        title: listing.title,
        homeName,
        awayName,
        roundHint: listing.match!.roundHint,
        watchUrl: listing.watchUrl,
        fixtureId: null,
        assigned: false,
        reason: "no CMS fixture (teams/round/date)",
      });
      continue;
    }

    matched += 1;
    const existing = existingHighlights.get(fixtureId) ?? null;
    const alreadySame =
      youtubeWatchUrl(existing) === listing.watchUrl ||
      (existing ?? "").includes(listing.videoId);

    if (existing?.trim() && !options.overwrite && !alreadySame) {
      skippedExisting += 1;
      matches.push({
        videoId: listing.videoId,
        title: listing.title,
        homeName,
        awayName,
        roundHint: listing.match!.roundHint,
        watchUrl: listing.watchUrl,
        fixtureId,
        assigned: false,
        reason: "fixture already has highlights",
      });
      continue;
    }

    if (alreadySame) {
      matches.push({
        videoId: listing.videoId,
        title: listing.title,
        homeName,
        awayName,
        roundHint: listing.match!.roundHint,
        watchUrl: listing.watchUrl,
        fixtureId,
        assigned: false,
        reason: "already assigned",
      });
      continue;
    }

    if (!options.dryRun) {
      await db
        .update(fixtures)
        .set({ highlightsYoutubeUrl: listing.watchUrl })
        .where(eq(fixtures.id, fixtureId));
      existingHighlights.set(fixtureId, listing.watchUrl);
    }
    assigned += 1;
    matches.push({
      videoId: listing.videoId,
      title: listing.title,
      homeName,
      awayName,
      roundHint: listing.match!.roundHint,
      watchUrl: listing.watchUrl,
      fixtureId,
      assigned: true,
    });
  }

  return {
    ok: true,
    channelKey: channel.key,
    channelLabel: channel.label,
    sourceUrl: preview.sourceUrl,
    videosParsed: preview.videos.length,
    highlightVideos: listings.length,
    matched,
    assigned,
    skippedExisting,
    unmatched,
    matches,
  };
}

export async function previewYoutubeHighlightsForChannel(options: {
  channelKey: string;
  xml?: string;
  overwrite?: boolean;
}) {
  return syncYoutubeHighlightsForChannel({ ...options, dryRun: true });
}

export function listYoutubeHighlightsChannels() {
  return YOUTUBE_HIGHLIGHTS_CHANNELS.map((c) => ({
    key: c.key,
    label: c.label,
    handle: c.handle,
    channelId: c.channelId,
    competitionSlugs: c.competitionSlugs,
  }));
}
