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
  "Rugby Championship",
  "Tri Nations",
  "Nations Championship",
  "British & Irish Lions",
  "Autumn / End-of-Year",
  "Mid-Year / Incoming",
  "Freedom Cup",
  "Mandela Challenge Plate",
  "Prince William Cup",
  "Puma Trophy",
  "Six Nations",
] as const;

export type HeadToHeadCompetitionSlot = (typeof H2H_COMPETITION_SLOTS)[number];

/** Shown in UI copy; CMS historical meetings are included regardless of year. */
export const H2H_DATA_FROM_YEAR = 1906;

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

export function normalizeCompetitionSlot(name: string): HeadToHeadCompetitionSlot | null {
  const value = name.trim().toLowerCase();
  if (value.includes("world cup")) return "World Cup";
  if (value.includes("tri nation")) return "Tri Nations";
  if (value.includes("rugby championship") || value.includes("the rugby championship")) {
    return "Rugby Championship";
  }
  if (value.includes("nations championship")) return "Nations Championship";
  if (value.includes("lion")) return "British & Irish Lions";
  if (value.includes("freedom cup")) return "Freedom Cup";
  if (value.includes("mandela challenge plate") || value.includes("nelson mandela challenge")) {
    return "Mandela Challenge Plate";
  }
  if (value.includes("prince william")) return "Prince William Cup";
  if (value.includes("puma trophy")) return "Puma Trophy";
  if (
    value.includes("autumn") ||
    value.includes("end-of-year") ||
    value.includes("end of year") ||
    value.includes("quillter nations") ||
    value.includes("autumn nations")
  ) {
    return "Autumn / End-of-Year";
  }
  if (
    value.includes("mid-year") ||
    value.includes("mid year") ||
    value.includes("incoming") ||
    value.includes("summer international")
  ) {
    return "Mid-Year / Incoming";
  }
  if (value.includes("six nations")) return "Six Nations";
  if (value.includes("international") || value.includes("friendly")) {
    return "International Matches";
  }
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

function emptySlot(slot: HeadToHeadCompetitionSlot): HeadToHeadCompetitionRecord {
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
}

function mergeCompetitionRecords(
  a: HeadToHeadCompetitionRecord,
  b: HeadToHeadCompetitionRecord,
): HeadToHeadCompetitionRecord {
  const aMeetings = a.homeWins + a.awayWins + a.draws;
  const bMeetings = b.homeWins + b.awayWins + b.draws;
  const preferWins = bMeetings > aMeetings ? b : a;
  const preferAvgs = a.homeAvgTries != null || a.homeAvgCarries != null || a.homeAvgTackles != null ? a : b;
  return {
    competitionName: a.competitionName,
    competitionId: a.competitionId ?? b.competitionId,
    homeWins: preferWins.homeWins,
    awayWins: preferWins.awayWins,
    draws: preferWins.draws,
    homeAvgTries: preferAvgs.homeAvgTries ?? a.homeAvgTries ?? b.homeAvgTries,
    awayAvgTries: preferAvgs.awayAvgTries ?? a.awayAvgTries ?? b.awayAvgTries,
    homeAvgCarries: preferAvgs.homeAvgCarries ?? a.homeAvgCarries ?? b.homeAvgCarries,
    awayAvgCarries: preferAvgs.awayAvgCarries ?? a.awayAvgCarries ?? b.awayAvgCarries,
    homeAvgTackles: preferAvgs.homeAvgTackles ?? a.homeAvgTackles ?? b.homeAvgTackles,
    awayAvgTackles: preferAvgs.awayAvgTackles ?? a.awayAvgTackles ?? b.awayAvgTackles,
    hasData: a.hasData || b.hasData || preferWins.homeWins + preferWins.awayWins + preferWins.draws > 0,
  };
}

/** Aggregate CMS / meeting rows into competition slot win totals (fixture-home perspective). */
export function competitionRecordsFromMeetings(
  meetings: Array<{
    competition: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }>,
  fixtureHomeTeam: string,
): HeadToHeadCompetitionRecord[] {
  const bySlot = new Map<HeadToHeadCompetitionSlot, HeadToHeadCompetitionRecord>();
  for (const meeting of meetings) {
    if (meeting.homeScore == null || meeting.awayScore == null) continue;
    if (meeting.status === "scheduled" || meeting.status === "fixture" || meeting.status === "cancelled") {
      continue;
    }
    const slot = normalizeCompetitionSlot(meeting.competition ?? "") ?? "International Matches";
    const row = bySlot.get(slot) ?? emptySlot(slot);
    if (meeting.homeScore === meeting.awayScore) {
      row.draws += 1;
    } else {
      const homeIsFixtureHome = meeting.homeTeam.toLowerCase() === fixtureHomeTeam.toLowerCase();
      const homeWon = meeting.homeScore > meeting.awayScore;
      if (homeIsFixtureHome) {
        if (homeWon) row.homeWins += 1;
        else row.awayWins += 1;
      } else if (meeting.awayTeam.toLowerCase() === fixtureHomeTeam.toLowerCase()) {
        if (!homeWon) row.homeWins += 1;
        else row.awayWins += 1;
      }
    }
    row.hasData = true;
    bySlot.set(slot, row);
  }
  return [...bySlot.values()];
}

export function buildCompetitionSlots(records: HeadToHeadCompetitionRecord[]): HeadToHeadCompetitionRecord[] {
  const bySlot = new Map<HeadToHeadCompetitionSlot, HeadToHeadCompetitionRecord>();
  for (const record of records) {
    const slot =
      normalizeCompetitionSlot(record.competitionName) ??
      (H2H_COMPETITION_SLOTS.includes(record.competitionName as HeadToHeadCompetitionSlot)
        ? (record.competitionName as HeadToHeadCompetitionSlot)
        : null);
    if (!slot) continue;
    const next = { ...record, competitionName: slot };
    const existing = bySlot.get(slot);
    bySlot.set(slot, existing ? mergeCompetitionRecords(existing, next) : next);
  }

  return H2H_COMPETITION_SLOTS.map((slot) => bySlot.get(slot) ?? emptySlot(slot));
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
