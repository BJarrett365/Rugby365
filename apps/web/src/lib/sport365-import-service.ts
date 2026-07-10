import { desc, eq } from "drizzle-orm";
import { fixtures, matchEvents } from "@rugby365/db";
import {
  assertSport365RugbyMatchUrl,
  fetchSport365HeadToHead,
  fetchSport365MatchPageHtml,
  incidentToEventType,
  isSport365CompetitionUrl,
  isSport365MatchUrl,
  parseSport365MatchSnapshotFromHtml,
  previewSport365Tournament,
  slugHintFromSport365Url,
  lookupFixtureOfficials,
  type MatchSnapshot,
  type ProviderIncident,
  type Sport365TournamentPreview,
} from "@rugby365/match-operator-agent";
import { getDb } from "./db";
import { isDbUnavailable } from "./api-errors";
import { ensureCommentaryForFixture, rebuildFixtureCommentary } from "./commentary-service";
import { resolveReferee } from "./entity-admin-service";
import { enrichFixtureEventPlayers } from "./fixture-player-map";
import {
  linkFixtureEventPlayerIds,
  resolveCompetition,
  resolveTeam,
  syncFixtureSquad,
} from "./entity-resolve-service";
import { createFixture, findFixtureByExternalMatchId, findFixtureBySlug, getFixtureById, listTeams, buildFixtureSlug, normalizeSlug, updateFixture } from "./fixture-admin-service";
import { syncFixturePlayerStats } from "./player-stats";
import { resolveVenue } from "./venue-admin-service";
import { ensureVenueCapacityInDatabase } from "./venue-capacity-sync-service";
import { mergeProviderSnapshot } from "./head-to-head-service";

export type Sport365ImportPreview = {
  kind: "match";
  sourceUrl: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  competition?: string;
  kickoffAt?: string;
  venue?: { name?: string; city?: string };
  incidentCount: number;
  suggestedSlug: string;
  resolvedTeams: {
    home: { id: string; name: string; slug: string } | null;
    away: { id: string; name: string; slug: string } | null;
  };
};

export type Sport365ParseResult = Sport365ImportPreview | Sport365TournamentPreview;

export type Sport365ImportResult = {
  fixture: Awaited<ReturnType<typeof getFixtureById>>;
  eventsImported: number;
  suggestionsGenerated: number;
  prematchSuggestions: number;
  preview: Sport365ImportPreview;
};

function snapshotToFixtureFields(snapshot: MatchSnapshot) {
  const label = snapshot.statusLabel;
  let status = "live";
  let period = "first_half";

  if (label === "full_time") {
    status = "full_time";
    period = "full_time";
  } else if (label === "half_time") {
    status = "half_time";
    period = "half_time";
  } else if (label === "not_started") {
    status = "scheduled";
    period = "not_started";
  } else if (snapshot.elapsedSeconds && snapshot.elapsedSeconds > 2400) {
    period = "second_half";
  }

  const matchMinute =
    snapshot.elapsedSeconds !== undefined
      ? Math.min(80, Math.floor(snapshot.elapsedSeconds / 60))
      : (snapshot.incidents.at(-1)?.minute ?? 0);

  return {
    status,
    period,
    homeScore: snapshot.homeScore,
    awayScore: snapshot.awayScore,
    matchMinute,
    matchSecond: snapshot.elapsedSeconds ? snapshot.elapsedSeconds % 60 : 0,
  };
}

async function safeResolveTeam(name: string, externalProviderId?: string) {
  try {
    return await resolveTeam({ name, externalProviderId, createIfMissing: false });
  } catch {
    return null;
  }
}

async function resolveSnapshotCompetition(snapshot: MatchSnapshot) {
  if (!snapshot.competition) return null;
  return resolveCompetition({
    name: snapshot.competition,
    externalProviderId: snapshot.competitionProviderId,
    stageExternalId: snapshot.stageProviderId,
    stageName: snapshot.stageName,
  });
}

