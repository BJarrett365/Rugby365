import { jerseyToPositionName } from "./rugby-positions";

export type SdmsLineupPlayerRow = {
  position: number;
  id: string;
  name: string;
};

export type SdmsLineupsData = {
  match_id: string;
  home_lineup: {
    playing: SdmsLineupPlayerRow[];
    substitutes: SdmsLineupPlayerRow[];
  };
  away_lineup: {
    playing: SdmsLineupPlayerRow[];
    substitutes: SdmsLineupPlayerRow[];
  };
};

export type MappedLineupPlayer = {
  providerId: string;
  name: string;
  jerseyNumber: number;
  positionName: string;
  clubName?: string;
  countryName?: string;
};

export type MappedTeamLineup = {
  teamName: string;
  providerTeamId?: string;
  starting: MappedLineupPlayer[];
  substitutes: MappedLineupPlayer[];
};

export type MappedLineups = {
  home: MappedTeamLineup;
  away: MappedTeamLineup;
};

function mapPlayers(rows: SdmsLineupPlayerRow[], teamName: string): MappedLineupPlayer[] {
  return rows
    .filter((row) => row.name?.trim())
    .map((row) => ({
      providerId: row.id,
      name: row.name.trim(),
      jerseyNumber: row.position,
      positionName: jerseyToPositionName(row.position),
    }))
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
}

export function mapSdmsLineups(
  data: SdmsLineupsData,
  homeTeamName: string,
  awayTeamName: string,
  homeTeamId?: string,
  awayTeamId?: string,
): MappedLineups {
  return {
    home: {
      teamName: homeTeamName,
      providerTeamId: homeTeamId,
      starting: mapPlayers(data.home_lineup.playing ?? [], homeTeamName),
      substitutes: mapPlayers(data.home_lineup.substitutes ?? [], homeTeamName),
    },
    away: {
      teamName: awayTeamName,
      providerTeamId: awayTeamId,
      starting: mapPlayers(data.away_lineup.playing ?? [], awayTeamName),
      substitutes: mapPlayers(data.away_lineup.substitutes ?? [], awayTeamName),
    },
  };
}
