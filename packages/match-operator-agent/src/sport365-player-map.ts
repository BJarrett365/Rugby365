import type { Sport365Lineups, Sport365LineupPlayer } from "./sport365-lineups";
import { formatPlayerRole, jerseyToPositionName } from "./rugby-positions";

export type LineupPlayerRef = Sport365LineupPlayer & {
  side: "home" | "away";
};

export type MappedPlayer = {
  name: string;
  jerseyNumber?: number;
  providerId?: string;
  positionName?: string;
  clubName?: string;
  countryName?: string;
  lineupMatched: boolean;
  mappedFrom?: "match_events" | "lineup";
};

export type PlayerMapInput = {
  playerProviderId?: string;
  playerName?: string;
  teamPos: number;
};

export type MatchEventPlayerSource = {
  id?: string;
  teamPos: number;
  payload?: Record<string, unknown> | null;
};

export type PlayerRegistry = {
  byProviderId: Map<string, MappedPlayer & { teamPos: number }>;
  byTeamAndName: Map<string, MappedPlayer & { teamPos: number }>;
};

function createEmptyRegistry(): PlayerRegistry {
  return { byProviderId: new Map(), byTeamAndName: new Map() };
}

function playerFromLineupRef(player: LineupPlayerRef): MappedPlayer {
  return {
    name: player.name,
    jerseyNumber: player.jerseyNumber,
    providerId: player.providerId,
    positionName: player.positionName ?? jerseyToPositionName(player.jerseyNumber),
    clubName: player.clubName,
    countryName: player.countryName,
    lineupMatched: true,
    mappedFrom: "lineup",
  };
}

export function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function teamNameKey(teamPos: number, name: string): string {
  return `${teamPos}:${normalizePlayerName(name)}`;
}

function mergePlayerRecord(
  existing: (MappedPlayer & { teamPos: number }) | undefined,
  next: Partial<MappedPlayer> & { teamPos: number; name: string },
): MappedPlayer & { teamPos: number } {
  return {
    name: next.name || existing?.name || "",
    jerseyNumber: next.jerseyNumber ?? existing?.jerseyNumber,
    providerId: next.providerId ?? existing?.providerId,
    positionName: next.positionName ?? existing?.positionName,
    clubName: next.clubName ?? existing?.clubName,
    countryName: next.countryName ?? existing?.countryName,
    lineupMatched: next.lineupMatched ?? existing?.lineupMatched ?? false,
    mappedFrom: next.mappedFrom ?? existing?.mappedFrom,
    teamPos: next.teamPos,
  };
}

function readPayloadPlayer(
  payload: Record<string, unknown>,
  field: "player" | "player_out",
): (MappedPlayer & { teamPos: number }) | null {
  const name = typeof payload[field] === "string" ? payload[field].trim() : "";
  if (!name) return null;

  const idKey = field === "player" ? "player_provider_id" : "player_out_provider_id";
  const jerseyKey = field === "player" ? "player_jersey" : "player_out_jersey";

  return {
    name,
    providerId: typeof payload[idKey] === "string" ? payload[idKey] : undefined,
    jerseyNumber: typeof payload[jerseyKey] === "number" ? payload[jerseyKey] : undefined,
    lineupMatched: payload.lineup_matched === true,
    mappedFrom:
      payload.mapped_from === "match_events" || payload.mapped_from === "lineup"
        ? payload.mapped_from
        : undefined,
    teamPos: 0,
  };
}

function absorbPayloadPlayer(
  registry: PlayerRegistry,
  teamPos: number,
  payload: Record<string, unknown>,
  field: "player" | "player_out",
) {
  const base = readPayloadPlayer(payload, field);
  if (!base) return;

  const record = { ...base, teamPos };

  if (record.providerId) {
    const existing = registry.byProviderId.get(record.providerId);
    registry.byProviderId.set(record.providerId, mergePlayerRecord(existing, record));
  }

  const nameKey = teamNameKey(teamPos, record.name);
  const existingByName = registry.byTeamAndName.get(nameKey);
  registry.byTeamAndName.set(nameKey, mergePlayerRecord(existingByName, record));
}

export function buildLineupPlayerLookup(lineups?: Sport365Lineups): Map<string, LineupPlayerRef> {
  const lookup = new Map<string, LineupPlayerRef>();
  if (!lineups) return lookup;

  for (const side of ["home", "away"] as const) {
    const team = lineups[side];
    for (const player of [...team.starting, ...team.substitutes]) {
      if (player.providerId) lookup.set(player.providerId, { ...player, side });
    }
  }
  return lookup;
}

export function buildPlayerRegistryFromEvents(events: MatchEventPlayerSource[]): PlayerRegistry {
  const registry = createEmptyRegistry();
  for (const event of events) {
    const payload = event.payload ?? {};
    absorbPayloadPlayer(registry, event.teamPos, payload, "player");
    absorbPayloadPlayer(registry, event.teamPos, payload, "player_out");
  }
  return registry;
}

