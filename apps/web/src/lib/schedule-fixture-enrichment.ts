import { eq, inArray, sql } from "drizzle-orm";
import {
  audioCommentaryScripts,
  fixtureBroadcasters,
  fixtureTrackerSettings,
  fixtures,
  matchEvents,
  teams,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import { formatBroadcasterLabel } from "./fixture-broadcasters-service";
import { formatOpenMeteoSummary } from "./open-meteo-service";
import type { ScheduleFixture } from "./match-schedule-utils";
import { resolveWeatherForVenueId } from "./venue-geocode-service";
import { enrichScheduleFixturesWithWinProbability } from "./schedule-win-probability";
import { buildVenueResolver, type CmsVenueRef } from "./venue-fixture-resolve-service";
import { extractYoutubeVideoId } from "./youtube-embed";

function isHalfTimeEventType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.includes("half_time") ||
    t.includes("half-time") ||
    t.includes("half time") ||
    t.includes("half_end") ||
    t.includes("end_of_first") ||
    t.includes("end of first")
  );
}

function scoreFromPayload(payload: unknown): { home: number; away: number } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.score_after) && p.score_after.length >= 2) {
    const home = Number(p.score_after[0]);
    const away = Number(p.score_after[1]);
    if (Number.isFinite(home) && Number.isFinite(away)) return { home, away };
  }
  if (typeof p.home_score === "number" && typeof p.away_score === "number") {
    return { home: p.home_score, away: p.away_score };
  }
  if (typeof p.scoreHome === "number" && typeof p.scoreAway === "number") {
    return { home: p.scoreHome, away: p.scoreAway };
  }
  return null;
}

async function loadHalfTimeByFixture(
  fixtureIds: string[],
): Promise<Map<string, { home: number; away: number }>> {
  const out = new Map<string, { home: number; away: number }>();
  if (!fixtureIds.length) return out;
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: matchEvents.fixtureId,
      eventType: matchEvents.eventType,
      minute: matchEvents.minute,
      payload: matchEvents.payload,
      sequenceNo: matchEvents.sequenceNo,
    })
    .from(matchEvents)
    .where(inArray(matchEvents.fixtureId, fixtureIds));

  const byFixture = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byFixture.get(row.fixtureId) ?? [];
    list.push(row);
    byFixture.set(row.fixtureId, list);
  }

  for (const [fixtureId, events] of byFixture) {
    const sorted = [...events].sort(
      (a, b) => a.minute - b.minute || a.sequenceNo - b.sequenceNo,
    );
    const htEvent = [...sorted].reverse().find((e) => isHalfTimeEventType(e.eventType));
    if (htEvent) {
      const score = scoreFromPayload(htEvent.payload);
      if (score) {
        out.set(fixtureId, score);
        continue;
      }
    }
    let lastBeforeHt: { home: number; away: number } | null = null;
    for (const e of sorted) {
      if (e.minute > 40) break;
      const score = scoreFromPayload(e.payload);
      if (score) lastBeforeHt = score;
    }
    if (lastBeforeHt) out.set(fixtureId, lastBeforeHt);
  }

  return out;
}

async function loadTvLabelsByFixture(
  fixtureIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!fixtureIds.length) return out;
  const db = getDb();
  const rows = await db
    .select({
      fixtureId: fixtureBroadcasters.fixtureId,
      broadcasterName: fixtureBroadcasters.broadcasterName,
      channelName: fixtureBroadcasters.channelName,
      region: fixtureBroadcasters.region,
      sortOrder: fixtureBroadcasters.sortOrder,
    })
    .from(fixtureBroadcasters)
    .where(inArray(fixtureBroadcasters.fixtureId, fixtureIds));

  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.fixtureId) ?? [];
    list.push(row);
    grouped.set(row.fixtureId, list);
  }

  for (const [fixtureId, list] of grouped) {
    const labels = [...list]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((row) => formatBroadcasterLabel(row))
      .filter(Boolean)
      .slice(0, 4);
    if (labels.length) out.set(fixtureId, labels);
  }
  return out;
}

