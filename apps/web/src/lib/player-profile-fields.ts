import { parseNationalityFromBirthPlace } from "@rugby365/import-sdk";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  matchEvents,
  playerCareerStints,
  players,
  teams,
} from "@rugby365/db";
import { lookupInternationalPlayerProfile } from "@rugby365/match-operator-agent";
import { getDb } from "./db";
import { isKnownInternationalCountryName, isInternationalTeamId, loadTeamClassificationContext } from "./international-team-classify";

export type SquadTeamKind = "club" | "international";

export type SquadContext = {
  kind: SquadTeamKind;
  teamId: string;
  teamName: string;
};

export function isInternationalCompetitionType(competitionType: string | null | undefined): boolean {
  return competitionType === "international" || competitionType === "world_cup";
}

export function squadKindFromCompetitionType(
  competitionType: string | null | undefined,
): SquadTeamKind {
  return isInternationalCompetitionType(competitionType) ? "international" : "club";
}

/** True when a stored country label is really a club side name. */
export function countryNameLooksLikeClubTeam(
  countryName: string | null | undefined,
  clubName?: string | null,
  clubTeamName?: string | null,
): boolean {
  if (!countryName?.trim()) return false;
  const normalized = countryName.trim().toLowerCase();
  if (clubName && clubName.trim().toLowerCase() === normalized) return true;
  if (clubTeamName && clubTeamName.trim().toLowerCase() === normalized) return true;

  if (isKnownInternationalCountryName(countryName)) return false;

  const lower = normalized;
  return (
    lower.includes(" rugby") ||
    /\b(saints|bears|sharks|tigers|warriors|ulster|connacht|ospreys|scarlets|leinster|munster|chiefs|gloucester|harlequins|saracens|northampton|leicester|cardiff|dragons|newcastle|exeter|bath|sale|bristol)\b/.test(
      lower,
    )
  );
}

type PlayerProfilePatch = {
  clubName?: string | null;
  countryName?: string | null;
  clubTeamId?: string | null;
  internationalTeamId?: string | null;
};

export function mergePlayerProfileFromSquad(
  existing: {
    clubName: string | null;
    countryName: string | null;
    clubTeamId: string | null;
    internationalTeamId: string | null;
  },
  input: {
    clubName?: string;
    countryName?: string;
    clubTeamId?: string;
    internationalTeamId?: string;
  },
  squad?: SquadContext,
): PlayerProfilePatch {
  const patch: PlayerProfilePatch = {};

  if (squad?.kind === "club") {
    patch.clubTeamId = squad.teamId;
    patch.clubName = input.clubName ?? squad.teamName ?? existing.clubName;
    if (
      countryNameLooksLikeClubTeam(existing.countryName, patch.clubName, squad.teamName) ||
      existing.countryName === squad.teamName
    ) {
      patch.countryName = null;
    }
    if (
      input.countryName &&
      !countryNameLooksLikeClubTeam(input.countryName, patch.clubName, squad.teamName)
    ) {
      patch.countryName = input.countryName;
    }
    return patch;
  }

  if (squad?.kind === "international") {
    patch.internationalTeamId = squad.teamId;
    patch.countryName = input.countryName ?? squad.teamName;
    if (input.clubName) patch.clubName = input.clubName;
    if (input.clubTeamId) patch.clubTeamId = input.clubTeamId;
    return patch;
  }

  if (input.clubName) patch.clubName = input.clubName;
  if (input.clubTeamId) patch.clubTeamId = input.clubTeamId;
  if (input.internationalTeamId) patch.internationalTeamId = input.internationalTeamId;
  if (
    input.countryName &&
    !countryNameLooksLikeClubTeam(input.countryName, input.clubName ?? existing.clubName)
  ) {
    patch.countryName = input.countryName;
  }
  return patch;
}