export function resolveLineupPlayer(
  lineups: Sport365Lineups | undefined,
  input: PlayerMapInput,
): MappedPlayer | null {
  if (!lineups) {
    const name = input.playerName?.trim();
    return name ? { name, lineupMatched: false } : null;
  }

  const lookup = buildLineupPlayerLookup(lineups);
  const side: "home" | "away" = input.teamPos === 0 ? "home" : "away";
  const teamPlayers = [...lineups[side].starting, ...lineups[side].substitutes];

  if (input.playerProviderId) {
    const byId = lookup.get(input.playerProviderId);
    if (byId) return playerFromLineupRef(byId);
  }

  const incidentName = input.playerName?.trim();
  if (incidentName) {
    const normalized = normalizePlayerName(incidentName);
    const byName = teamPlayers.find((p) => normalizePlayerName(p.name) === normalized);
    if (byName) {
      return {
        name: byName.name,
        jerseyNumber: byName.jerseyNumber,
        providerId: byName.providerId,
        positionName: byName.positionName ?? jerseyToPositionName(byName.jerseyNumber),
        clubName: byName.clubName,
        countryName: byName.countryName,
        lineupMatched: true,
        mappedFrom: "lineup",
      };
    }
    return { name: incidentName, lineupMatched: false };
  }

  return null;
}

export function resolvePlayerFromMatchData(
  input: PlayerMapInput,
  registry: PlayerRegistry,
  lineups?: Sport365Lineups,
): MappedPlayer | null {
  const name = input.playerName?.trim();

  if (input.playerProviderId) {
    const fromEvent = registry.byProviderId.get(input.playerProviderId);
    if (fromEvent && (fromEvent.jerseyNumber !== undefined || fromEvent.name)) {
      const fromLineup = resolveLineupPlayer(lineups, input);
      return {
        name: fromEvent.name || name || "",
        jerseyNumber: fromEvent.jerseyNumber,
        providerId: fromEvent.providerId,
        positionName: fromLineup?.positionName ?? fromEvent.positionName,
        clubName: fromLineup?.clubName ?? fromEvent.clubName,
        countryName: fromLineup?.countryName ?? fromEvent.countryName,
        lineupMatched: fromEvent.lineupMatched,
        mappedFrom: "match_events",
      };
    }
  }

  if (name) {
    const fromEvent = registry.byTeamAndName.get(teamNameKey(input.teamPos, name));
    if (fromEvent && (fromEvent.jerseyNumber !== undefined || fromEvent.providerId)) {
      const fromLineup = resolveLineupPlayer(lineups, input);
      return {
        name: fromEvent.name,
        jerseyNumber: fromEvent.jerseyNumber,
        providerId: fromEvent.providerId,
        positionName: fromLineup?.positionName ?? fromEvent.positionName,
        clubName: fromLineup?.clubName ?? fromEvent.clubName,
        countryName: fromLineup?.countryName ?? fromEvent.countryName,
        lineupMatched: fromEvent.lineupMatched,
        mappedFrom: "match_events",
      };
    }
  }

  const fromLineup = resolveLineupPlayer(lineups, input);
  if (fromLineup) return fromLineup;

  return name ? { name, lineupMatched: false } : null;
}

function enrichPayloadField(
  payload: Record<string, unknown>,
  teamPos: number,
  field: "player" | "player_out",
  registry: PlayerRegistry,
  lineups?: Sport365Lineups,
): Record<string, unknown> {
  const idKey = field === "player" ? "player_provider_id" : "player_out_provider_id";
  const jerseyKey = field === "player" ? "player_jersey" : "player_out_jersey";
  const name = typeof payload[field] === "string" ? payload[field].trim() : "";
  if (!name) return payload;

  const mapped = resolvePlayerFromMatchData(
    {
      playerProviderId: typeof payload[idKey] === "string" ? payload[idKey] : undefined,
      playerName: name,
      teamPos,
    },
    registry,
    lineups,
  );
  if (!mapped) return payload;

  const mappedFrom = mapped.mappedFrom ?? (mapped.lineupMatched ? "lineup" : undefined);
  const positionKey = field === "player" ? "player_position" : "player_out_position";
  const clubKey = field === "player" ? "player_club" : "player_out_club";
  const roleKey = field === "player" ? "player_role" : "player_out_role";

  return {
    ...payload,
    [field]: mapped.name,
    [idKey]: mapped.providerId ?? payload[idKey] ?? null,
    [jerseyKey]: mapped.jerseyNumber ?? payload[jerseyKey] ?? null,
    [positionKey]: mapped.positionName ?? null,
    [clubKey]: mapped.clubName ?? null,
    [roleKey]: formatPlayerRole(mapped.positionName, mapped.clubName) || null,
    lineup_matched: mapped.lineupMatched,
    ...(mappedFrom ? { mapped_from: mappedFrom } : {}),
  };
}

export function enrichEventPayloadsFromMatchEvents(
  events: Array<{ id: string; teamPos: number; payload: Record<string, unknown> }>,
  lineups?: Sport365Lineups,
): Map<string, Record<string, unknown>> {
  const registry = createEmptyRegistry();
  const updates = new Map<string, Record<string, unknown>>();

  for (const event of events) {
    let payload = { ...event.payload };
    payload = enrichPayloadField(payload, event.teamPos, "player", registry, lineups);
    payload = enrichPayloadField(payload, event.teamPos, "player_out", registry, lineups);
    updates.set(event.id, payload);
    absorbPayloadPlayer(registry, event.teamPos, payload, "player");
    absorbPayloadPlayer(registry, event.teamPos, payload, "player_out");
  }

  return updates;
}

export function formatMappedPlayerLabel(player: MappedPlayer): string {
  if (player.jerseyNumber !== undefined) return `#${player.jerseyNumber} ${player.name}`;
  return player.name;
}

export function teamPosForTeamId(
  teamId: string | null | undefined,
  homeTeamId: string | null | undefined,
  awayTeamId: string | null | undefined,
): number {
  if (teamId && awayTeamId && teamId === awayTeamId) return 1;
  return 0;
}
