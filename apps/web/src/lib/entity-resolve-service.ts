import { and, eq, inArray } from "drizzle-orm";
import { competitions, fixturePlayers, fixtures, matchEvents, players, teams } from "@rugby365/db";
import type { Sport365Lineups } from "@rugby365/match-operator-agent";
import { getDb } from "./db";
import { normalizeProviderPlayerName } from "./match-entity-context";
import { normalizePlayerName, normalizeTeamName, normalizedEntityKey, isJunkTeamName } from "./entity-normalize";
import { normalizeSlug } from "./fixture-admin-service";
import {
  mergePlayerProfileFromSquad,
  squadKindFromCompetitionType,
  type SquadContext,
} from "./player-profile-fields";
import { canonicalCompetitionDisplayName } from "./competition-list-utils";
import { findCompetitionByCanonicalName } from "./competition-dedupe-service";

type TeamRow = typeof teams.$inferSelect;
type PlayerRow = typeof players.$inferSelect;

const SPORT365 = "sport365";
export const SDMS_PROVIDER = "sdms";

function providerForExternalId(sourceProvider?: string, externalProviderId?: string): string {
  if (sourceProvider) return sourceProvider;
  if (externalProviderId) return SPORT365;
  return "manual";
}

function uniqueSlug(base: string, externalProviderId?: string): string {
  const slug = normalizeSlug(base);
  if (!externalProviderId) return slug;
  const suffix = externalProviderId.replace(/[^a-z0-9]/gi, "").slice(-8).toLowerCase();
  return suffix ? `${slug}-${suffix}` : slug;
}

export async function resolveTeam(input: {
  name: string;
  externalProviderId?: string;
  createIfMissing?: boolean;
  sourceProvider?: string;
  /** Provider crest URL — filled when missing on the CMS team. */
  imageUrl?: string | null;
}): Promise<TeamRow | null> {
  const db = getDb();
  const name = normalizeTeamName(input.name.trim());
  if (!name || isJunkTeamName(name)) return null;
  const imageUrl = input.imageUrl?.trim() || null;

  if (input.externalProviderId) {
    const [byExternal] = await db
      .select()
      .from(teams)
      .where(eq(teams.externalProviderId, input.externalProviderId))
      .limit(1);
    if (byExternal) {
      const patch: { name?: string; imageUrl?: string } = {};
      if (byExternal.name !== name) patch.name = name;
      if (imageUrl && !byExternal.imageUrl) patch.imageUrl = imageUrl;
      if (Object.keys(patch).length > 0) {
        const [updated] = await db
          .update(teams)
          .set(patch)
          .where(eq(teams.id, byExternal.id))
          .returning();
        return updated;
      }
      return byExternal;
    }
  }

  const lower = normalizedEntityKey(name, "team");
  const allTeams = await db.select().from(teams);
  const byName = allTeams.find((t) => normalizedEntityKey(t.name, "team") === lower);
  if (byName) {
    const patch: {
      externalProviderId?: string;
      sourceProvider?: string;
      imageUrl?: string;
    } = {};
    if (input.externalProviderId && !byName.externalProviderId) {
      patch.externalProviderId = input.externalProviderId;
      patch.sourceProvider = providerForExternalId(input.sourceProvider, input.externalProviderId);
    }
    if (imageUrl && !byName.imageUrl) patch.imageUrl = imageUrl;
    if (Object.keys(patch).length > 0) {
      const [updated] = await db
        .update(teams)
        .set(patch)
        .where(eq(teams.id, byName.id))
        .returning();
      return updated;
    }
    return byName;
  }

  const slug = uniqueSlug(name, input.externalProviderId);
  const bySlug = allTeams.find((t) => t.slug === slug);
  if (bySlug) {
    const patch: {
      externalProviderId?: string;
      sourceProvider?: string;
      imageUrl?: string;
    } = {};
    if (input.externalProviderId && !bySlug.externalProviderId) {
      patch.externalProviderId = input.externalProviderId;
      patch.sourceProvider = SPORT365;
    }
    if (imageUrl && !bySlug.imageUrl) patch.imageUrl = imageUrl;
    if (Object.keys(patch).length > 0) {
      const [updated] = await db
        .update(teams)
        .set(patch)
        .where(eq(teams.id, bySlug.id))
        .returning();
      return updated;
    }
    return bySlug;
  }

  if (input.createIfMissing === false) return null;

  const [row] = await db
    .insert(teams)
    .values({
      name,
      slug,
      shortName: name.slice(0, 3).toUpperCase(),
      externalProviderId: input.externalProviderId ?? null,
      sourceProvider: providerForExternalId(input.sourceProvider, input.externalProviderId),
      imageUrl,
    })
    .returning();
  return row;
}

