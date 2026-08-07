import { and, eq, or } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import type { Sport365HeadToHead, Sport365HeadToHeadMeeting } from "@rugby365/match-operator-agent";
import { getDb } from "./db";
import { getFixtureById } from "./fixture-admin-service";
import {
  buildCompetitionSlots,
  competitionRecordsFromMeetings,
  type HeadToHeadCompetitionRecord,
  type HeadToHeadComparison,
  type HeadToHeadMeetingRow,
  H2H_DATA_FROM_YEAR,
  parseSdmsHeadToHeadRecords,
} from "./head-to-head-shared";

export type {
  HeadToHeadMeetingRow,
  HeadToHeadCompetitionRecord,
  HeadToHeadCompetitionSlot,
  HeadToHeadComparison,
} from "./head-to-head-shared";
export {
  H2H_COMPETITION_SLOTS,
  H2H_DATA_FROM_YEAR,
  buildCompetitionSlots,
  competitionRecordsFromMeetings,
  mergeProviderSnapshot,
  parseSdmsHeadToHeadRecords,
} from "./head-to-head-shared";

type ProviderSnapshot = {
  source?: string;
  sport365MatchId?: string;
  sdms?: {
    headToHead?: Record<string, unknown>[];
    lastFiveMeetings?: Record<string, unknown>[];
  };
  sport365?: {
    headToHead?: Sport365HeadToHead | null;
    syncedAt?: string;
  };
  headToHead?: Sport365HeadToHead | Record<string, unknown>[];
  lastFiveMeetings?: Record<string, unknown>[];
};

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function meetingKey(row: Pick<HeadToHeadMeetingRow, "date" | "homeTeam" | "awayTeam" | "homeScore" | "awayScore">) {
  return [row.date?.slice(0, 10) ?? "", row.homeTeam.toLowerCase(), row.awayTeam.toLowerCase(), row.homeScore ?? "", row.awayScore ?? ""].join("|");
}

function parseSdmsMeeting(row: Record<string, unknown>, index: number): HeadToHeadMeetingRow | null {
  const homeTeam = str(row.home_team_name) ?? str(row.home_team);
  const awayTeam = str(row.away_team_name) ?? str(row.away_team);
  if (!homeTeam || !awayTeam) return null;
  const dateRaw = str(row.date) ?? str(row.match_date) ?? str(row.kickoff_at);
  const date = dateRaw ? new Date(dateRaw).toISOString() : null;
  return {
    id: `sdms-${str(row.match_id) ?? index}`,
    source: "sdms",
    matchId: str(row.match_id) ?? str(row.id),
    date,
    competition: str(row.competition_name) ?? str(row.competition),
    homeTeam,
    awayTeam,
    homeScore: num(row.home_team_score ?? row.home_score),
    awayScore: num(row.away_team_score ?? row.away_score),
    status: str(row.status) ?? "full_time",
    cmsFixtureId: null,
    cmsFixtureSlug: null,
    cmsLinked: false,
    cmsMatch: false,
  };
}

function parseSport365Meeting(row: Sport365HeadToHeadMeeting): HeadToHeadMeetingRow {
  return {
    id: `sport365-${row.matchId}`,
    source: "sport365",
    matchId: row.matchId,
    date: row.date ?? null,
    competition: row.competition ?? row.stageName ?? null,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    status: row.status,
    cmsFixtureId: null,
    cmsFixtureSlug: null,
    cmsLinked: false,
    cmsMatch: false,
  };
}

