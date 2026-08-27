/**
 * Import fixtures from springboks.rugby match-centre into Supabase.
 */
import "server-only";

import { and, eq, sql } from "drizzle-orm";
import {
  fixtures,
  providerEntityMappings,
  providerRawResponses,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { createFixture, updateFixture } from "./fixture-admin-service";
import { resolveTeam } from "./entity-resolve-service";
import {
  isSpringboksSeniorMensMatch,
  normalizeSpringboksTeamName,
  parseSpringboksMatchCentreHtml,
  SPRINGBOKS_MATCH_CENTRE_URL,
  SPRINGBOKS_PROVIDER,
  SPRINGBOKS_RUGBY_ORIGIN,
  type SpringboksRugbyMatch,
} from "./springboks-rugby-parse";

export type SpringboksImportResult = {
  sourceUrl: string;
  fetchedAt: string;
  parsed: number;
  springboksMatches: number;
  created: number;
  updated: number;
  skipped: number;
  fixtures: Array<{
    matchId: string;
    fixtureId: string;
    action: "created" | "updated" | "skipped";
    label: string;
  }>;
};

async function fetchMatchCentreHtml(): Promise<string> {
  const res = await fetch(SPRINGBOKS_MATCH_CENTRE_URL, {
    headers: {
      "User-Agent": "Rugby365Bot/1.0 (+https://rugby365.com; fixture-import)",
      Accept: "text/html",
    },
  });
  if (!res.ok) {
    throw new Error(`springboks.rugby match-centre fetch failed (${res.status})`);
  }
  return res.text();
}

async function resolveMappedTeam(input: {
  externalTeamId: string;
  name: string;
}): Promise<string> {
  const db = getDb();
  const displayName = normalizeSpringboksTeamName(input.name);

  const [mapped] = await db
    .select()
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.provider, SPRINGBOKS_PROVIDER),
        eq(providerEntityMappings.entityType, "team"),
        eq(providerEntityMappings.externalId, input.externalTeamId),
      ),
    )
    .limit(1);
  if (mapped?.rugby365Id && mapped.status === "confirmed") {
    return mapped.rugby365Id;
  }

  const team = await resolveTeam({
    name: displayName,
    createIfMissing: true,
    sourceProvider: SPRINGBOKS_PROVIDER,
  });
  if (!team) throw new Error(`Could not resolve team ${displayName}`);

  await db
    .insert(providerEntityMappings)
    .values({
      provider: SPRINGBOKS_PROVIDER,
      entityType: "team",
      externalId: input.externalTeamId,
      rugby365Id: team.id,
      externalName: input.name,
      rugby365Name: team.name,
      status: "confirmed",
      confidence: 90,
      matchReason: { method: "name_resolve", source: SPRINGBOKS_RUGBY_ORIGIN },
      extras: { sourceUrl: SPRINGBOKS_RUGBY_ORIGIN },
      confirmedBy: "springboks-import",
      confirmedAt: new Date(),
      lastCheckedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        providerEntityMappings.provider,
        providerEntityMappings.entityType,
        providerEntityMappings.externalId,
      ],
      set: {
        rugby365Id: team.id,
        externalName: input.name,
        rugby365Name: team.name,
        status: "confirmed",
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  return team.id;
}

async function findExistingFixture(match: SpringboksRugbyMatch, homeTeamId: string, awayTeamId: string) {
  const db = getDb();

  const [byExternal] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(eq(fixtures.externalMatchId, match.matchId))
    .limit(1);
  if (byExternal) return byExternal.id;

  const [byMapping] = await db
    .select({ rugby365Id: providerEntityMappings.rugby365Id })
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.provider, SPRINGBOKS_PROVIDER),
        eq(providerEntityMappings.entityType, "fixture"),
        eq(providerEntityMappings.externalId, match.matchId),
      ),
    )
    .limit(1);
  if (byMapping?.rugby365Id) return byMapping.rugby365Id;

  const kickoff = new Date(match.utcDate);
  const dayStart = new Date(kickoff);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [byTeamsDay] = await db
    .select({ id: fixtures.id })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.homeTeamId, homeTeamId),
        eq(fixtures.awayTeamId, awayTeamId),
        sql`${fixtures.kickoffAt} >= ${dayStart.toISOString()}`,
        sql`${fixtures.kickoffAt} < ${dayEnd.toISOString()}`,
      ),
    )
    .orderBy(sql`abs(extract(epoch from (${fixtures.kickoffAt} - ${kickoff.toISOString()}::timestamptz)))`)
    .limit(1);
  if (byTeamsDay) return byTeamsDay.id;

  // Also match when away was an unresolved placeholder on the same kickoff slot.
  const [byHomeKickoff] = await db
    .select({ id: fixtures.id, awayTeamId: fixtures.awayTeamId })
    .from(fixtures)
    .where(
      and(
        eq(fixtures.homeTeamId, homeTeamId),
        sql`${fixtures.kickoffAt} >= ${dayStart.toISOString()}`,
        sql`${fixtures.kickoffAt} < ${dayEnd.toISOString()}`,
      ),
    )
    .orderBy(sql`abs(extract(epoch from (${fixtures.kickoffAt} - ${kickoff.toISOString()}::timestamptz)))`)
    .limit(1);
  if (byHomeKickoff) {
    if (byHomeKickoff.awayTeamId === awayTeamId) return byHomeKickoff.id;
    const [away] = await db
      .select({ name: teams.name })
      .from(teams)
      .where(eq(teams.id, byHomeKickoff.awayTeamId!))
      .limit(1);
    if (away?.name && /^unknown team\b/i.test(away.name)) return byHomeKickoff.id;
  }

  return null;
}