function pickDominantTeam(
  counts: Map<string, { teamId: string; teamName: string; count: number }>,
): { teamId: string; teamName: string } | null {
  let best: { teamId: string; teamName: string; count: number } | null = null;
  for (const row of counts.values()) {
    if (!best || row.count > best.count) best = row;
  }
  return best ? { teamId: best.teamId, teamName: best.teamName } : null;
}

/** Reconcile club / international / country from fixture squads and career stints. */
export async function repairPlayerProfileFromSquads(playerId: string): Promise<boolean> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return false;

  const squads = await db
    .select({
      teamId: fixturePlayers.teamId,
      teamName: teams.name,
      competitionType: competitions.competitionType,
    })
    .from(fixturePlayers)
    .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(fixturePlayers.playerId, playerId));

  const clubCounts = new Map<string, { teamId: string; teamName: string; count: number }>();
  const intlCounts = new Map<string, { teamId: string; teamName: string; count: number }>();

  for (const row of squads) {
    const bucket = isInternationalCompetitionType(row.competitionType) ? intlCounts : clubCounts;
    const prev = bucket.get(row.teamId);
    if (prev) prev.count += 1;
    else bucket.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, count: 1 });
  }

  const topClub = pickDominantTeam(clubCounts);
  const topIntl = pickDominantTeam(intlCounts);

  const intlStints = await db
    .select({ teamId: playerCareerStints.teamId, teamName: playerCareerStints.teamName })
    .from(playerCareerStints)
    .where(and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "international")))
    .limit(1);

  const patch: PlayerProfilePatch = {};

  if (topClub) {
    patch.clubTeamId = topClub.teamId;
    patch.clubName = topClub.teamName;
  }

  const intlTeam = topIntl ?? (intlStints[0]?.teamId
    ? { teamId: intlStints[0].teamId!, teamName: intlStints[0].teamName }
    : null);

  const ctx = await loadTeamClassificationContext();

  if (intlTeam?.teamId && isInternationalTeamId(ctx, intlTeam.teamId)) {
    patch.internationalTeamId = intlTeam.teamId;
    patch.countryName = intlTeam.teamName;
  }

  const curated = lookupInternationalPlayerProfile({
    providerId: player.externalProviderId ?? undefined,
    name: player.name,
  });
  if (curated.countryName && !countryNameLooksLikeClubTeam(curated.countryName, patch.clubName ?? player.clubName)) {
    patch.countryName = curated.countryName;
    if (!patch.internationalTeamId) {
      const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
      const intl = allTeams.find((t) => t.name.toLowerCase() === curated.countryName!.toLowerCase());
      if (intl) patch.internationalTeamId = intl.id;
    }
  }
  if (curated.clubName && !patch.clubName && !topClub) {
    patch.clubName = curated.clubName;
    const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
    const club = allTeams.find((t) => t.name.toLowerCase() === curated.clubName!.toLowerCase());
    if (club) patch.clubTeamId = club.id;
  }

  const wrongCountry = countryNameLooksLikeClubTeam(
    player.countryName,
    patch.clubName ?? player.clubName,
    topClub?.teamName,
  );
  if (wrongCountry) {
    patch.countryName = intlTeam?.teamName ?? null;
  } else if (!patch.countryName && player.countryName && !wrongCountry) {
    patch.countryName = player.countryName;
  }

  const next = {
    clubName: patch.clubName ?? player.clubName,
    countryName: patch.countryName !== undefined ? patch.countryName : player.countryName,
    clubTeamId: patch.clubTeamId ?? player.clubTeamId,
    internationalTeamId: patch.internationalTeamId ?? player.internationalTeamId,
  };

  if (
    next.clubName === player.clubName &&
    next.countryName === player.countryName &&
    next.clubTeamId === player.clubTeamId &&
    next.internationalTeamId === player.internationalTeamId
  ) {
    return false;
  }

  await db
    .update(players)
    .set({
      clubName: next.clubName,
      countryName: next.countryName,
      clubTeamId: next.clubTeamId,
      internationalTeamId: next.internationalTeamId,
    })
    .where(eq(players.id, playerId));

  return true;
}

