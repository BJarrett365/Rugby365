export type RuleConditions = {
  event_type?: string;
  zone?: string;
  phase_gte?: number;
};

export type CommentaryRuleRow = {
  id: string;
  name: string;
  conditions: RuleConditions;
  templateKeys: string[];
  maxSuggestions: number;
  outputType: string;
};

export type EventForRules = {
  eventType: string;
  payload?: Record<string, unknown>;
};

export function ruleMatches(rule: CommentaryRuleRow, event: EventForRules): boolean {
  const c = rule.conditions;
  if (c.event_type && c.event_type !== event.eventType) return false;
  if (c.zone && event.payload?.zone !== c.zone) return false;
  const phase = Number(event.payload?.phase ?? 0);
  if (c.phase_gte != null && phase < c.phase_gte) return false;
  return true;
}

export function findMatchingRules(rules: CommentaryRuleRow[], event: EventForRules): CommentaryRuleRow[] {
  return rules.filter((r) => ruleMatches(r, event));
}