function buildAdditionalInfo(fixture: ScheduleFixture): string | null {
  const bits: string[] = [];
  if (fixture.additionalInfo?.trim()) bits.push(fixture.additionalInfo.trim());
  if (fixture.isNeutralVenue && !/neutral/i.test(fixture.additionalInfo ?? "")) {
    bits.push("Neutral venue");
  }
  // Referee is shown on its own in the fixture footer — do not fold into additionalInfo.
  return bits.length ? bits.join(" · ") : null;
}

async function loadMediaAvailabilityByFixture(
  fixtureIds: string[],
): Promise<
  Map<
    string,
    {
      hasAudio: boolean;
      audioScriptCount: number;
      hasAnimation: boolean;
      hasWatchalong: boolean;
      hasHighlights: boolean;
    }
  >
> {
  const out = new Map<
    string,
    {
      hasAudio: boolean;
      audioScriptCount: number;
      hasAnimation: boolean;
      hasWatchalong: boolean;
      hasHighlights: boolean;
    }
  >();
  if (!fixtureIds.length) return out;

  for (const id of fixtureIds) {
    out.set(id, {
      hasAudio: false,
      audioScriptCount: 0,
      hasAnimation: false,
      hasWatchalong: false,
      hasHighlights: false,
    });
  }

  const db = getDb();
  const [youtubeRows, scriptRows, trackerRows] = await Promise.all([
    db
      .select({
        id: fixtures.id,
        watchalongYoutubeUrl: fixtures.watchalongYoutubeUrl,
        highlightsYoutubeUrl: fixtures.highlightsYoutubeUrl,
      })
      .from(fixtures)
      .where(inArray(fixtures.id, fixtureIds)),
    db
      .select({
        fixtureId: audioCommentaryScripts.fixtureId,
        count: sql<number>`count(*)::int`,
      })
      .from(audioCommentaryScripts)
      .where(inArray(audioCommentaryScripts.fixtureId, fixtureIds))
      .groupBy(audioCommentaryScripts.fixtureId),
    db
      .select({
        fixtureId: fixtureTrackerSettings.fixtureId,
        publicAnimationEnabled: fixtureTrackerSettings.publicAnimationEnabled,
      })
      .from(fixtureTrackerSettings)
      .where(inArray(fixtureTrackerSettings.fixtureId, fixtureIds)),
  ]);

  for (const row of youtubeRows) {
    const cur = out.get(row.id);
    if (!cur) continue;
    cur.hasWatchalong = Boolean(extractYoutubeVideoId(row.watchalongYoutubeUrl));
    cur.hasHighlights = Boolean(extractYoutubeVideoId(row.highlightsYoutubeUrl));
  }
  for (const row of scriptRows) {
    const cur = out.get(row.fixtureId);
    if (!cur) continue;
    const count = Number(row.count) || 0;
    cur.audioScriptCount = count;
    cur.hasAudio = count > 0;
  }
  for (const row of trackerRows) {
    const cur = out.get(row.fixtureId);
    if (!cur) continue;
    cur.hasAnimation = Boolean(row.publicAnimationEnabled);
  }

  return out;
}

/**
 * When schedule rows have a venue name but no venueId, resolve + persist the link
 * so weather (and Match Centre) can use Open-Meteo.
 */
async function resolveMissingVenueIds(
  scheduleFixtures: ScheduleFixture[],
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const needs = scheduleFixtures.filter(
    (f) => f.source === "db" && !f.venueId && Boolean(f.venue?.trim()),
  );
  if (!needs.length) return resolved;

  const db = getDb();
  const cmsVenues: CmsVenueRef[] = await db
    .select({
      id: venues.id,
      name: venues.name,
      slug: venues.slug,
      city: venues.city,
      countryName: venues.countryName,
      teamId: venues.teamId,
    })
    .from(venues);
  const resolver = buildVenueResolver(cmsVenues);

  const homeTeamIds = [
    ...new Set(needs.map((f) => f.homeTeam?.id).filter((id): id is string => Boolean(id))),
  ];
  const homeVenueByTeam = new Map<string, string | null>();
  if (homeTeamIds.length) {
    const teamRows = await db
      .select({ id: teams.id, homeVenueId: teams.homeVenueId })
      .from(teams)
      .where(inArray(teams.id, homeTeamIds));
    for (const row of teamRows) homeVenueByTeam.set(row.id, row.homeVenueId);
  }

  for (const fixture of needs) {
    const homeTeamId = fixture.homeTeam?.id ?? undefined;
    const match = resolver.resolveFixtureVenue({
      venueName: fixture.venue!,
      homeTeamId,
      homeVenueId: homeTeamId ? (homeVenueByTeam.get(homeTeamId) ?? undefined) : undefined,
    });
    if (!match) continue;
    resolved.set(fixture.id, match.venue.id);
    try {
      await db
        .update(fixtures)
        .set({ venueId: match.venue.id, updatedAt: new Date() })
        .where(eq(fixtures.id, fixture.id));
    } catch {
      /* non-blocking — still use resolved id for this response */
    }
  }

  return resolved;
}