export async function repairAllPlayerProfilesFromSquads(): Promise<{ repaired: number; total: number }> {
  const db = getDb();
  const all = await db.select({ id: players.id }).from(players);
  let repaired = 0;
  for (const row of all) {
    if (await repairPlayerProfileFromSquads(row.id)) repaired += 1;
  }
  return { repaired, total: all.length };
}

/** Fill empty positionName from the most common lineup position in fixture squads. */
export async function fillPositionFromSquads(playerId: string): Promise<boolean> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player || player.positionName?.trim()) return false;

  const squads = await db
    .select({ positionName: fixturePlayers.positionName })
    .from(fixturePlayers)
    .where(and(eq(fixturePlayers.playerId, playerId), isNotNull(fixturePlayers.positionName)));

  const counts = new Map<string, number>();
  for (const row of squads) {
    const pos = row.positionName?.trim();
    if (!pos) continue;
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }
  if (counts.size === 0) return false;

  let bestPos: string | null = null;
  let bestCount = 0;
  for (const [pos, count] of counts) {
    if (count > bestCount) {
      bestPos = pos;
      bestCount = count;
    }
  }
  if (!bestPos) return false;

  await db.update(players).set({ positionName: bestPos }).where(eq(players.id, playerId));
  return true;
}

export async function fillAllPositionsFromSquads(): Promise<{ filled: number; total: number }> {
  const db = getDb();
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(or(isNull(players.positionName), eq(players.positionName, "")));
  let filled = 0;
  for (const row of rows) {
    if (await fillPositionFromSquads(row.id)) filled += 1;
  }
  return { filled, total: rows.length };
}

/** Infer countryName from stored birthPlace when nationality is missing. */
export async function fillNationalityFromBirthPlace(playerId: string): Promise<boolean> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player || player.countryName?.trim() || !player.birthPlace?.trim()) return false;

  const nationality = parseNationalityFromBirthPlace(player.birthPlace);
  if (!nationality || countryNameLooksLikeClubTeam(nationality, player.clubName)) return false;

  await db.update(players).set({ countryName: nationality }).where(eq(players.id, playerId));
  return true;
}

export async function fillAllNationalitiesFromBirthPlace(): Promise<{ filled: number; total: number }> {
  const db = getDb();
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(and(or(isNull(players.countryName), eq(players.countryName, "")), isNotNull(players.birthPlace)));
  let filled = 0;
  for (const row of rows) {
    if (await fillNationalityFromBirthPlace(row.id)) filled += 1;
  }
  return { filled, total: rows.length };
}

function dominantValue(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Backfill empty position/club from Sport365 event payload fields. */
export async function backfillAllPlayerProfilesFromEventPayloads(): Promise<{
  updated: number;
  total: number;
}> {
  const db = getDb();
  const events = await db
    .select({ playerId: matchEvents.playerId, payload: matchEvents.payload })
    .from(matchEvents)
    .where(isNotNull(matchEvents.playerId));

  const byPlayer = new Map<string, { clubs: Map<string, number>; positions: Map<string, number> }>();
  for (const row of events) {
    if (!row.playerId) continue;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const bucket = byPlayer.get(row.playerId) ?? { clubs: new Map(), positions: new Map() };
    for (const key of ["player_club", "player_out_club"] as const) {
      const value = typeof payload[key] === "string" ? payload[key].trim() : "";
      if (value) bucket.clubs.set(value, (bucket.clubs.get(value) ?? 0) + 1);
    }
    for (const key of ["player_position", "player_out_position"] as const) {
      const value = typeof payload[key] === "string" ? payload[key].trim() : "";
      if (value) bucket.positions.set(value, (bucket.positions.get(value) ?? 0) + 1);
    }
    byPlayer.set(row.playerId, bucket);
  }

  let updated = 0;
  for (const [playerId, data] of byPlayer) {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!player) continue;

    const patch: {
      positionName?: string;
      clubName?: string;
    } = {};

    if (!player.positionName?.trim()) {
      const positionName = dominantValue(data.positions);
      if (positionName) patch.positionName = positionName;
    }
    if (!player.clubName?.trim() && !player.clubTeamId) {
      const clubName = dominantValue(data.clubs);
      if (clubName && !countryNameLooksLikeClubTeam(clubName)) patch.clubName = clubName;
    }

    if (Object.keys(patch).length === 0) continue;
    await db.update(players).set(patch).where(eq(players.id, playerId));
    updated += 1;
  }

  return { updated, total: byPlayer.size };
}

