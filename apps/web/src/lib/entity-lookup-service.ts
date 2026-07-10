import { inArray } from "drizzle-orm";
import { players, teams } from "@rugby365/db";
import type {
  MappedLineups,
  SdmsKeyEvent,
  SdmsMatchDetail,
  SdmsMatchPlayerStats,
} from "@rugby365/import-sdk";
import { getDb } from "./db";
import {
  type CmsEntityLink,
  type MatchEntityContext,
  normalizeProviderPlayerName,
} from "./match-entity-context";

export type { CmsEntityLink, MatchEntityContext } from "./match-entity-context";
export { lookupPlayerLink, lookupTeamLink, normalizeProviderPlayerName } from "./match-entity-context";

function linkFromPlayer(row: {
  id: string;
  slug: string;
  name: string;
  externalProviderId: string | null;
}): CmsEntityLink {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    externalProviderId: row.externalProviderId,
  };
}

function linkFromTeam(row: {
  id: string;
  slug: string;
  name: string;
  externalProviderId: string | null;
}): CmsEntityLink {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    externalProviderId: row.externalProviderId,
  };
}

export async function loadPlayersByExternalIds(externalIds: string[]): Promise<Map<string, CmsEntityLink>> {
  const ids = [...new Set(externalIds.filter(Boolean))];
  const map = new Map<string, CmsEntityLink>();
  if (ids.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select({
      id: players.id,
      slug: players.slug,
      name: players.name,
      externalProviderId: players.externalProviderId,
    })
    .from(players)
    .where(inArray(players.externalProviderId, ids));

  for (const row of rows) {
    if (row.externalProviderId) map.set(row.externalProviderId, linkFromPlayer(row));
  }
  return map;
}

export async function loadTeamsByExternalIds(externalIds: string[]): Promise<Map<string, CmsEntityLink>> {
  const ids = [...new Set(externalIds.filter(Boolean))];
  const map = new Map<string, CmsEntityLink>();
  if (ids.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      name: teams.name,
      externalProviderId: teams.externalProviderId,
    })
    .from(teams)
    .where(inArray(teams.externalProviderId, ids));

  for (const row of rows) {
    if (row.externalProviderId) map.set(row.externalProviderId, linkFromTeam(row));
  }
  return map;
}

function collectPlayerExternalIds(input: {
  lineups: MappedLineups | null;
  keyEvents: SdmsKeyEvent[];
  playerStats: SdmsMatchPlayerStats | null;
  scoringDetail?: Record<string, unknown>;
}): string[] {
  const ids = new Set<string>();

  if (input.lineups) {
    for (const side of ["home", "away"] as const) {
      for (const p of [...input.lineups[side].starting, ...input.lineups[side].substitutes]) {
        if (p.providerId) ids.add(p.providerId);
      }
    }
  }

  for (const event of input.keyEvents) {
    if (event.player_id) ids.add(event.player_id);
  }

  if (input.playerStats) {
    for (const side of ["home", "away"] as const) {
      for (const category of ["attack", "defend", "kicking"] as const) {
        for (const row of input.playerStats[side][category]?.detail_list ?? []) {
          if (row.player_id) ids.add(row.player_id);
        }
      }
    }
  }

  const detail = input.scoringDetail ?? {};
  for (const key of Object.keys(detail)) {
    const value = detail[key];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (entry && typeof entry === "object" && typeof (entry as { player_id?: string }).player_id === "string") {
        ids.add((entry as { player_id: string }).player_id);
      }
    }
  }

  return [...ids];
}

export async function buildMatchEntityContext(input: {
  detail: SdmsMatchDetail;
  lineups: MappedLineups | null;
  playerStats: SdmsMatchPlayerStats | null;
  squadPlayerIds?: string[];
}): Promise<MatchEntityContext> {
  const keyEvents = input.detail.key_events ?? [];
  const playerExternalIds = collectPlayerExternalIds({
    lineups: input.lineups,
    keyEvents,
    playerStats: input.playerStats,
    scoringDetail: input.detail.detail as Record<string, unknown> | undefined,
  });

  const teamExternalIds = [input.detail.home_team_id, input.detail.away_team_id].filter(
    (id): id is string => Boolean(id),
  );

  const [playersByExt, teamsByExt] = await Promise.all([
    loadPlayersByExternalIds(playerExternalIds),
    loadTeamsByExternalIds(teamExternalIds),
  ]);

  const playersByExternalId = Object.fromEntries(playersByExt);
  const playersByName: Record<string, CmsEntityLink> = {};
  for (const link of playersByExt.values()) {
    playersByName[link.name.toLowerCase()] = link;
    const normalized = normalizeProviderPlayerName(link.name).toLowerCase();
    if (normalized) playersByName[normalized] = link;
  }

  return {
    playersByExternalId,
    playersByName,
    teamsByExternalId: Object.fromEntries(teamsByExt),
    homeTeam: input.detail.home_team_id ? teamsByExt.get(input.detail.home_team_id) ?? null : null,
    awayTeam: input.detail.away_team_id ? teamsByExt.get(input.detail.away_team_id) ?? null : null,
    squadPlayerIds: input.squadPlayerIds ?? [],
  };
}
