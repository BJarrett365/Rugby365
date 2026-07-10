import { z } from "zod";

export const CommentaryFactSchema = z.object({
  team: z.string(),
  opponent: z.string(),
  minute: z.number().int().min(0).max(120),
  second: z.number().int().min(0).max(59).optional(),
  phase_count: z.number().int().min(0).optional(),
  zone: z.string().optional(),
  event_type: z.string(),
  home_team: z.string().optional(),
  away_team: z.string().optional(),
  home_score: z.number().int().optional(),
  away_score: z.number().int().optional(),
  infringement: z.string().optional(),
  possession_retained: z.boolean().optional(),
  player: z.string().optional(),
  player_jersey: z.number().int().optional(),
  player_position: z.string().optional(),
  player_club: z.string().optional(),
  player_role: z.string().optional(),
  venue: z.string().optional(),
  referee: z.string().optional(),
});

export type CommentaryFact = z.infer<typeof CommentaryFactSchema>;