export async function resolveCompetition(input: {
  name: string;
  externalProviderId?: string;
  stageExternalId?: string;
  stageName?: string;
  sourceProvider?: string;
}): Promise<typeof competitions.$inferSelect | null> {
  const db = getDb();
  const name = input.name.trim();
  if (!name) return null;

  if (input.externalProviderId) {
    const [byExternal] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.externalProviderId, input.externalProviderId))
      .limit(1);
    if (byExternal) {
      const [updated] = await db
        .update(competitions)
        .set({
          name: canonicalCompetitionDisplayName(name),
          stageExternalId: input.stageExternalId ?? byExternal.stageExternalId,
          stageName: input.stageName ?? byExternal.stageName,
        })
        .where(eq(competitions.id, byExternal.id))
        .returning();
      return updated;
    }
  }

  const slug = uniqueSlug(name, input.externalProviderId);
  const [bySlug] = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
  if (bySlug) {
    if (input.externalProviderId && !bySlug.externalProviderId) {
      const [updated] = await db
        .update(competitions)
        .set({
          externalProviderId: input.externalProviderId,
          sourceProvider: SPORT365,
          stageExternalId: input.stageExternalId ?? bySlug.stageExternalId,
          stageName: input.stageName ?? bySlug.stageName,
        })
        .where(eq(competitions.id, bySlug.id))
        .returning();
      return updated;
    }
    return bySlug;
  }

  // Hard rule: never create a second competition with the same canonical name.
  const byCanonical = await findCompetitionByCanonicalName(name);
  if (byCanonical) {
    const patch: {
      externalProviderId?: string;
      sourceProvider?: string;
      stageExternalId?: string | null;
      stageName?: string | null;
      sdmsCompCode?: string | null;
      name?: string;
    } = {};
    if (input.externalProviderId && !byCanonical.externalProviderId) {
      patch.externalProviderId = input.externalProviderId;
      patch.sourceProvider = providerForExternalId(input.sourceProvider, input.externalProviderId);
    }
    if (input.stageExternalId && !byCanonical.stageExternalId) {
      patch.stageExternalId = input.stageExternalId;
    }
    if (input.stageName && !byCanonical.stageName) {
      patch.stageName = input.stageName;
    }
    const display = canonicalCompetitionDisplayName(name);
    if (byCanonical.name !== display) patch.name = display;
    if (Object.keys(patch).length) {
      const [updated] = await db
        .update(competitions)
        .set(patch)
        .where(eq(competitions.id, byCanonical.id))
        .returning();
      return updated;
    }
    return byCanonical;
  }

  const [row] = await db
    .insert(competitions)
    .values({
      name: canonicalCompetitionDisplayName(name),
      slug,
      externalProviderId: input.externalProviderId ?? null,
      sourceProvider: providerForExternalId(input.sourceProvider, input.externalProviderId),
      stageExternalId: input.stageExternalId ?? null,
      stageName: input.stageName ?? null,
    })
    .returning();
  return row;
}

