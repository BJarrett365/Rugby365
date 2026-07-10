import type { CommentaryFact } from "@rugby365/shared";

const ZONE_LABELS: Record<string, string> = {
  opposition_22: "22",
  own_22: "own 22",
  midfield: "midfield",
};

export function renderTemplate(body: string, facts: CommentaryFact): string {
  const vars: Record<string, string> = {
    minute: String(facts.minute),
    team: facts.team,
    opponent: facts.opponent,
    phase_count: String(facts.phase_count ?? ""),
    zone_label: ZONE_LABELS[facts.zone ?? ""] ?? facts.zone ?? "",
    home_team: facts.home_team ?? "",
    away_team: facts.away_team ?? "",
    home_score: String(facts.home_score ?? ""),
    away_score: String(facts.away_score ?? ""),
    infringement: facts.infringement ?? "infringement",
    player: facts.player ?? "",
    player_jersey: facts.player_jersey !== undefined ? String(facts.player_jersey) : "",
    player_position: facts.player_position ?? "",
    player_club: facts.player_club ?? "",
    player_role: facts.player_role ?? "",
    venue: facts.venue ?? "",
    referee: facts.referee ?? "",
  };
  return body.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}