export async function fetchSport365Snapshot(sourceUrl: string): Promise<MatchSnapshot> {
  const url = assertSport365RugbyMatchUrl(sourceUrl).toString();
  const html = await fetchSport365MatchPageHtml(url);
  const snapshot = parseSport365MatchSnapshotFromHtml(html, url);
  if (!snapshot) throw new Error("Could not parse Sport365 match page.");

  if (snapshot.homeTeamProviderId && snapshot.awayTeamProviderId) {
    try {
      snapshot.headToHead = await fetchSport365HeadToHead({
        matchId: snapshot.matchId,
        homeTeam: snapshot.homeTeam,
        awayTeam: snapshot.awayTeam,
        homeProviderTeamId: snapshot.homeTeamProviderId,
        awayProviderTeamId: snapshot.awayTeamProviderId,
      });
    } catch {
      /* H2H is optional when API is unavailable */
    }
  }

  return snapshot;
}

export async function previewSport365Import(sourceUrl: string): Promise<Sport365ImportPreview> {
  const snapshot = await fetchSport365Snapshot(sourceUrl);
  const [homeTeam, awayTeam] = await Promise.all([
    safeResolveTeam(snapshot.homeTeam, snapshot.homeTeamProviderId),
    safeResolveTeam(snapshot.awayTeam, snapshot.awayTeamProviderId),
  ]);

  return {
    kind: "match",
    sourceUrl: snapshot.sourceUrl,
    matchId: snapshot.matchId,
    homeTeam: snapshot.homeTeam,
    awayTeam: snapshot.awayTeam,
    homeScore: snapshot.homeScore,
    awayScore: snapshot.awayScore,
    status: snapshot.statusLabel,
    competition: snapshot.competition,
    kickoffAt: snapshot.kickoffAt,
    venue: snapshot.venue,
    incidentCount: snapshot.incidents.length,
    suggestedSlug: buildFixtureSlug({
      homeSlug: homeTeam?.slug ?? snapshot.homeTeam,
      awaySlug: awayTeam?.slug ?? snapshot.awayTeam,
      kickoffAt: snapshot.kickoffAt,
      competitionName: snapshot.competition,
      format: "teams-date",
    }),
    resolvedTeams: {
      home: homeTeam,
      away: awayTeam,
    },
  };
}

function incidentPayload(incident: ProviderIncident, snapshot: MatchSnapshot) {
  return {
    player: incident.playerName ?? null,
    player_provider_id: incident.playerProviderId ?? null,
    player_jersey: null,
    player_out: incident.playerNameOut ?? null,
    player_out_provider_id: incident.playerProviderIdOut ?? null,
    player_out_jersey: null,
    lineup_matched: false,
    score_after: incident.scoreAfter,
    provider_event_id: incident.id,
    provider_type: incident.type,
    team_name: incident.teamName,
    competition: snapshot.competition ?? null,
    venue: snapshot.venue ?? null,
    minute_plus: incident.minutePlus ?? null,
  };
}

async function existingProviderEventIds(fixtureId: string): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ payload: matchEvents.payload })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId));

  const ids = new Set<string>();
  for (const row of rows) {
    const payload = row.payload as Record<string, unknown> | null;
    const id = payload?.provider_event_id;
    if (typeof id === "string" && id) ids.add(id);
  }
  return ids;
}

async function importIncidents(
  fixtureId: string,
  snapshot: MatchSnapshot,
  homeTeamId: string,
  awayTeamId: string,
  onlyNew: boolean,
): Promise<{ imported: number; eventIds: string[] }> {
  const db = getDb();
  const known = onlyNew ? await existingProviderEventIds(fixtureId) : new Set<string>();

  const [last] = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(desc(matchEvents.sequenceNo))
    .limit(1);
  let sequenceNo = last?.sequenceNo ?? 0;

  const toInsert = snapshot.incidents.filter((i) => !known.has(i.id));
  if (toInsert.length === 0) return { imported: 0, eventIds: [] };

  const values = toInsert.map((incident) => {
    sequenceNo += 1;
    const teamId = incident.teamPos === 0 ? homeTeamId : awayTeamId;
    return {
      fixtureId,
      eventType: incidentToEventType(incident),
      minute: incident.minute,
      second: 0,
      teamId,
      payload: incidentPayload(incident, snapshot),
      sourceProvider: "sport365",
      sequenceNo,
    };
  });

  const inserted = await db.insert(matchEvents).values(values).returning({ id: matchEvents.id });
  return { imported: inserted.length, eventIds: inserted.map((row) => row.id) };
}