export async function resolvePlayer(input: {
  name: string;
  externalProviderId?: string;
  positionName?: string;
  clubName?: string;
  countryName?: string;
  clubTeamId?: string;
  internationalTeamId?: string;
  squadContext?: SquadContext;
  createIfMissing?: boolean;
  skipArchiveEnrich?: boolean;
  sourceProvider?: string;
}): Promise<PlayerRow | null> {
  const db = getDb();
  const name = normalizePlayerName(input.name.trim());
  if (!name) return null;

  function buildProfilePatch(existing: PlayerRow) {
    const squadPatch = mergePlayerProfileFromSquad(
      existing,
      {
        clubName: input.clubName,
        countryName: input.countryName,
        clubTeamId: input.clubTeamId,
        internationalTeamId: input.internationalTeamId,
      },
      input.squadContext,
    );
    return {
      name,
      positionName: input.positionName ?? existing.positionName,
      clubName: squadPatch.clubName !== undefined ? squadPatch.clubName : existing.clubName,
      countryName: squadPatch.countryName !== undefined ? squadPatch.countryName : existing.countryName,
      clubTeamId: squadPatch.clubTeamId !== undefined ? squadPatch.clubTeamId : existing.clubTeamId,
      internationalTeamId:
        squadPatch.internationalTeamId !== undefined
          ? squadPatch.internationalTeamId
          : existing.internationalTeamId,
    };
  }

  if (input.externalProviderId) {
    const [byExternal] = await db
      .select()
      .from(players)
      .where(eq(players.externalProviderId, input.externalProviderId))
      .limit(1);
    if (byExternal) {
      const profilePatch = buildProfilePatch(byExternal);
      if (
        byExternal.name !== name ||
        byExternal.positionName !== profilePatch.positionName ||
        byExternal.clubName !== profilePatch.clubName ||
        byExternal.countryName !== profilePatch.countryName ||
        byExternal.clubTeamId !== profilePatch.clubTeamId ||
        byExternal.internationalTeamId !== profilePatch.internationalTeamId
      ) {
        const [updated] = await db
          .update(players)
          .set(profilePatch)
          .where(eq(players.id, byExternal.id))
          .returning();
        return updated;
      }
      return byExternal;
    }
  }

  const lower = normalizedEntityKey(name, "player");
  const allPlayers = await db.select().from(players);
  const byName = allPlayers.find((p) => normalizedEntityKey(p.name, "player") === lower);
  if (byName) {
    const profilePatch = {
      ...buildProfilePatch(byName),
      externalProviderId: input.externalProviderId ?? byName.externalProviderId,
      sourceProvider: input.externalProviderId
        ? providerForExternalId(input.sourceProvider, input.externalProviderId)
        : byName.sourceProvider,
    };
    if (
      input.externalProviderId &&
      (!byName.externalProviderId ||
        byName.positionName !== profilePatch.positionName ||
        byName.clubName !== profilePatch.clubName ||
        byName.countryName !== profilePatch.countryName ||
        byName.clubTeamId !== profilePatch.clubTeamId ||
        byName.internationalTeamId !== profilePatch.internationalTeamId)
    ) {
      const [updated] = await db
        .update(players)
        .set(profilePatch)
        .where(eq(players.id, byName.id))
        .returning();
      return updated;
    }
    return byName;
  }

  if (input.createIfMissing === false) return null;

  const slug = uniqueSlug(name, input.externalProviderId);
  const profilePatch = buildProfilePatch({
    clubName: null,
    countryName: null,
    clubTeamId: null,
    internationalTeamId: null,
    positionName: null,
  } as PlayerRow);
  const [row] = await db
    .insert(players)
    .values({
      name,
      slug,
      externalProviderId: input.externalProviderId ?? null,
      sourceProvider: providerForExternalId(input.sourceProvider, input.externalProviderId),
      positionName: profilePatch.positionName ?? null,
      clubName: profilePatch.clubName ?? null,
      countryName: profilePatch.countryName ?? null,
      clubTeamId: profilePatch.clubTeamId ?? null,
      internationalTeamId: profilePatch.internationalTeamId ?? null,
    })
    .returning();

  if (!input.skipArchiveEnrich) {
    void import("./player-wikipedia-enrich").then(({ schedulePlayerWikipediaEnrich }) => {
      schedulePlayerWikipediaEnrich(row.id, row.name);
    });
  }

  return row;
}

