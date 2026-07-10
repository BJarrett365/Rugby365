import { z } from "zod";

export const AgentModeSchema = z.enum(["observer", "assisted", "auto"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const AgentSourceSchema = z.enum(["sport365", "sdms", "planet_rugby", "manual", "approved_feed"]);
export type AgentSource = z.infer<typeof AgentSourceSchema>;

export const AgentEventOutputSchema = z.object({
  match_id: z.string(),
  minute: z.number().int().min(0).max(120),
  event_type: z.string(),
  team: z.string(),
  opponent: z.string(),
  source: AgentSourceSchema,
  confidence: z.number().min(0).max(1),
  requires_approval: z.boolean(),
  facts: z.record(z.unknown()),
  commentary_suggestions: z.array(z.string()),
  flags: z.array(z.string()).optional(),
  provider_event_id: z.string().optional(),
});

export type AgentEventOutput = z.infer<typeof AgentEventOutputSchema>;

export type MatchSnapshot = {
  matchId: string;
  sourceUrl: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamProviderId?: string;
  awayTeamProviderId?: string;
  homeScore: number;
  awayScore: number;
  statusCode?: number;
  statusText?: string;
  statusLabel: string;
  competition?: string;
  competitionProviderId?: string;
  stageProviderId?: string;
  stageName?: string;
  kickoffAt?: string;
  venue?: { name?: string; city?: string; capacity?: number };
  elapsedSeconds?: number;
  lineups?: import("./sport365-lineups").Sport365Lineups;
  headToHead?: import("./sport365-h2h").Sport365HeadToHead;
  incidents: ProviderIncident[];
  polledAt: string;
};

export type ProviderIncident = {
  id: string;
  minute: number;
  minutePlus?: number;
  type: number;
  teamPos: number;
  teamName: string;
  playerName?: string;
  playerProviderId?: string;
  playerNameOut?: string;
  playerProviderIdOut?: string;
  scoreAfter: [number, number];
};

export type DetectedChange =
  | { kind: "score_update"; snapshot: MatchSnapshot; previous?: MatchSnapshot }
  | { kind: "incident"; incident: ProviderIncident; snapshot: MatchSnapshot }
  | { kind: "status_change"; snapshot: MatchSnapshot; previous?: MatchSnapshot };