async function applySnapshotToFixture(
  fixtureId: string,
  snapshot: MatchSnapshot,
  competitionId?: string | null,
) {
  const db = getDb();
  const fields = snapshotToFixtureFields(snapshot);
  const officials = lookupFixtureOfficials(snapshot.matchId);
  const venueFromSnapshot = snapshot.venue;
  const venueName =
    officials?.venueName != null
      ? [officials.venueName, officials.venueCity].filter(Boolean).join(", ")
      : venueFromSnapshot?.name != null
        ? [venueFromSnapshot.name, venueFromSnapshot.city].filter(Boolean).join(", ")
        : undefined;

  const refereeName = officials?.refereeName;
  const referee = refereeName
    ? await resolveReferee({ name: refereeName, createIfMissing: true })
    : null;

  const [fixtureRow] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  const existingSnap =
    fixtureRow?.providerSnapshot && typeof fixtureRow.providerSnapshot === "object"
      ? (fixtureRow.providerSnapshot as Record<string, unknown>)
      : {};
  const venueLabel = officials?.venueName ?? venueFromSnapshot?.name;
  const venueCity = officials?.venueCity ?? venueFromSnapshot?.city;
  const venue =
    venueLabel
      ? await resolveVenue({
          name: venueLabel,
          city: venueCity ?? undefined,
          teamId: fixtureRow?.homeTeamId ?? undefined,
          createIfMissing: true,
        })
      : null;

  if (venue) {
    await ensureVenueCapacityInDatabase(venue.id, {
      capacity: venueFromSnapshot?.capacity,
      sourceProvider: "sport365",
    });
  }

  await db
    .update(fixtures)
    .set({
      homeScore: fields.homeScore,
      awayScore: fields.awayScore,
      status: fields.status,
      period: fields.period,
      matchMinute: fields.matchMinute,
      matchSecond: fields.matchSecond,
      competitionId: competitionId ?? undefined,
      competitionName: snapshot.competition ?? undefined,
      kickoffAt: snapshot.kickoffAt ? new Date(snapshot.kickoffAt) : undefined,
      externalMatchId: snapshot.matchId,
      refereeName: refereeName ?? undefined,
      refereeId: referee?.id ?? undefined,
      venueName: venueName ?? undefined,
      venueId: venue?.id ?? undefined,
      providerSnapshot: mergeProviderSnapshot(existingSnap, {
        source: "sport365",
        sport365MatchId: snapshot.matchId,
        matchId: snapshot.matchId,
        sourceUrl: snapshot.sourceUrl,
        polledAt: snapshot.polledAt,
        statusCode: snapshot.statusCode,
        statusText: snapshot.statusText,
        statusLabel: snapshot.statusLabel,
        competition: snapshot.competition,
        kickoffAt: snapshot.kickoffAt,
        venue: snapshot.venue,
        elapsedSeconds: snapshot.elapsedSeconds,
        incidentCount: snapshot.incidents.length,
        homeTeam: snapshot.homeTeam,
        awayTeam: snapshot.awayTeam,
        homeTeamProviderId: snapshot.homeTeamProviderId,
        awayTeamProviderId: snapshot.awayTeamProviderId,
        homeScore: snapshot.homeScore,
        awayScore: snapshot.awayScore,
        lineups: snapshot.lineups,
        sport365: {
          headToHead: snapshot.headToHead ?? null,
          syncedAt: snapshot.polledAt,
        },
        headToHead: snapshot.headToHead ?? existingSnap.headToHead,
      }),
    })
    .where(eq(fixtures.id, fixtureId));
}