export async function syncFixtureSquad(
  fixtureId: string,
  lineups: Sport365Lineups | undefined,
  homeTeamId: string,
  awayTeamId: string,
  options?: { sourceProvider?: string },
): Promise<number> {
  if (!lineups) return 0;
  const db = getDb();
  let synced = 0;

  const [fixtureRow] = await db
    .select({
      competitionId: fixtures.competitionId,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  let competitionType: string | null = null;
  if (fixtureRow?.competitionId) {
    const [comp] = await db
      .select({ competitionType: competitions.competitionType })
      .from(competitions)
      .where(eq(competitions.id, fixtureRow.competitionId))
      .limit(1);
    competitionType = comp?.competitionType ?? null;
  }

  const squadKind = squadKindFromCompetitionType(competitionType);
  const teamRows = await db
    .select()
    .from(teams)
    .where(inArray(teams.id, [homeTeamId, awayTeamId]));
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t]));

  const sides: Array<{ side: "home" | "away"; teamId: string }> = [
    { side: "home", teamId: homeTeamId },
    { side: "away", teamId: awayTeamId },
  ];

  for (const { side, teamId } of sides) {
    const squad = lineups[side];
    const team = teamById[teamId];
    const squadContext: SquadContext = {
      kind: squadKind,
      teamId,
      teamName: team?.name ?? squad.teamName,
    };
    const rows = [
      ...squad.starting.map((p) => ({ ...p, squadRole: "starting" as const })),
      ...squad.substitutes.map((p) => ({ ...p, squadRole: "substitute" as const })),
    ];

    for (const entry of rows) {
      const player = await resolvePlayer({
        name: entry.name,
        externalProviderId: entry.providerId || undefined,
        positionName: entry.positionName,
        clubName: entry.clubName,
        countryName: entry.countryName,
        createIfMissing: true,
        sourceProvider: options?.sourceProvider,
        skipArchiveEnrich: options?.sourceProvider === SDMS_PROVIDER,
        squadContext,
      });
      if (!player) continue;

      const [existing] = await db
        .select()
        .from(fixturePlayers)
        .where(and(eq(fixturePlayers.fixtureId, fixtureId), eq(fixturePlayers.playerId, player.id)))
        .limit(1);

      if (existing) {
        await db
          .update(fixturePlayers)
          .set({
            teamId,
            jerseyNumber: entry.jerseyNumber,
            squadRole: entry.squadRole,
            positionName: entry.positionName ?? null,
            clubName: entry.clubName ?? null,
          })
          .where(eq(fixturePlayers.id, existing.id));
      } else {
        await db.insert(fixturePlayers).values({
          fixtureId,
          playerId: player.id,
          teamId,
          jerseyNumber: entry.jerseyNumber,
          squadRole: entry.squadRole,
          positionName: entry.positionName ?? null,
          clubName: entry.clubName ?? null,
        });
      }
      synced += 1;
    }
  }

  return synced;
}

export { normalizeProviderPlayerName } from "./match-entity-context";

export async function resolvePlayerIdFromPayload(
  payload: Record<string, unknown>,
  field: "player" | "player_out" = "player",
): Promise<string | null> {
  const rawName = typeof payload[field] === "string" ? payload[field].trim() : "";
  const name = normalizeProviderPlayerName(rawName);
  if (!name) return null;
  const idKey = field === "player" ? "player_provider_id" : "player_out_provider_id";
  const externalProviderId = typeof payload[idKey] === "string" ? payload[idKey] : undefined;
  const player = await resolvePlayer({
    name,
    externalProviderId,
    createIfMissing: Boolean(externalProviderId),
    sourceProvider: externalProviderId ? SDMS_PROVIDER : undefined,
  });
  return player?.id ?? null;
}

export async function linkFixtureEventPlayerIds(fixtureId: string): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(matchEvents).where(eq(matchEvents.fixtureId, fixtureId));
  let linked = 0;

  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const playerId = await resolvePlayerIdFromPayload(payload, "player");
    const playerOutId = await resolvePlayerIdFromPayload(payload, "player_out");

    const nextPayload = { ...payload };
    let patch: Partial<typeof matchEvents.$inferInsert> = {};

    if (playerId && playerId !== row.playerId) {
      nextPayload.player_id = playerId;
      patch.playerId = playerId;
    }

    if (playerOutId) {
      nextPayload.player_out_id = playerOutId;
    }

    const payloadChanged = JSON.stringify(nextPayload) !== JSON.stringify(payload);
    const rowChanged = patch.playerId && patch.playerId !== row.playerId;

    if (rowChanged || payloadChanged) {
      await db
        .update(matchEvents)
        .set({ ...patch, payload: nextPayload })
        .where(eq(matchEvents.id, row.id));
      linked += 1;
    }
  }

  return linked;
}
