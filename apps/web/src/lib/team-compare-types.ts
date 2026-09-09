import type { TeamCompareMetric } from "./team-compare-metrics";
import type {
  TeamDepthSummary,
  TeamPositionBattle,
  TeamXvSlot,
} from "./team-compare-intelligence";
import type { TeamCompareSidePacket, TeamXvSource } from "./team-squad-intelligence-types";

export type TeamH2HMeeting = {
  id: string;
  date: string | null;
  competitionName: string | null;
  venueName: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  fixtureSlug: string | null;
  matchHref: string | null;
  /** Which side of the compare won: a | b | draw */
  winner: "a" | "b" | "draw";
};

export type TeamH2HWinPoint = {
  year: number;
  cumulativeWinsA: number;
  cumulativeWinsB: number;
};

export type TeamH2HHighlight = {
  score: string;
  margin: number;
  date: string | null;
  competitionName: string | null;
  venueName: string | null;
  winnerName: string;
};

export type TeamH2HNextMeeting = {
  date: string | null;
  competitionName: string | null;
  venueName: string | null;
  homeTeam: string;
  awayTeam: string;
  fixtureSlug: string | null;
  kickoffLabel: string | null;
};

export type TeamH2HTopPerformer = {
  playerId: string | null;
  playerSlug: string | null;
  name: string;
  label: string;
  value: number;
  imageUrl: string | null;
};

export type TeamHeadToHeadSummary = {
  totalMeetings: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  pointsForA: number;
  pointsForB: number;
  avgPointsForA: number | null;
  avgPointsForB: number | null;
  lastMeeting: TeamH2HMeeting | null;
  recentMeetings: TeamH2HMeeting[];
  biggestWinForA: TeamH2HHighlight | null;
  biggestWinForB: TeamH2HHighlight | null;
  highestScoring: TeamH2HHighlight | null;
  winsOverTime: TeamH2HWinPoint[];
  nextMeeting: TeamH2HNextMeeting | null;
  topPerformersA: TeamH2HTopPerformer[];
  topPerformersB: TeamH2HTopPerformer[];
};

export type TeamXvSummary = {
  valueGbp: number | null;
  valueLabel: string | null;
  averageRating: number | null;
  averageAge: number | null;
  filled: number;
  source: TeamXvSource;
};

export type TeamComparePayload = {
  teamA: TeamCompareSidePacket;
  teamB: TeamCompareSidePacket;
  metrics: TeamCompareMetric[];
  headToHead: TeamHeadToHeadSummary;
  startingXvA: TeamXvSlot[];
  startingXvB: TeamXvSlot[];
  xvSummaryA: TeamXvSummary;
  xvSummaryB: TeamXvSummary;
  positionBattles: TeamPositionBattle[];
  depthA: TeamDepthSummary;
  depthB: TeamDepthSummary;
  positionScore: { a: number; b: number; draws: number };
};