async function finalizeSport365Import(
  fixtureId: string,
  snapshot: MatchSnapshot,
  importEvents: boolean,
  homeTeamId: string,
  awayTeamId: string,
  onlyNew: boolean,
): Promise<{ eventsImported: number; suggestionsGenerated: number; prematchSuggestions: number }> {
  let eventsImported = 0;
  let eventIds: string[] = [];

  if (importEvents && snapshot.incidents.length > 0) {
    const result = await importIncidents(fixtureId, snapshot, homeTeamId, awayTeamId, onlyNew);
    eventsImported = result.imported;
    eventIds = result.eventIds;
  }

  await enrichFixtureEventPlayers(fixtureId, {
    homeTeamId,
    awayTeamId,
    lineups: snapshot.lineups,
  });
  await syncFixtureSquad(fixtureId, snapshot.lineups, homeTeamId, awayTeamId);
  await linkFixtureEventPlayerIds(fixtureId);
  await syncFixturePlayerStats(fixtureId);

  await rebuildFixtureCommentary(fixtureId);
  const commentary = await ensureCommentaryForFixture(fixtureId, eventIds, snapshot);
  return {
    eventsImported,
    suggestionsGenerated: commentary.eventSuggestions,
    prematchSuggestions: commentary.prematchSuggestions,
  };
}

export async function importFixtureFromSport365(input: {
  sport365Url: string;
  createTeams?: boolean;
  importEvents?: boolean;
  slug?: string;
}): Promise<Sport365ImportResult> {
  const snapshot = await fetchSport365Snapshot(input.sport365Url);
  const createTeams = input.createTeams !== false;
  const importEvents = input.importEvents !== false;

  const homeTeam = await resolveTeam({
    name: snapshot.homeTeam,
    externalProviderId: snapshot.homeTeamProviderId,
    createIfMissing: createTeams,
  });
  const awayTeam = await resolveTeam({
    name: snapshot.awayTeam,
    externalProviderId: snapshot.awayTeamProviderId,
    createIfMissing: createTeams,
  });
  if (!homeTeam || !awayTeam) {
    throw new Error(
      `Teams not found in database (${snapshot.homeTeam}, ${snapshot.awayTeam}). Enable createTeams or add teams first.`,
    );
  }

  const competition = await resolveSnapshotCompetition(snapshot);
  const slug = normalizeSlug(input.slug || slugHintFromSport365Url(snapshot.sourceUrl));
  const fields = snapshotToFixtureFields(snapshot);

  const existing =
    (await findFixtureByExternalMatchId(snapshot.matchId)) ?? (await findFixtureBySlug(slug));

  if (existing) {
    await updateFixture(existing.id, {
      sport365Url: snapshot.sourceUrl,
      externalMatchId: snapshot.matchId,
      competitionId: competition?.id ?? null,
      competitionName: snapshot.competition,
      kickoffAt: snapshot.kickoffAt ?? undefined,
      status: fields.status,
    });
    await applySnapshotToFixture(existing.id, snapshot, competition?.id);

    const imported = await finalizeSport365Import(
      existing.id,
      snapshot,
      importEvents,
      homeTeam.id,
      awayTeam.id,
      true,
    );

    const fixture = await getFixtureById(existing.id);
    const preview = await previewSport365Import(snapshot.sourceUrl);
    return {
      fixture,
      eventsImported: imported.eventsImported,
      suggestionsGenerated: imported.suggestionsGenerated,
      prematchSuggestions: imported.prematchSuggestions,
      preview,
    };
  }

  const row = await createFixture({
    slug,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    competitionId: competition?.id ?? null,
    competitionName: snapshot.competition,
    kickoffAt: snapshot.kickoffAt ?? null,
    status: fields.status,
    sport365Url: snapshot.sourceUrl,
    externalMatchId: snapshot.matchId,
  });

  await applySnapshotToFixture(row.id, snapshot, competition?.id);

  const imported = await finalizeSport365Import(
    row.id,
    snapshot,
    importEvents,
    homeTeam.id,
    awayTeam.id,
    false,
  );

  const fixture = await getFixtureById(row.id);
  const preview = await previewSport365Import(snapshot.sourceUrl);
  return {
    fixture,
    eventsImported: imported.eventsImported,
    suggestionsGenerated: imported.suggestionsGenerated,
    prematchSuggestions: imported.prematchSuggestions,
    preview,
  };
}

