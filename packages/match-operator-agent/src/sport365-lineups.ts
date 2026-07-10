import { lookupInternationalPlayerProfile } from "./international-player-profiles";
import { jerseyToPositionName } from "./rugby-positions";

export type Sport365LineupPlayer = {
  providerId: string;
  name: string;
  jerseyNumber: number;
  positionCode?: number;
  positionName?: string;
  clubName?: string;
  countryName?: string;
};

export type Sport365TeamLineup = {
  teamName: string;
  providerTeamId?: string;
  starting: Sport365LineupPlayer[];
  substitutes: Sport365LineupPlayer[];
};

export type Sport365Lineups = {
  home: Sport365TeamLineup;
  away: Sport365TeamLineup;
};

type RawPlayer = {
  id?: string;
  name?: string;
  j_num?: number;
  a_pos?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parsePlayers(rows: unknown, teamName: string, substitute = false): Sport365LineupPlayer[] {
  if (!Array.isArray(rows)) return [];
  const players: Sport365LineupPlayer[] = [];
  for (const raw of rows) {
    if (!isRecord(raw)) continue;
    const row = raw as RawPlayer;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const providerId = typeof row.id === "string" ? row.id : "";
    const jerseyNumber = asNumber(row.j_num);
    if (!name || jerseyNumber === undefined) continue;
    const profile = lookupInternationalPlayerProfile({
      providerId,
      name,
      jerseyNumber,
      teamName,
    });
    players.push({
      providerId,
      name,
      jerseyNumber,
      positionCode: asNumber(row.a_pos),
      positionName: profile.positionName ?? jerseyToPositionName(jerseyNumber),
      clubName: profile.clubName,
      countryName: profile.countryName,
    });
  }
  return players.sort((a, b) => a.jerseyNumber - b.jerseyNumber);
}

export function parseSport365Lineups(
  lineupRaw: unknown,
  homeTeam: string,
  awayTeam: string,
  homeProviderTeamId?: string,
  awayProviderTeamId?: string,
): Sport365Lineups | undefined {
  if (!Array.isArray(lineupRaw) || lineupRaw.length === 0) return undefined;

  const byPos = new Map<number, Record<string, unknown>>();
  for (const entry of lineupRaw) {
    if (!isRecord(entry)) continue;
    const pos = asNumber(entry.pos);
    if (pos === undefined) continue;
    byPos.set(pos, entry);
  }

  const homeEntry = byPos.get(0);
  const awayEntry = byPos.get(1);
  if (!homeEntry && !awayEntry) return undefined;

  return {
    home: {
      teamName: homeTeam,
      providerTeamId: homeProviderTeamId,
      starting: parsePlayers(homeEntry?.starting, homeTeam, false),
      substitutes: parsePlayers(homeEntry?.substitutes, homeTeam, true),
    },
    away: {
      teamName: awayTeam,
      providerTeamId: awayProviderTeamId,
      starting: parsePlayers(awayEntry?.starting, awayTeam, false),
      substitutes: parsePlayers(awayEntry?.substitutes, awayTeam, true),
    },
  };
}
