export type ParsedClubSquadPlayer = {
  name: string;
  positionName: string | null;
  squadNumber: number | null;
  profileUrl: string | null;
};

export type ParsedClubSquadDocument = {
  clubName: string;
  sourceUrl: string;
  players: ParsedClubSquadPlayer[];
};