function extractMeetingsFromSnapshot(snap: ProviderSnapshot | null | undefined): {
  sdmsMeetings: HeadToHeadMeetingRow[];
  sport365Meetings: HeadToHeadMeetingRow[];
  competitionRecords: HeadToHeadCompetitionRecord[];
} {
  const sdmsMeetings: HeadToHeadMeetingRow[] = [];
  const sport365Meetings: HeadToHeadMeetingRow[] = [];
  const competitionRecords: HeadToHeadCompetitionRecord[] = [];

  const sdmsLastFive = snap?.sdms?.lastFiveMeetings ?? snap?.lastFiveMeetings ?? [];
  for (const [index, row] of sdmsLastFive.entries()) {
    if (!row || typeof row !== "object") continue;
    const parsed = parseSdmsMeeting(row as Record<string, unknown>, index);
    if (parsed) sdmsMeetings.push(parsed);
  }

  const sdmsRecords = snap?.sdms?.headToHead ?? (Array.isArray(snap?.headToHead) ? snap?.headToHead : []);
  competitionRecords.push(...parseSdmsHeadToHeadRecords(sdmsRecords));

  const sport365H2h =
    snap?.sport365?.headToHead ??
    (snap?.headToHead && !Array.isArray(snap.headToHead) ? (snap.headToHead as Sport365HeadToHead) : null);
  if (sport365H2h?.meetings?.length) {
    for (const meeting of sport365H2h.meetings) {
      sport365Meetings.push(parseSport365Meeting(meeting));
    }
    if (competitionRecords.length === 0 && sport365H2h.totalMeetings > 0) {
      competitionRecords.push({
        competitionName: "All meetings (Sport365)",
        competitionId: null,
        homeWins: sport365H2h.homeWins,
        awayWins: sport365H2h.awayWins,
        draws: sport365H2h.draws,
        homeAvgTries: null,
        awayAvgTries: null,
        homeAvgCarries: null,
        awayAvgCarries: null,
        homeAvgTackles: null,
        awayAvgTackles: null,
        hasData: true,
      });
    }
  }

  return { sdmsMeetings, sport365Meetings, competitionRecords };
}

async function listCmsFixturesBetweenTeams(homeTeamId: string, awayTeamId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(fixtures)
    .where(
      or(
        and(eq(fixtures.homeTeamId, homeTeamId), eq(fixtures.awayTeamId, awayTeamId)),
        and(eq(fixtures.homeTeamId, awayTeamId), eq(fixtures.awayTeamId, homeTeamId)),
      ),
    );
  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((team) => [team.id, team]));
  return rows.map((row) => ({
    ...row,
    homeTeam: row.homeTeamId ? teamById[row.homeTeamId] ?? null : null,
    awayTeam: row.awayTeamId ? teamById[row.awayTeamId] ?? null : null,
  }));
}

function cmsFixtureToMeeting(
  row: (typeof fixtures.$inferSelect) & { homeTeam?: { name: string } | null; awayTeam?: { name: string } | null },
): HeadToHeadMeetingRow {
  return {
    id: `cms-${row.id}`,
    source: "cms",
    matchId: row.externalMatchId,
    date: row.kickoffAt ? new Date(row.kickoffAt).toISOString() : null,
    competition: row.competitionName,
    homeTeam: row.homeTeam?.name ?? "Home",
    awayTeam: row.awayTeam?.name ?? "Away",
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    status: row.status,
    cmsFixtureId: row.id,
    cmsFixtureSlug: row.slug,
    cmsLinked: true,
    cmsMatch: true,
  };
}

function linkMeetingsToCms(
  meetings: HeadToHeadMeetingRow[],
  cmsRows: Array<(typeof fixtures.$inferSelect) & { homeTeam?: { name: string } | null; awayTeam?: { name: string } | null }>,
) {
  const byExternal = new Map<string, (typeof cmsRows)[number]>();
  const byDateScore = new Map<string, (typeof cmsRows)[number]>();
  for (const row of cmsRows) {
    if (row.externalMatchId) byExternal.set(row.externalMatchId, row);
    const date = row.kickoffAt ? new Date(row.kickoffAt).toISOString().slice(0, 10) : "";
    byDateScore.set(`${date}|${row.homeScore}|${row.awayScore}`, row);
  }

  for (const meeting of meetings) {
    const linked =
      (meeting.matchId ? byExternal.get(meeting.matchId) : undefined) ??
      byDateScore.get(`${meeting.date?.slice(0, 10) ?? ""}|${meeting.homeScore}|${meeting.awayScore}`);
    if (!linked) continue;
    meeting.cmsFixtureId = linked.id;
    meeting.cmsFixtureSlug = linked.slug;
    meeting.cmsLinked = true;
    meeting.cmsMatch = true;
  }
}

