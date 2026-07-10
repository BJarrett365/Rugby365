export type MatchEventInput = {
  eventType: string;
  minute: number;
  second?: number;
  teamId?: string;
  payload?: Record<string, unknown>;
};

export type CommentaryLine = {
  id: string;
  minute: number;
  second: number;
  body: string;
  outputType: string;
  publishedAt: string;
};