async function upsertFixtureMapping(matchId: string, fixtureId: string, label: string) {
  const db = getDb();
  await db
    .insert(providerEntityMappings)
    .values({
      provider: SPRINGBOKS_PROVIDER,
      entityType: "fixture",
      externalId: matchId,
      rugby365Id: fixtureId,
      externalName: label,
      rugby365Name: label,
      status: "confirmed",
      confidence: 95,
      matchReason: { method: "springboks_match_centre", sourceUrl: SPRINGBOKS_MATCH_CENTRE_URL },
      extras: { sourceUrl: SPRINGBOKS_RUGBY_ORIGIN },
      confirmedBy: "springboks-import",
      confirmedAt: new Date(),
      lastCheckedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        providerEntityMappings.provider,
        providerEntityMappings.entityType,
        providerEntityMappings.externalId,
      ],
      set: {
        rugby365Id: fixtureId,
        externalName: label,
        rugby365Name: label,
        status: "confirmed",
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      },
    });
}

async function upsertOneMatch(match: SpringboksRugbyMatch): Promise<{
  matchId: string;
  fixtureId: string;
  action: "created" | "updated" | "skipped";
  label: string;
}> {
  if (!match.homeTeam || !match.awayTeam) {
    return { matchId: match.matchId, fixtureId: "", action: "skipped", label: "missing teams" };
  }

  const homeTeamId = await resolveMappedTeam({
    externalTeamId: match.homeTeam.teamId,
    name: match.homeTeam.name,
  });
  const awayTeamId = await resolveMappedTeam({
    externalTeamId: match.awayTeam.teamId,
    name: match.awayTeam.name,
  });

  const homeName = normalizeSpringboksTeamName(match.homeTeam.name);
  const awayName = normalizeSpringboksTeamName(match.awayTeam.name);
  const label = `${homeName} v ${awayName}`;
  const status = match.isCancelled
    ? "cancelled"
    : match.isPostponed
      ? "postponed"
      : match.isLive
        ? "live"
        : "scheduled";

  const existingId = await findExistingFixture(match, homeTeamId, awayTeamId);
  const snapshot = {
    provider: SPRINGBOKS_PROVIDER,
    sourceUrl: match.matchUrl,
    matchCentreUrl: SPRINGBOKS_MATCH_CENTRE_URL,
    origin: SPRINGBOKS_RUGBY_ORIGIN,
    match,
    importedAt: new Date().toISOString(),
  };

  if (existingId) {
    await updateFixture(existingId, {
      homeTeamId,
      awayTeamId,
      kickoffAt: match.utcDate,
      status,
      competitionName: match.competitionName ?? undefined,
      externalMatchId: match.matchId,
      round: match.roundName ?? undefined,
      planetRugbyUrl: match.matchUrl,
    });
    const db = getDb();
    await db
      .update(fixtures)
      .set({
        providerSnapshot: snapshot,
        venueName: match.venueName,
        planetRugbyUrl: match.matchUrl,
      })
      .where(eq(fixtures.id, existingId));
    await upsertFixtureMapping(match.matchId, existingId, label);
    return { matchId: match.matchId, fixtureId: existingId, action: "updated", label };
  }

  const date = match.utcDate.slice(0, 10);
  const slugBase = `${homeName}-v-${awayName}-${date}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const created = await createFixture({
    slug: `${slugBase}-sb-${match.matchId.slice(0, 8)}`,
    homeTeamId,
    awayTeamId,
    kickoffAt: match.utcDate,
    status,
    competitionName: match.competitionName ?? undefined,
    externalMatchId: match.matchId,
    round: match.roundName ?? undefined,
    planetRugbyUrl: match.matchUrl,
  });
  const db = getDb();
  await db
    .update(fixtures)
    .set({ providerSnapshot: snapshot, venueName: match.venueName })
    .where(eq(fixtures.id, created.id));
  await upsertFixtureMapping(match.matchId, created.id, label);
  return { matchId: match.matchId, fixtureId: created.id, action: "created", label };
}

export async function importSpringboksRugbyFixtures(options?: {
  html?: string;
  seniorMensOnly?: boolean;
}): Promise<SpringboksImportResult> {
  const fetchedAt = new Date().toISOString();
  const html = options?.html ?? (await fetchMatchCentreHtml());
  const parsed = parseSpringboksMatchCentreHtml(html);
  const seniorMensOnly = options?.seniorMensOnly ?? true;
  const targets = seniorMensOnly ? parsed.filter(isSpringboksSeniorMensMatch) : parsed;

  const db = getDb();
  await db.insert(providerRawResponses).values({
    provider: SPRINGBOKS_PROVIDER,
    endpoint: SPRINGBOKS_MATCH_CENTRE_URL,
    entityType: "fixture_list",
    requestParams: { sourceUrl: SPRINGBOKS_MATCH_CENTRE_URL },
    responseStatus: 200,
    retrievedAt: new Date(fetchedAt),
    importStatus: "imported",
    payload: {
      sourceUrl: SPRINGBOKS_MATCH_CENTRE_URL,
      origin: SPRINGBOKS_RUGBY_ORIGIN,
      parsedCount: parsed.length,
      springboksCount: targets.length,
      matchIds: targets.map((m) => m.matchId),
    },
  });

  // Ensure origin itself is mapped as a catalog/source entity.
  await db
    .insert(providerEntityMappings)
    .values({
      provider: SPRINGBOKS_PROVIDER,
      entityType: "source",
      externalId: SPRINGBOKS_RUGBY_ORIGIN,
      externalName: "SA Rugby / Springboks",
      rugby365Name: "springboks.rugby",
      status: "confirmed",
      confidence: 100,
      matchReason: { method: "manual_catalog" },
      extras: {
        sourceUrl: SPRINGBOKS_RUGBY_ORIGIN,
        matchCentreUrl: SPRINGBOKS_MATCH_CENTRE_URL,
      },
      confirmedBy: "springboks-import",
      confirmedAt: new Date(),
      lastCheckedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        providerEntityMappings.provider,
        providerEntityMappings.entityType,
        providerEntityMappings.externalId,
      ],
      set: {
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
        extras: {
          sourceUrl: SPRINGBOKS_RUGBY_ORIGIN,
          matchCentreUrl: SPRINGBOKS_MATCH_CENTRE_URL,
        },
      },
    });

  const results: SpringboksImportResult["fixtures"] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const match of targets) {
    const row = await upsertOneMatch(match);
    results.push(row);
    if (row.action === "created") created += 1;
    else if (row.action === "updated") updated += 1;
    else skipped += 1;
  }

  return {
    sourceUrl: SPRINGBOKS_MATCH_CENTRE_URL,
    fetchedAt,
    parsed: parsed.length,
    springboksMatches: targets.length,
    created,
    updated,
    skipped,
    fixtures: results,
  };
}
