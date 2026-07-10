export type HeadToHeadMeetingRow = {
  id: string;
  source: "sdms" | "sport365" | "cms";
  matchId: string | null;
  date: string | null;
  competition: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  cmsFixtureId: string | null;
  cmsFixtureSlug: string | null;
  cmsLinked: boolean;
  cmsMatch: boolean;
};

export type HeadToHeadCompetitionRecord = {
  competitionName: string;
  competitionId: string | null;
  homeWins: number;
  awayWins: number;
  draws: number;
  homeAvgTries: number | null;
  awayAvgTries: number | null;
  homeAvgCarries: number | null;
  awayAvgCarries: number | null;
  homeAvgTackles: number | null;
  awayAvgTackles: number | null;
  hasData: boolean;
};

export const H2H_COMPETITION_SLOTS = [
  "International Matches",
  "World Cup",
  "Six Nations",
  "Nations Championship",
] as const;

export type HeadToHeadCompetitionSlot = (typeof H2H_COMPETITION_SLOTS)[number];

export const H2H_DATA_FROM_YEAR = 2011;

export type HeadToHeadComparison = {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  summary: {
    totalMeetings: number;
    homeWins: number;
    awayWins: number;
    draws: number;
    cmsFixtures: number;
    linkedToCms: number;
    missingFromCms: number;
  };
  competitionRecords: HeadToHeadCompetitionRecord[];
  competitionSlots: HeadToHeadCompetitionRecord[];
  dataFromYear: number;
  meetings: HeadToHeadMeetingRow[];
  sources: {
    sdmsMeetings: number;
    sport365Meetings: number;
    cmsMeetings: number;
    sport365Url: string | null;
    planetRugbyUrl: string | null;
  };
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCompetitionSlot(name: string): HeadToHeadCompetitionSlot | null {
  const value = name.trim().toLowerCase();
  if (value.includes("international")) return "International Matches";
  if (value.includes("world cup")) return "World Cup";
  if (value.includes("six nations")) return "Six Nations";
  if (value.includes("nations championship")) return "Nations Championship";
  return null;
}

function parseSdmsCompetitionRecord(row: Record<string, unknown>): HeadToHeadCompetitionRecord | null {
  const competitionName = str(row.competition_name) ?? str(row.competition);
  if (!competitionName) return null;
  const homeAvgTries = num(row.home_team_avg_tries);
  const awayAvgTries = num(row.away_team_avg_tries);
  const homeAvgCarries = num(row.home_team_avg_carries);
  const awayAvgCarries = num(row.away_team_avg_carries);
  const homeAvgTackles = num(row.home_team_avg_tackles);
  const awayAvgTackles = num(row.away_team_avg_tackles);
  const homeWins = num(row.home_team_wins) ?? 0;
  const awayWins = num(row.away_team_wins) ?? 0;
  const draws = num(row.draws) ?? 0;
  const hasData =
    homeWins > 0 ||
    awayWins > 0 ||
    draws > 0 ||
    homeAvgTries != null ||
    awayAvgTries != null ||
    homeAvgCarries != null ||
    awayAvgCarries != null ||
    homeAvgTackles != null ||
    awayAvgTackles != null;

  return {
    competitionName,
    competitionId: str(row.competition_id),
    homeWins,
    awayWins,
    draws,
    homeAvgTries,
    awayAvgTries,
    homeAvgCarries,
    awayAvgCarries,
    homeAvgTackles,
    awayAvgTackles,
    hasData,
  };
}

export function parseSdmsHeadToHeadRecords(rows: unknown[]): HeadToHeadCompetitionRecord[] {
  const records: HeadToHeadCompetitionRecord[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const parsed = parseSdmsCompetitionRecord(row as Record<string, unknown>);
    if (parsed) records.push(parsed);
  }
  return records;
}

export function buildCompetitionSlots(records: HeadToHeadCompetitionRecord[]): HeadToHeadCompetitionRecord[] {
  const bySlot = new Map<HeadToHeadCompetitionSlot, HeadToHeadCompetitionRecord>();
  for (const record of records) {
    const slot = normalizeCompetitionSlot(record.competitionName);
    if (!slot) continue;
    const existing = bySlot.get(slot);
    if (!existing || (!existing.hasData && record.hasData)) {
      bySlot.set(slot, { ...record, competitionName: slot });
    }
  }

  return H2H_COMPETITION_SLOTS.map((slot) => {
    const record = bySlot.get(slot);
    if (record) return record;
    return {
      competitionName: slot,
      competitionId: null,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      homeAvgTries: null,
      awayAvgTries: null,
      homeAvgCarries: null,
      awayAvgCarries: null,
      homeAvgTackles: null,
      awayAvgTackles: null,
      hasData: false,
    };
  });
}

export function mergeProviderSnapshot(
  existing: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const nextSdms = {
    ...((base.sdms as Record<string, unknown> | undefined) ?? {}),
    ...((patch.sdms as Record<string, unknown> | undefined) ?? {}),
  };
  const nextSport365 = {
    ...((base.sport365 as Record<string, unknown> | undefined) ?? {}),
    ...((patch.sport365 as Record<string, unknown> | undefined) ?? {}),
  };
  return {
    ...base,
    ...patch,
    sdms: Object.keys(nextSdms).length ? nextSdms : base.sdms,
    sport365: Object.keys(nextSport365).length ? nextSport365 : base.sport365,
  };
}
