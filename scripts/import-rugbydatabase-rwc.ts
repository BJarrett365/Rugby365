/**
 * Import scraped rugbydatabase.co.uk RWC data into the CMS.
 *
 * Prerequisite:
 *   npx tsx scripts/scrape-rugbydatabase-rwc.ts
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugbydatabase-rwc.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugbydatabase-rwc.ts --years=1987,1995
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixturePlayers,
  fixtures,
  matchEvents,
  players,
  providerEntityMappings,
  standingRows,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { resolveCoach } from "../apps/web/src/lib/coach-admin-service";
import { resolveReferee } from "../apps/web/src/lib/entity-admin-service";
import { resolvePlayer, resolveTeam } from "../apps/web/src/lib/entity-resolve-service";
import { createFixture, findFixtureByExternalMatchId, normalizeSlug } from "../apps/web/src/lib/fixture-admin-service";
import { buildFixtureSlug } from "../apps/web/src/lib/fixture-slug";
import { resolveVenue } from "../apps/web/src/lib/venue-admin-service";
import { normalizePlayerName, normalizeTeamName, normalizedEntityKey } from "../apps/web/src/lib/entity-normalize";

const ROOT = join(process.cwd(), "docs/scraped/rugbydatabase/rugby-world-cup");
const PROVIDER = "rugbydatabase";
const COMPETITION_SLUG = "rugby-world-cup";

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));
const skipLineups = args.includes("--skip-lineups");
const skipStandings = args.includes("--skip-standings");

type LineupPlayer = {
  jerseyNumber: number | null;
  playerId: number | null;
  name: string;
  positionName: string | null;
  squadRole: "starting" | "substitute";
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
  nation: string | null;
};

type MatchDetail = {
  gameId: number;
  sourceUrl: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeName: string | null;
  awayName: string | null;
  homeScore: number | null;
  awayScore: number | null;
  dateText: string | null;
  kickoffText: string | null;
  venueId: number | null;
  venueName: string | null;
  attendance: number | null;
  refereeId: number | null;
  refereeName: string | null;
  homeCoachId: number | null;
  homeCoachName: string | null;
  awayCoachId: number | null;
  awayCoachName: string | null;
  penaltyTries: Array<{ teamName: string; count: number }>;
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  kickoffUnix?: number | null;
};

const TEAM_ALIASES: Record<string, string> = {
  "western samoa": "Samoa",
  samoa: "Samoa",
  "all blacks": "New Zealand",
  "ivory coast": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  usa: "United States",
  "united states of america": "United States",
  "south africa": "South Africa",
  "new zealand": "New Zealand",
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function rdbId(kind: string, id: number | string): string {
  return `rdb:${kind}:${id}`;
}

function canonTeam(name: string): string {
  const n = normalizeTeamName(name);
  return TEAM_ALIASES[n.toLowerCase()] ?? n;
}

function kickoffFromMatch(match: MatchDetail, listKickoffUnix?: number | null): string | null {
  const unix = listKickoffUnix ?? match.kickoffUnix ?? null;
  if (unix && unix > 0) return new Date(unix * 1000).toISOString();
  if (!match.dateText) return null;
  const parsed = Date.parse(match.dateText.replace(/(\d+)(st|nd|rd|th)/gi, "$1"));
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

const teamCache = new Map<string, Awaited<ReturnType<typeof resolveTeam>>>();
const playerCache = new Map<string, Awaited<ReturnType<typeof resolvePlayer>>>();
const coachCache = new Map<string, Awaited<ReturnType<typeof resolveCoach>>>();
const refereeCache = new Map<string, Awaited<ReturnType<typeof resolveReferee>>>();
const venueCache = new Map<string, string | null>();
const mappingSeen = new Set<string>();

async function cachedResolveTeam(name: string, externalId?: number | null) {
  const key = externalId != null ? `id:${externalId}` : `name:${canonTeam(name).toLowerCase()}`;
  if (teamCache.has(key)) return teamCache.get(key) ?? null;
  const team = await resolveTeam({
    name: canonTeam(name),
    externalProviderId: externalId != null ? rdbId("team", externalId) : undefined,
    createIfMissing: true,
    sourceProvider: PROVIDER,
  });
  teamCache.set(key, team);
  if (team) teamCache.set(`name:${team.name.toLowerCase()}`, team);
  return team;
}

async function cachedResolvePlayer(input: {
  name: string;
  playerId?: number | null;
  positionName?: string | null;
  nation?: string | null;
  teamId: string;
  teamName: string;
}) {
  const name = normalizePlayerName(input.name.trim());
  if (!name) return null;
  const idKey = input.playerId != null ? `id:${input.playerId}` : null;
  const nameKey = `name:${normalizedEntityKey(name, "player")}`;
  if (idKey && playerCache.has(idKey)) return playerCache.get(idKey) ?? null;
  if (playerCache.has(nameKey)) {
    const hit = playerCache.get(nameKey) ?? null;
    if (hit && idKey) playerCache.set(idKey, hit);
    return hit;
  }

  const db = getDb();
  const externalProviderId = input.playerId != null ? rdbId("player", input.playerId) : null;
  if (externalProviderId) {
    const [byExternal] = await db
      .select()
      .from(players)
      .where(eq(players.externalProviderId, externalProviderId))
      .limit(1);
    if (byExternal) {
      playerCache.set(idKey!, byExternal);
      playerCache.set(nameKey, byExternal);
      return byExternal;
    }
  }

  // Create lightly without scanning the whole players table.
  const baseSlug = normalizeSlug(name);
  const suffix = input.playerId != null ? String(input.playerId) : String(Date.now()).slice(-6);
  const slug = `${baseSlug}-${suffix}`.slice(0, 80);
  try {
    const [created] = await db
      .insert(players)
      .values({
        name,
        slug,
        positionName: input.positionName ?? null,
        countryName: input.nation || null,
        internationalTeamId: input.teamId,
        externalProviderId,
        sourceProvider: PROVIDER,
      })
      .returning();
    playerCache.set(nameKey, created);
    if (idKey) playerCache.set(idKey, created);
    return created;
  } catch {
    // Unique collision — fall back to shared resolver once.
    const player = await resolvePlayer({
      name,
      externalProviderId: externalProviderId ?? undefined,
      positionName: input.positionName ?? undefined,
      countryName: input.nation || undefined,
      internationalTeamId: input.teamId,
      createIfMissing: true,
      sourceProvider: PROVIDER,
      skipArchiveEnrich: true,
      squadContext: {
        kind: "international",
        teamId: input.teamId,
        teamName: input.teamName,
      },
    });
    playerCache.set(nameKey, player);
    if (idKey) playerCache.set(idKey, player);
    return player;
  }
}

async function preloadPlayerCache() {
  const db = getDb();
  const rows = await db.select().from(players);
  for (const row of rows) {
    playerCache.set(`name:${normalizedEntityKey(row.name, "player")}`, row);
    if (row.externalProviderId?.startsWith("rdb:player:")) {
      playerCache.set(`id:${row.externalProviderId.slice("rdb:player:".length)}`, row);
    }
  }
  console.log(`Preloaded ${rows.length} players into cache`);
}

async function cachedResolveCoach(name: string, externalId?: number | null) {
  const key = externalId != null ? `id:${externalId}` : `name:${name.toLowerCase()}`;
  if (coachCache.has(key)) return coachCache.get(key) ?? null;
  const coach = await resolveCoach({
    name,
    externalProviderId: externalId != null ? rdbId("coach", externalId) : undefined,
    createIfMissing: true,
    sourceProvider: PROVIDER,
  });
  coachCache.set(key, coach);
  return coach;
}

async function cachedResolveReferee(name: string, externalId?: number | null) {
  const cleaned = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const key = externalId != null ? `id:${externalId}` : `name:${cleaned.toLowerCase()}`;
  if (refereeCache.has(key)) return refereeCache.get(key) ?? null;
  const referee = await resolveReferee({
    name: cleaned,
    externalProviderId: externalId != null ? rdbId("referee", externalId) : undefined,
    createIfMissing: true,
  });
  refereeCache.set(key, referee);
  return referee;
}

async function upsertMapping(input: {
  entityType: string;
  externalId: string;
  rugby365Id: string | null;
  externalName?: string | null;
  rugby365Name?: string | null;
  extras?: Record<string, unknown>;
}) {
  const seenKey = `${input.entityType}:${input.externalId}`;
  if (mappingSeen.has(seenKey)) return;
  mappingSeen.add(seenKey);

  const db = getDb();
  const [existing] = await db
    .select()
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.provider, PROVIDER),
        eq(providerEntityMappings.entityType, input.entityType),
        eq(providerEntityMappings.externalId, input.externalId),
      ),
    )
    .limit(1);

  if (existing) {
    if (existing.rugby365Id === input.rugby365Id) return;
    await db
      .update(providerEntityMappings)
      .set({
        rugby365Id: input.rugby365Id ?? existing.rugby365Id,
        externalName: input.externalName ?? existing.externalName,
        rugby365Name: input.rugby365Name ?? existing.rugby365Name,
        status: input.rugby365Id ? "confirmed" : existing.status,
        confidence: input.rugby365Id ? 100 : existing.confidence,
        extras: { ...(existing.extras as object), ...(input.extras ?? {}) },
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(providerEntityMappings.id, existing.id));
    return;
  }

  await db.insert(providerEntityMappings).values({
    provider: PROVIDER,
    entityType: input.entityType,
    externalId: input.externalId,
    rugby365Id: input.rugby365Id,
    externalName: input.externalName ?? null,
    rugby365Name: input.rugby365Name ?? null,
    status: input.rugby365Id ? "confirmed" : "unmapped",
    confidence: input.rugby365Id ? 100 : 0,
    extras: input.extras ?? {},
    lastCheckedAt: new Date(),
  });
}

async function findSeasonFixture(input: {
  seasonId: string;
  competitionId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  externalMatchId: string;
}) {
  const byExternal = await findFixtureByExternalMatchId(input.externalMatchId);
  if (byExternal) return byExternal;

  const db = getDb();
  const [mapped] = await db
    .select()
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.provider, PROVIDER),
        eq(providerEntityMappings.entityType, "match"),
        eq(providerEntityMappings.externalId, String(input.externalMatchId.replace(/^rdb:game:/, ""))),
      ),
    )
    .limit(1);
  if (mapped?.rugby365Id) {
    const [row] = await db.select().from(fixtures).where(eq(fixtures.id, mapped.rugby365Id)).limit(1);
    if (row) return row;
  }

  if (input.kickoffAt) {
    const day = input.kickoffAt.slice(0, 10);
    const [byDate] = await db
      .select()
      .from(fixtures)
      .where(
        and(
          eq(fixtures.seasonId, input.seasonId),
          eq(fixtures.homeTeamId, input.homeTeamId),
          eq(fixtures.awayTeamId, input.awayTeamId),
          sql`(${fixtures.kickoffAt})::date = ${day}::date`,
        ),
      )
      .limit(1);
    if (byDate) return byDate;

    // Neutral / home-away swap on some historic sources.
    const [swapped] = await db
      .select()
      .from(fixtures)
      .where(
        and(
          eq(fixtures.seasonId, input.seasonId),
          eq(fixtures.homeTeamId, input.awayTeamId),
          eq(fixtures.awayTeamId, input.homeTeamId),
          sql`(${fixtures.kickoffAt})::date = ${day}::date`,
        ),
      )
      .limit(1);
    if (swapped) return swapped;
  }

  if (input.homeScore != null && input.awayScore != null) {
    const [byScore] = await db
      .select()
      .from(fixtures)
      .where(
        and(
          eq(fixtures.seasonId, input.seasonId),
          eq(fixtures.homeTeamId, input.homeTeamId),
          eq(fixtures.awayTeamId, input.awayTeamId),
          eq(fixtures.homeScore, input.homeScore),
          eq(fixtures.awayScore, input.awayScore),
        ),
      )
      .limit(1);
    if (byScore) return byScore;
  }

  return null;
}

async function syncLineupSide(input: {
  fixtureId: string;
  teamId: string;
  teamName: string;
  rows: LineupPlayer[];
}) {
  const db = getDb();
  let synced = 0;
  for (const entry of input.rows) {
    const player = await cachedResolvePlayer({
      name: entry.name,
      playerId: entry.playerId,
      positionName: entry.positionName,
      nation: entry.nation,
      teamId: input.teamId,
      teamName: input.teamName,
    });
    if (!player) continue;

    if (entry.playerId != null) {
      await upsertMapping({
        entityType: "player",
        externalId: String(entry.playerId),
        rugby365Id: player.id,
        externalName: entry.name,
        rugby365Name: player.name,
      });
    }

    const [existing] = await db
      .select()
      .from(fixturePlayers)
      .where(and(eq(fixturePlayers.fixtureId, input.fixtureId), eq(fixturePlayers.playerId, player.id)))
      .limit(1);

    const values = {
      teamId: input.teamId,
      jerseyNumber: entry.jerseyNumber,
      squadRole: entry.squadRole,
      positionName: entry.positionName,
      tries: entry.tries ?? 0,
      conversions: entry.conversions ?? 0,
      penalties: entry.penalties ?? 0,
      dropGoals: entry.dropGoals ?? 0,
      points: entry.points ?? 0,
    };

    if (existing) {
      await db.update(fixturePlayers).set(values).where(eq(fixturePlayers.id, existing.id));
    } else {
      await db.insert(fixturePlayers).values({
        fixtureId: input.fixtureId,
        playerId: player.id,
        ...values,
      });
    }
    synced += 1;
  }
  return synced;
}

async function syncScoringEventsFromLineup(input: {
  fixtureId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  homeName: string;
  awayName: string;
}) {
  const db = getDb();
  await db
    .delete(matchEvents)
    .where(and(eq(matchEvents.fixtureId, input.fixtureId), eq(matchEvents.sourceProvider, PROVIDER)));

  const [last] = await db
    .select({ sequenceNo: matchEvents.sequenceNo })
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, input.fixtureId))
    .orderBy(desc(matchEvents.sequenceNo))
    .limit(1);
  let sequenceNo = last?.sequenceNo ?? 0;

  const sides: Array<{
    teamId: string;
    teamName: string;
    rows: LineupPlayer[];
    side: "home" | "away";
  }> = [
    { teamId: input.homeTeamId, teamName: input.homeName, rows: input.homeLineup, side: "home" },
    { teamId: input.awayTeamId, teamName: input.awayName, rows: input.awayLineup, side: "away" },
  ];

  const values = [];
  for (const side of sides) {
    for (const row of side.rows) {
      const player = await cachedResolvePlayer({
        name: row.name,
        playerId: row.playerId,
        positionName: row.positionName,
        nation: row.nation,
        teamId: side.teamId,
        teamName: side.teamName,
      });

      const chunks: Array<{ eventType: string; count: number }> = [
        { eventType: "try", count: row.tries },
        { eventType: "conversion", count: row.conversions },
        { eventType: "penalty", count: row.penalties },
        { eventType: "drop_goal", count: row.dropGoals },
      ];
      for (const chunk of chunks) {
        for (let i = 0; i < chunk.count; i++) {
          sequenceNo += 1;
          values.push({
            fixtureId: input.fixtureId,
            eventType: chunk.eventType,
            minute: 0,
            second: 0,
            teamId: side.teamId,
            playerId: player?.id ?? null,
            payload: {
              playerName: row.name,
              teamSide: side.side,
              jerseyNumber: row.jerseyNumber,
              source: "rugbydatabase-lineup",
              index: i + 1,
            },
            sourceProvider: PROVIDER,
            sequenceNo,
          });
        }
      }
    }
  }
  if (values.length) await db.insert(matchEvents).values(values);
  return values.length;
}

async function importMatch(input: {
  match: MatchDetail;
  listKickoffUnix: number | null;
  seasonId: string;
  competition: { id: string; name: string };
  counters: Record<string, number>;
}) {
  const homeName = canonTeam(input.match.homeName ?? "");
  const awayName = canonTeam(input.match.awayName ?? "");
  if (!homeName || !awayName) {
    input.counters.skipped += 1;
    return;
  }

  const homeTeam = await cachedResolveTeam(homeName, input.match.homeTeamId);
  const awayTeam = await cachedResolveTeam(awayName, input.match.awayTeamId);
  if (!homeTeam || !awayTeam) {
    input.counters.unmappedTeams += 1;
    return;
  }

  if (input.match.homeTeamId != null) {
    await upsertMapping({
      entityType: "team",
      externalId: String(input.match.homeTeamId),
      rugby365Id: homeTeam.id,
      externalName: homeName,
      rugby365Name: homeTeam.name,
    });
  }
  if (input.match.awayTeamId != null) {
    await upsertMapping({
      entityType: "team",
      externalId: String(input.match.awayTeamId),
      rugby365Id: awayTeam.id,
      externalName: awayName,
      rugby365Name: awayTeam.name,
    });
  }

  const externalMatchId = rdbId("game", input.match.gameId);
  const kickoffAt = kickoffFromMatch(input.match, input.listKickoffUnix);
  let fixture = await findSeasonFixture({
    seasonId: input.seasonId,
    competitionId: input.competition.id,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    kickoffAt,
    homeScore: input.match.homeScore,
    awayScore: input.match.awayScore,
    externalMatchId,
  });

  let venueId: string | null = null;
  if (input.match.venueName) {
    const venueKey = input.match.venueName.toLowerCase();
    if (venueCache.has(venueKey)) {
      venueId = venueCache.get(venueKey) ?? null;
    } else {
      const venue = await resolveVenue({
        name: input.match.venueName,
        teamId: homeTeam.id,
        createIfMissing: true,
      });
      venueId = venue?.id ?? null;
      venueCache.set(venueKey, venueId);
    }
  }

  let refereeId: string | null = null;
  if (input.match.refereeName) {
    const referee = await cachedResolveReferee(input.match.refereeName, input.match.refereeId);
    refereeId = referee?.id ?? null;
    if (referee && input.match.refereeId != null) {
      await upsertMapping({
        entityType: "referee",
        externalId: String(input.match.refereeId),
        rugby365Id: referee.id,
        externalName: input.match.refereeName,
        rugby365Name: referee.name,
      });
    }
  }

  let homeCoachId: string | null = null;
  let awayCoachId: string | null = null;
  if (input.match.homeCoachName) {
    const coach = await cachedResolveCoach(input.match.homeCoachName, input.match.homeCoachId);
    homeCoachId = coach?.id ?? null;
    if (coach && input.match.homeCoachId != null) {
      await upsertMapping({
        entityType: "coach",
        externalId: String(input.match.homeCoachId),
        rugby365Id: coach.id,
        externalName: input.match.homeCoachName,
        rugby365Name: coach.name,
      });
    }
  }
  if (input.match.awayCoachName) {
    const coach = await cachedResolveCoach(input.match.awayCoachName, input.match.awayCoachId);
    awayCoachId = coach?.id ?? null;
    if (coach && input.match.awayCoachId != null) {
      await upsertMapping({
        entityType: "coach",
        externalId: String(input.match.awayCoachId),
        rugby365Id: coach.id,
        externalName: input.match.awayCoachName,
        rugby365Name: coach.name,
      });
    }
  }

  const db = getDb();
  const scoreReady = input.match.homeScore != null && input.match.awayScore != null;
  const snapshot = {
    gameId: input.match.gameId,
    sourceUrl: input.match.sourceUrl,
    source: PROVIDER,
    penaltyTries: input.match.penaltyTries,
  };

  if (!fixture) {
    const slug = buildFixtureSlug({
      homeSlug: homeTeam.slug,
      awaySlug: awayTeam.slug,
      kickoffAt,
    });
    fixture = await createFixture({
      slug,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      competitionId: input.competition.id,
      competitionName: input.competition.name,
      seasonId: input.seasonId,
      kickoffAt,
      status: scoreReady ? "full_time" : "scheduled",
      externalMatchId,
      venueId,
      attendance: input.match.attendance,
      refereeId,
      homeCoachId,
      awayCoachId,
    });
    input.counters.created += 1;
  } else {
    input.counters.updated += 1;
  }

  const keepWikiExternal = fixture.externalMatchId?.startsWith("wiki:") ? fixture.externalMatchId : null;
  await db
    .update(fixtures)
    .set({
      seasonId: input.seasonId,
      competitionId: input.competition.id,
      competitionName: input.competition.name,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      ...(kickoffAt ? { kickoffAt: new Date(kickoffAt) } : {}),
      ...(scoreReady
        ? {
            status: "full_time",
            homeScore: input.match.homeScore!,
            awayScore: input.match.awayScore!,
          }
        : {}),
      ...(venueId ? { venueId } : {}),
      ...(input.match.venueName ? { venueName: input.match.venueName } : {}),
      ...(input.match.attendance != null ? { attendance: input.match.attendance } : {}),
      ...(refereeId ? { refereeId } : {}),
      ...(input.match.refereeName ? { refereeName: input.match.refereeName } : {}),
      ...(homeCoachId ? { homeCoachId } : {}),
      ...(awayCoachId ? { awayCoachId } : {}),
      externalMatchId: keepWikiExternal ?? fixture.externalMatchId ?? externalMatchId,
      providerSnapshot: {
        ...(typeof fixture.providerSnapshot === "object" && fixture.providerSnapshot
          ? (fixture.providerSnapshot as object)
          : {}),
        rugbydatabase: snapshot,
      },
      isNeutralVenue: true,
    })
    .where(eq(fixtures.id, fixture.id));

  await upsertMapping({
    entityType: "match",
    externalId: String(input.match.gameId),
    rugby365Id: fixture.id,
    externalName: `${homeName} vs ${awayName}`,
    rugby365Name: `${homeTeam.name} vs ${awayTeam.name}`,
    extras: { seasonId: input.seasonId, sourceUrl: input.match.sourceUrl },
  });

  if (!skipLineups) {
    const homeSynced = await syncLineupSide({
      fixtureId: fixture.id,
      teamId: homeTeam.id,
      teamName: homeTeam.name,
      rows: input.match.homeLineup ?? [],
    });
    const awaySynced = await syncLineupSide({
      fixtureId: fixture.id,
      teamId: awayTeam.id,
      teamName: awayTeam.name,
      rows: input.match.awayLineup ?? [],
    });
    input.counters.lineupPlayers += homeSynced + awaySynced;
    input.counters.scoringEvents += await syncScoringEventsFromLineup({
      fixtureId: fixture.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeLineup: input.match.homeLineup ?? [],
      awayLineup: input.match.awayLineup ?? [],
      homeName: homeTeam.name,
      awayName: awayTeam.name,
    });
  }
}

async function importStandings(year: number, seasonId: string) {
  if (skipStandings) return 0;
  const path = join(ROOT, String(year), "conferences.json");
  if (!existsSync(path)) return 0;
  const payload = readJson<{
    rows: Array<{
      position: number;
      conferenceName: string;
      teamId: number;
      teamName: string;
      p: number;
      w: number;
      l: number;
      d: number;
      bp?: number;
      tp: number;
    }>;
  }>(path);
  if (!payload.rows?.length) return 0;

  const db = getDb();
  let upserted = 0;
  for (const row of payload.rows) {
    const team = await resolveTeam({
      name: canonTeam(row.teamName),
      externalProviderId: rdbId("team", row.teamId),
      createIfMissing: true,
      sourceProvider: PROVIDER,
    });
    if (!team) continue;
    await upsertMapping({
      entityType: "team",
      externalId: String(row.teamId),
      rugby365Id: team.id,
      externalName: row.teamName,
      rugby365Name: team.name,
      extras: { pool: row.conferenceName },
    });

    const [existing] = await db
      .select()
      .from(standingRows)
      .where(
        and(eq(standingRows.seasonId, seasonId), eq(standingRows.teamId, team.id), eq(standingRows.view, "overall")),
      )
      .limit(1);

    const values = {
      rank: row.position,
      played: row.p ?? 0,
      won: row.w ?? 0,
      draw: row.d ?? 0,
      lost: row.l ?? 0,
      points: row.tp ?? 0,
      bonusPoints: row.bp ?? 0,
      syncedAt: new Date(),
    };

    if (existing) {
      // Keep points for/against from existing scraped official tables when present.
      await db
        .update(standingRows)
        .set({
          rank: values.rank,
          played: values.played,
          won: values.won,
          draw: values.draw,
          lost: values.lost,
          points: values.points,
          bonusPoints: values.bonusPoints,
          syncedAt: values.syncedAt,
        })
        .where(eq(standingRows.id, existing.id));
    } else {
      await db.insert(standingRows).values({
        seasonId,
        teamId: team.id,
        view: "overall",
        ...values,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        tryBonusPoints: 0,
        losingBonusPoints: 0,
        pointsDeduction: 0,
        form: null,
      });
    }
    upserted += 1;
  }
  return upserted;
}

async function main() {
  if (!existsSync(ROOT)) {
    throw new Error(`Missing scrape root ${ROOT}. Run scripts/scrape-rugbydatabase-rwc.ts first.`);
  }

  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, COMPETITION_SLUG))
    .limit(1);
  if (!competition) throw new Error("Competition rugby-world-cup not found");

  const years = readdirSync(ROOT)
    .map((name) => Number(name))
    .filter((y) => Number.isFinite(y) && y >= 1987 && y <= 2023)
    .filter((y) => !onlyYears?.length || onlyYears.includes(y))
    .sort((a, b) => a - b);

  console.log(`Importing rugbydatabase RWC years: ${years.join(", ")}`);
  await preloadPlayerCache();

  for (const year of years) {
    const [season] = await db
      .select()
      .from(competitionSeasons)
      .where(and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.year, year)))
      .limit(1);
    if (!season) {
      console.warn(`  ! no season row for ${year} — skip`);
      continue;
    }

    console.log(`\n→ ${year}`);
    const standings = await importStandings(year, season.id);
    if (standings) console.log(`  standings upserted: ${standings}`);

    const gamesPath = join(ROOT, String(year), "games.json");
    const matchesDir = join(ROOT, String(year), "matches");
    if (!existsSync(gamesPath) || !existsSync(matchesDir)) {
      console.warn("  ! missing games/matches — skip");
      continue;
    }

    const gamesFile = readJson<{
      games: Array<{ gameId: number; kickoffUnix: number | null }>;
    }>(gamesPath);
    const kickoffByGame = new Map(gamesFile.games.map((g) => [g.gameId, g.kickoffUnix]));

    const counters = {
      created: 0,
      updated: 0,
      skipped: 0,
      unmappedTeams: 0,
      lineupPlayers: 0,
      scoringEvents: 0,
      errors: 0,
    };

    const matchFiles = readdirSync(matchesDir).filter((f) => f.endsWith(".json") && !f.endsWith(".error.json"));
    let done = 0;
    for (const file of matchFiles) {
      try {
        const match = readJson<MatchDetail>(join(matchesDir, file));
        await importMatch({
          match,
          listKickoffUnix: kickoffByGame.get(match.gameId) ?? null,
          seasonId: season.id,
          competition: { id: competition.id, name: competition.name },
          counters,
        });
      } catch (error) {
        counters.errors += 1;
        console.warn(`  ! ${file}: ${error instanceof Error ? error.message : error}`);
      }
      done += 1;
      if (done % 10 === 0 || done === matchFiles.length) {
        console.log(`  … ${done}/${matchFiles.length} matches`);
      }
    }

    console.log(
      `  fixtures ${counters.created}c/${counters.updated}u  lineups ${counters.lineupPlayers}  events ${counters.scoringEvents}  errors ${counters.errors}`,
    );
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