function dedupeMeetings(rows: HeadToHeadMeetingRow[]) {
  const seen = new Map<string, HeadToHeadMeetingRow>();
  for (const row of rows) {
    const key = meetingKey(row);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
      continue;
    }
    if (!existing.cmsLinked && row.cmsLinked) seen.set(key, { ...row, cmsFixtureId: row.cmsFixtureId ?? existing.cmsFixtureId, cmsFixtureSlug: row.cmsFixtureSlug ?? existing.cmsFixtureSlug });
  }
  return [...seen.values()].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.homeTeam.localeCompare(b.homeTeam));
}

function scoreSummary(
  meetings: HeadToHeadMeetingRow[],
  fixtureHome: string,
  fixtureAway: string,
) {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const meeting of meetings) {
    if (meeting.homeScore == null || meeting.awayScore == null) continue;
    if (meeting.homeScore === meeting.awayScore) {
      draws += 1;
      continue;
    }
    const homeIsFixtureHome = meeting.homeTeam.toLowerCase() === fixtureHome.toLowerCase();
    const homeWon = meeting.homeScore > meeting.awayScore;
    if (homeIsFixtureHome) {
      if (homeWon) homeWins += 1;
      else awayWins += 1;
    } else if (meeting.awayTeam.toLowerCase() === fixtureHome.toLowerCase()) {
      if (!homeWon) homeWins += 1;
      else awayWins += 1;
    }
  }
  return { homeWins, awayWins, draws };
}

export async function compareFixtureHeadToHead(fixtureId: string): Promise<HeadToHeadComparison> {
  const fixture = await getFixtureById(fixtureId);
  if (!fixture) throw new Error("Fixture not found");

  const homeTeam = fixture.homeTeam?.name ?? "Home";
  const awayTeam = fixture.awayTeam?.name ?? "Away";
  const snap = (fixture.providerSnapshot ?? {}) as ProviderSnapshot;

  const { sdmsMeetings, sport365Meetings, competitionRecords } = extractMeetingsFromSnapshot(snap);

  const cmsRows =
    fixture.homeTeamId && fixture.awayTeamId
      ? await listCmsFixturesBetweenTeams(fixture.homeTeamId, fixture.awayTeamId)
      : [];

  const cmsMeetings = cmsRows.map((row) => cmsFixtureToMeeting(row));

  const importedMeetings = dedupeMeetings([...sdmsMeetings, ...sport365Meetings]);
  linkMeetingsToCms(importedMeetings, cmsRows);

  const missingFromCms = importedMeetings.filter((row) => !row.cmsLinked);
  const historicalCms = cmsMeetings.filter((cms) => cms.cmsFixtureId !== fixtureId);
  const meetings = dedupeMeetings([
    ...importedMeetings,
    ...historicalCms.filter((cms) => !importedMeetings.some((row) => row.cmsFixtureId === cms.cmsFixtureId)),
  ]);

  const playedMeetings = meetings.filter(
    (row) =>
      row.cmsFixtureId !== fixtureId &&
      row.homeScore != null &&
      row.awayScore != null &&
      row.status !== "scheduled" &&
      row.status !== "fixture",
  );

  const meetingSummary = scoreSummary(playedMeetings, homeTeam, awayTeam);
  const cmsCompetitionRecords = competitionRecordsFromMeetings(playedMeetings, homeTeam);

  return {
    fixtureId,
    homeTeam,
    awayTeam,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    summary: {
      totalMeetings: playedMeetings.length,
      homeWins: meetingSummary.homeWins,
      awayWins: meetingSummary.awayWins,
      draws: meetingSummary.draws,
      cmsFixtures: cmsRows.length,
      linkedToCms: importedMeetings.filter((row) => row.cmsLinked).length,
      missingFromCms: missingFromCms.length,
    },
    competitionRecords: [...cmsCompetitionRecords, ...competitionRecords],
    competitionSlots: buildCompetitionSlots([...cmsCompetitionRecords, ...competitionRecords]),
    dataFromYear: H2H_DATA_FROM_YEAR,
    meetings,
    sources: {
      sdmsMeetings: sdmsMeetings.length,
      sport365Meetings: sport365Meetings.length,
      cmsMeetings: cmsRows.length,
      sport365Url: fixture.sport365Url,
      planetRugbyUrl: fixture.planetRugbyUrl,
    },
  };
}

