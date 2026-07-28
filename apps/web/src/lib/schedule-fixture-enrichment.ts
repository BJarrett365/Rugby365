import { inArray } from "drizzle-orm";
import { fixtureBroadcasters, matchEvents } from "@rugby365/db";
import { getDb } from "./db";
import { formatBroadcasterLabel } from "./fixture-broadcasters-service";
import { formatOpenMeteoSummary } from "./open-meteo-service";
import type { ScheduleFixture } from "./match-schedule-utils";
import { resolveWeatherForVenueId } from "./venue-geocode-service";

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
  if (fixture.refereeName?.trim()) bits.push(`Referee: ${fixture.refereeName.trim()}`);
  return bits.length ? bits.join(" · ") : null;
}

/**
 * Attach TV / weather / HT / attendance extras for the public fixtures board.
 * Safe to call for mixed DB + SDMS rows (SDMS-only rows stay sparse).
 */
export async function enrichScheduleFixturesForPublic(
  fixtures: ScheduleFixture[],
): Promise<ScheduleFixture[]> {
  const dbIds = fixtures.filter((f) => f.source === "db").map((f) => f.id);
  if (!dbIds.length) return fixtures;

  const [tvByFixture, htByFixture] = await Promise.all([
    loadTvLabelsByFixture(dbIds),
    loadHalfTimeByFixture(dbIds),
  ]);

  const venueIds = [
    ...new Set(
      fixtures
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
          fixtures.find((f) => f.venueId === venueId)?.kickoffAt ?? null;
        const weather = await resolveWeatherForVenueId({
          venueId,
          kickoffAt: kickoff,
          geocodeIfMissing: false,
        });
        if (!weather) return;
        if (weather.temperatureC == null && weather.windSpeedKmh == null) return;
        weatherByVenue.set(venueId, {
          temperatureC: weather.temperatureC,
          windSpeedKmh: weather.windSpeedKmh,
          windCompass: weather.windCompass,
          summary: formatOpenMeteoSummary(weather),
        });
      } catch {
        /* non-blocking */
      }
    }),
  );

  return fixtures.map((fixture) => {
    if (fixture.source !== "db") return fixture;
    const eventHt = htByFixture.get(fixture.id);
    const cmsHasHt = fixture.halfTimeHome != null && fixture.halfTimeAway != null;
    const next: ScheduleFixture = {
      ...fixture,
      tvLabels: tvByFixture.get(fixture.id) ?? fixture.tvLabels ?? [],
      halfTimeHome: cmsHasHt ? fixture.halfTimeHome : (eventHt?.home ?? null),
      halfTimeAway: cmsHasHt ? fixture.halfTimeAway : (eventHt?.away ?? null),
      weather:
        (fixture.venueId ? weatherByVenue.get(fixture.venueId) : null) ??
        fixture.weather ??
        null,
    };
    next.additionalInfo = buildAdditionalInfo(next);
    return next;
  });
}
