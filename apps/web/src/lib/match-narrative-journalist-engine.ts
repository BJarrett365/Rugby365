/**
 * Compatibility shim — Commentary Intelligence Engine is the source of truth.
 * Prefer importing from `match-narrative-intelligence-engine`.
 */

export {
  buildIntelligenceInPlayCommentary,
  buildJournalistInPlayCommentary,
  shouldPublishRawStatUpdate,
  type CommentaryLayer,
  type CommentaryPriority,
} from "./match-narrative-intelligence-engine";

/** Legacy voice names mapped onto intelligence-engine segments. */
export type CommentaryVoice =
  | "play_by_play"
  | "journalist_insight"
  | "tactical_analysis"
  | "momentum"
  | "player_spotlight"
  | "coach_watch"
  | "statistical_insight"
  | "match_story";
