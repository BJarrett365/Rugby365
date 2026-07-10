import { parseSport365StartTimestamp, sport365StatusLabel } from "./sport365-parse";

const SPORT365_API = "https://api.sport365.com";

export type Sport365HeadToHeadMeeting = {
  matchId: string;
  date?: string;
  competition?: string;
  stageName?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
};

export type Sport365HeadToHead = {
  homeTeam: string;
  awayTeam: string;
  homeProviderTeamId: string;
  awayProviderTeamId: string;
  totalMeetings: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  meetings: Sport365HeadToHeadMeeting[];
};

type H2HGroup = {
  c_name?: string;
  st_name?: string;
  matches?: H2HMatchRow[];
};

type H2HMatchRow = {
  id?: string;
  c_name?: string;
  st_name?: string;
  start?: number;
  status?: number;
  status_txt?: string;
  score?: number[];
  teams?: Array<{ id?: string; name?: string; pos?: number }>;
};

async function fetchSport365ApiJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${SPORT365_API}${path}`, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Rugby365MatchOperatorAgent/0.1",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Sport365 API HTTP ${res.status} for ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseMeeting(row: H2HMatchRow): Sport365HeadToHeadMeeting | null {
  const teams = Array.isArray(row.teams) ? row.teams : [];
  const home = teams.find((t) => t.pos === 0) ?? teams[0];
  const away = teams.find((t) => t.pos === 1) ?? teams[1];
  const homeTeam = home?.name?.trim();
  const awayTeam = away?.name?.trim();
  if (!homeTeam || !awayTeam || !row.id) return null;

  const score = Array.isArray(row.score) ? row.score : [];
  return {
    matchId: row.id,
    date: parseSport365StartTimestamp(row.start),
    competition: row.c_name,
    stageName: row.st_name,
    homeTeam,
    awayTeam,
    homeScore: score[0] ?? 0,
    awayScore: score[1] ?? 0,
    status: sport365StatusLabel(row.status, row.status_txt),
  };
}

function meetingIncludesTeams(meeting: Sport365HeadToHeadMeeting, teamA: string, teamB: string): boolean {
  const names = new Set([meeting.homeTeam.toLowerCase(), meeting.awayTeam.toLowerCase()]);
  return names.has(teamA.toLowerCase()) && names.has(teamB.toLowerCase());
}

function resultForFixtureHome(
  meeting: Sport365HeadToHeadMeeting,
  fixtureHomeTeam: string,
  fixtureAwayTeam: string,
): "home_win" | "away_win" | "draw" | "unknown" {
  if (meeting.status !== "full_time") return "unknown";
  const homeIsFixtureHome = meeting.homeTeam.toLowerCase() === fixtureHomeTeam.toLowerCase();
  const homeIsFixtureAway = meeting.homeTeam.toLowerCase() === fixtureAwayTeam.toLowerCase();
  if (!homeIsFixtureHome && !homeIsFixtureAway) return "unknown";
  if (meeting.homeScore === meeting.awayScore) return "draw";
  const fixtureHomeScoredMore = homeIsFixtureHome
    ? meeting.homeScore > meeting.awayScore
    : meeting.awayScore > meeting.homeScore;
  return fixtureHomeScoredMore ? "home_win" : "away_win";
}

export async function fetchSport365HeadToHead(input: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeProviderTeamId: string;
  awayProviderTeamId: string;
}): Promise<Sport365HeadToHead> {
  const paths = [
    `/v1/en/matches/rugby_union/match/${input.matchId}/h2h`,
    `/v1/en/matches/rugby_union/h2h/${input.homeProviderTeamId}/${input.awayProviderTeamId}`,
  ];

  const meetingsById = new Map<string, Sport365HeadToHeadMeeting>();

  for (const path of paths) {
    try {
      const groups = await fetchSport365ApiJson<H2HGroup[]>(path);
      for (const group of groups) {
        for (const row of group.matches ?? []) {
          const teamIds = (row.teams ?? []).map((t) => t.id).filter(Boolean) as string[];
          const hasBothTeams =
            teamIds.includes(input.homeProviderTeamId) && teamIds.includes(input.awayProviderTeamId);
          if (!hasBothTeams) continue;
          const meeting = parseMeeting(row);
          if (!meeting) continue;
          if (!meetingIncludesTeams(meeting, input.homeTeam, input.awayTeam)) continue;
          meetingsById.set(meeting.matchId, meeting);
        }
      }
    } catch {
      /* try next path */
    }
  }

  const meetings = Array.from(meetingsById.values()).sort((a, b) => {
    const ad = a.date ?? "";
    const bd = b.date ?? "";
    return bd.localeCompare(ad) || a.matchId.localeCompare(b.matchId);
  });

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const meeting of meetings) {
    const result = resultForFixtureHome(meeting, input.homeTeam, input.awayTeam);
    if (result === "home_win") homeWins += 1;
    else if (result === "away_win") awayWins += 1;
    else if (result === "draw") draws += 1;
  }

  return {
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeProviderTeamId: input.homeProviderTeamId,
    awayProviderTeamId: input.awayProviderTeamId,
    totalMeetings: meetings.length,
    homeWins,
    awayWins,
    draws,
    meetings,
  };
}