export async function syncFixtureFromSport365(
  fixtureId: string,
  options: { importEvents?: boolean } = {},
): Promise<Sport365ImportResult> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");
  if (!fixture.sport365Url) throw new Error("Fixture has no Sport365 URL. Add one on the edit form.");

  const snapshot = await fetchSport365Snapshot(fixture.sport365Url);
  const importEvents = options.importEvents !== false;

  if (!fixture.homeTeamId || !fixture.awayTeamId) {
    throw new Error("Fixture is missing home or away team.");
  }

  await resolveTeam({
    name: snapshot.homeTeam,
    externalProviderId: snapshot.homeTeamProviderId,
    createIfMissing: false,
  });
  await resolveTeam({
    name: snapshot.awayTeam,
    externalProviderId: snapshot.awayTeamProviderId,
    createIfMissing: false,
  });

  const competition = await resolveSnapshotCompetition(snapshot);
  const fields = snapshotToFixtureFields(snapshot);
  await updateFixture(fixtureId, {
    status: fields.status,
    competitionId: competition?.id ?? null,
    competitionName: snapshot.competition,
    kickoffAt: snapshot.kickoffAt ?? undefined,
    externalMatchId: snapshot.matchId,
  });
  await applySnapshotToFixture(fixtureId, snapshot, competition?.id);

  const imported = await finalizeSport365Import(
    fixtureId,
    snapshot,
    importEvents,
    fixture.homeTeamId,
    fixture.awayTeamId,
    true,
  );

  const updated = await getFixtureById(fixtureId);
  const preview = await previewSport365Import(fixture.sport365Url);
  return {
    fixture: updated,
    eventsImported: imported.eventsImported,
    suggestionsGenerated: imported.suggestionsGenerated,
    prematchSuggestions: imported.prematchSuggestions,
    preview,
  };
}

export async function parseSport365Source(sourceUrl: string): Promise<Sport365ParseResult> {
  if (isSport365MatchUrl(sourceUrl)) return previewSport365Import(sourceUrl);
  if (isSport365CompetitionUrl(sourceUrl)) return previewSport365Tournament(sourceUrl);
  throw new Error("Unsupported Sport365 URL. Use a match page or competition/stage URL.");
}

export type Sport365BulkImportResult = {
  imported: number;
  skipped: number;
  results: Array<{ matchId: string; fixtureId?: string; eventsImported: number }>;
  errors: Array<{ matchId: string; error: string }>;
};

export async function bulkImportFromSport365(input: {
  tournamentUrl: string;
  matchIds: string[];
  createTeams?: boolean;
  importEvents?: boolean;
}): Promise<Sport365BulkImportResult> {
  if (!input.matchIds.length) throw new Error("Select at least one match to import.");

  await listTeams();

  const tournament = await previewSport365Tournament(input.tournamentUrl);
  const byId = new Map(tournament.matches.map((m) => [m.matchId, m]));
  const results: Sport365BulkImportResult["results"] = [];
  const errors: Sport365BulkImportResult["errors"] = [];

  for (const matchId of input.matchIds) {
    const match = byId.get(matchId);
    if (!match) {
      errors.push({ matchId, error: "Match not found in tournament preview." });
      continue;
    }
    try {
      const result = await importFixtureFromSport365({
        sport365Url: match.sourceUrl,
        createTeams: input.createTeams,
        importEvents: input.importEvents,
        slug: match.suggestedSlug,
      });
      results.push({
        matchId,
        fixtureId: result.fixture?.id,
        eventsImported: result.eventsImported,
      });
    } catch (e) {
      if (isDbUnavailable(e)) throw e;
      const message = e instanceof Error ? e.message : "Import failed";
      errors.push({ matchId, error: message });
    }
  }

  return {
    imported: results.length,
    skipped: errors.length,
    results,
    errors,
  };
}