export type PlayerListDisplayFields = {
  positionName: string | null;
  clubName: string | null;
  clubTeamName: string | null;
  internationalTeamName: string | null;
  countryName: string | null;
};

/** Read-time fallbacks for admin player list when stored profile fields are empty. */
export async function batchPlayerListDisplayFields(
  playerIds: string[],
): Promise<Map<string, PlayerListDisplayFields>> {
  const result = new Map<string, PlayerListDisplayFields>();
  if (!playerIds.length) return result;

  const db = getDb();
  const squadRows = await db
    .select({
      playerId: fixturePlayers.playerId,
      positionName: fixturePlayers.positionName,
      teamName: teams.name,
      competitionType: competitions.competitionType,
      kickoffAt: fixtures.kickoffAt,
    })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(teams, eq(fixturePlayers.teamId, teams.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(inArray(fixturePlayers.playerId, playerIds))
    .orderBy(desc(fixtures.kickoffAt));

  const latestSquadByPlayer = new Map<string, (typeof squadRows)[number]>();
  for (const row of squadRows) {
    if (!latestSquadByPlayer.has(row.playerId)) latestSquadByPlayer.set(row.playerId, row);
  }

  const eventRows = await db
    .select({ playerId: matchEvents.playerId, payload: matchEvents.payload })
    .from(matchEvents)
    .where(and(isNotNull(matchEvents.playerId), inArray(matchEvents.playerId, playerIds)));

  const eventClubs = new Map<string, Map<string, number>>();
  const eventPositions = new Map<string, Map<string, number>>();
  for (const row of eventRows) {
    if (!row.playerId) continue;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const clubs = eventClubs.get(row.playerId) ?? new Map();
    const positions = eventPositions.get(row.playerId) ?? new Map();
    for (const key of ["player_club", "player_out_club"] as const) {
      const value = typeof payload[key] === "string" ? payload[key].trim() : "";
      if (value) clubs.set(value, (clubs.get(value) ?? 0) + 1);
    }
    for (const key of ["player_position", "player_out_position"] as const) {
      const value = typeof payload[key] === "string" ? payload[key].trim() : "";
      if (value) positions.set(value, (positions.get(value) ?? 0) + 1);
    }
    eventClubs.set(row.playerId, clubs);
    eventPositions.set(row.playerId, positions);
  }

  for (const playerId of playerIds) {
    const squad = latestSquadByPlayer.get(playerId);
    const intl = squad && isInternationalCompetitionType(squad.competitionType);
    const clubTeamName = squad && !intl ? squad.teamName : null;
    const internationalTeamName = squad && intl ? squad.teamName : null;

    result.set(playerId, {
      positionName: squad?.positionName?.trim() || dominantValue(eventPositions.get(playerId) ?? new Map()),
      clubName: dominantValue(eventClubs.get(playerId) ?? new Map()),
      clubTeamName,
      internationalTeamName,
      countryName: internationalTeamName,
    });
  }

  return result;
}

export function playerProfileIncompleteWhere() {
  return or(
    and(isNull(players.clubTeamId), or(isNull(players.clubName), eq(players.clubName, ""))),
    or(isNull(players.countryName), eq(players.countryName, "")),
    or(isNull(players.positionName), eq(players.positionName, "")),
  );
}
