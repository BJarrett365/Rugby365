import { eq, asc } from "drizzle-orm";
import { runCommentaryPipeline } from "@rugby365/commentary";
import {
  commentaryRules,
  commentaryTemplates,
  commentarySuggestions,
  fixtures,
  matchCommentary,
  matchEvents,
  teams,
} from "@rugby365/db";
import {
  enrichEventPayloadsFromMatchEvents,
  teamPosForTeamId,
  type MatchSnapshot,
  type Sport365Lineups,
} from "@rugby365/match-operator-agent";
import { getDb } from "./db";
import { listFixtureEvents } from "./fixture-admin-service";
import { ensurePrematchCommentary } from "./prematch-commentary-service";
import { publishPendingCommentaryForFixture } from "./publish-commentary-service";

async function suggestionExistsForEvent(eventId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: commentarySuggestions.id })
    .from(commentarySuggestions)
    .where(eq(commentarySuggestions.triggerEventId, eventId))
    .limit(1);
  return Boolean(row);
}

export async function processEventForCommentary(eventId: string) {
  if (await suggestionExistsForEvent(eventId)) return null;

  const db = getDb();
  const [event] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
  if (!event) return null;

  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, event.fixtureId)).limit(1);
  if (!fixture) return null;

  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));
  const homeName = fixture.homeTeamId ? teamById[fixture.homeTeamId] ?? "Home" : "Home";
  const awayName = fixture.awayTeamId ? teamById[fixture.awayTeamId] ?? "Away" : "Away";
  const teamName = event.teamId ? teamById[event.teamId] : homeName;
  const opponentName = teamName === homeName ? awayName : homeName;

  const priorEvents = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, event.fixtureId))
    .orderBy(asc(matchEvents.sequenceNo));

  const snap = (fixture.providerSnapshot ?? {}) as Record<string, unknown>;
  const lineups = snap.lineups as Sport365Lineups | undefined;
  const venueFromFixture = fixture.venueName ?? undefined;
  const venueFromSnap = snap.venue as { name?: string; city?: string } | undefined;
  const venue =
    venueFromFixture ??
    (venueFromSnap?.name ? [venueFromSnap.name, venueFromSnap.city].filter(Boolean).join(", ") : undefined);
  const referee = fixture.refereeName ?? undefined;
  const enrichedPayloadById = enrichEventPayloadsFromMatchEvents(
    priorEvents.map((row) => ({
      id: row.id,
      teamPos: teamPosForTeamId(row.teamId, fixture.homeTeamId, fixture.awayTeamId),
      payload: (row.payload ?? {}) as Record<string, unknown>,
    })),
    lineups,
  );
  const payload = enrichedPayloadById.get(event.id) ?? ((event.payload ?? {}) as Record<string, unknown>);

  const phaseCount = priorEvents.filter((e) =>
    ["carry", "pass", "phase_milestone"].includes(e.eventType),
  ).length;

  const rules = await db.select().from(commentaryRules).where(eq(commentaryRules.active, true));
  const templates = await db.select().from(commentaryTemplates).where(eq(commentaryTemplates.active, true));

  const result = runCommentaryPipeline(
    {
      eventType: event.eventType,
      minute: event.minute,
      second: Math.min(59, event.second ?? 0),
      payload,
      teamName,
      opponentName,
    },
    {
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      phaseCount,
      venue,
      referee,
    },
    rules.map((r) => ({
      id: r.id,
      name: r.name,
      conditions: r.conditions as Record<string, unknown>,
      templateKeys: r.templateKeys as string[],
      maxSuggestions: r.maxSuggestions,
      outputType: r.outputType,
    })),
    templates.map((t) => ({
      templateKey: t.templateKey,
      body: t.body,
      outputType: t.outputType,
    })),
  );

  if (!result) return null;

  const [suggestion] = await db
    .insert(commentarySuggestions)
    .values({
      fixtureId: event.fixtureId,
      triggerEventId: event.id,
      facts: {
        ...result.facts,
        output_type: result.outputType,
        source: "template",
      },
      renderedOptions: result.renderedOptions,
      status: "pending",
    })
    .returning();

  return suggestion;
}

export async function ensureCommentaryForFixture(
  fixtureId: string,
  newEventIds: string[] = [],
  snapshot?: MatchSnapshot,
): Promise<{ eventSuggestions: number; prematchSuggestions: number; published: number }> {
  let eventSuggestions = 0;

  for (const eventId of newEventIds) {
    const created = await processEventForCommentary(eventId);
    if (created) eventSuggestions += 1;
  }

  const events = await listFixtureEvents(fixtureId);
  for (const event of events) {
    if (newEventIds.includes(event.id)) continue;
    if (await suggestionExistsForEvent(event.id)) continue;
    const created = await processEventForCommentary(event.id);
    if (created) eventSuggestions += 1;
  }

  const prematchSuggestions = await ensurePrematchCommentary(fixtureId, snapshot);

  const published = await publishPendingCommentaryForFixture(fixtureId);

  return { eventSuggestions, prematchSuggestions, published };
}

export async function rebuildFixtureCommentary(fixtureId: string): Promise<void> {
  const db = getDb();
  await db.delete(matchCommentary).where(eq(matchCommentary.fixtureId, fixtureId));
  await db.delete(commentarySuggestions).where(eq(commentarySuggestions.fixtureId, fixtureId));
}