/**
 * Attach TV / weather / HT / attendance / media extras for the public fixtures board.
 * Safe to call for mixed DB + SDMS rows (SDMS-only rows stay sparse).
 */
export async function enrichScheduleFixturesForPublic(
  scheduleFixtures: ScheduleFixture[],
): Promise<ScheduleFixture[]> {
  const dbIds = scheduleFixtures.filter((f) => f.source === "db").map((f) => f.id);
  if (!dbIds.length) return scheduleFixtures;

  const venueIdByFixture = await resolveMissingVenueIds(scheduleFixtures);
  const withVenueIds = scheduleFixtures.map((fixture) => {
    const resolvedId = venueIdByFixture.get(fixture.id);
    return resolvedId ? { ...fixture, venueId: resolvedId } : fixture;
  });

  const [tvByFixture, htByFixture, mediaByFixture] = await Promise.all([
    loadTvLabelsByFixture(dbIds),
    loadHalfTimeByFixture(dbIds),
    loadMediaAvailabilityByFixture(dbIds),
  ]);

  const venueIds = [
    ...new Set(
      withVenueIds
        .map((f) => f.venueId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const weatherByVenue = new Map<
    string,
    NonNullable<ScheduleFixture["weather"]>
  >();
  await Promise.all(
    venueIds.map(async (venueId) => {
      try {
        const kickoff =
          withVenueIds.find((f) => f.venueId === venueId)?.kickoffAt ?? null;
        const weather = await resolveWeatherForVenueId({
          venueId,
          kickoffAt: kickoff,
          // Allow a one-shot geocode when coords are missing (e.g. Trafalgar Park).
          geocodeIfMissing: true,
        });
        if (!weather) return;
        if (weather.temperatureC == null && weather.windSpeedKmh == null) return;
        weatherByVenue.set(venueId, {
          temperatureC: weather.temperatureC,
          windSpeedKmh: weather.windSpeedKmh,
          windCompass: weather.windCompass,
          summary: formatOpenMeteoSummary(weather),
          icon: weather.icon,
          conditionLabel: weather.conditionLabel,
        });
      } catch {
        /* non-blocking */
      }
    }),
  );

  const withExtras = withVenueIds.map((fixture) => {
    if (fixture.source !== "db") return fixture;
    const eventHt = htByFixture.get(fixture.id);
    const cmsHasHt = fixture.halfTimeHome != null && fixture.halfTimeAway != null;
    const media = mediaByFixture.get(fixture.id);
    const next: ScheduleFixture = {
      ...fixture,
      tvLabels: tvByFixture.get(fixture.id) ?? fixture.tvLabels ?? [],
      halfTimeHome: cmsHasHt ? fixture.halfTimeHome : (eventHt?.home ?? null),
      halfTimeAway: cmsHasHt ? fixture.halfTimeAway : (eventHt?.away ?? null),
      weather:
        (fixture.venueId ? weatherByVenue.get(fixture.venueId) : null) ??
        fixture.weather ??
        null,
      hasAudio: media?.hasAudio ?? fixture.hasAudio ?? false,
      audioScriptCount: media?.audioScriptCount ?? fixture.audioScriptCount ?? 0,
      hasAnimation: media?.hasAnimation ?? fixture.hasAnimation ?? false,
      hasWatchalong: media?.hasWatchalong ?? fixture.hasWatchalong ?? false,
      hasHighlights: media?.hasHighlights ?? fixture.hasHighlights ?? false,
    };
    next.additionalInfo = buildAdditionalInfo(next);
    return next;
  });

  try {
    return await enrichScheduleFixturesWithWinProbability(withExtras);
  } catch {
    return withExtras;
  }
}
