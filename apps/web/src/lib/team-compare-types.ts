import type { TeamCompareMetric } from "./team-compare-metrics";
import type {
  TeamDepthSummary,
  TeamPositionBattle,
  TeamXvSlot,
} from "./team-compare-intelligence";
import type { TeamCompareSidePacket } from "./team-squad-intelligence-types";

export type TeamHeadToHeadSummary = {
  totalMeetings: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  lastMeeting: {
    date: string | null;
    competitionName: string | null;
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    fixtureSlug: string | null;
  } | null;
  biggestWinForA: { score: string; date: string | null } | null;
  biggestWinForB: { score: string; date: string | null } | null;
};

export type TeamXvSummary = {
  valueGbp: number;
  valueLabel: string;
  averageRating: number | null;
  averageAge: number | null;
  filled: number;
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
