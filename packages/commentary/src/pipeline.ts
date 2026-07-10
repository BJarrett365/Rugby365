import type { CommentaryFact } from "@rugby365/shared";
import { CommentaryFactSchema } from "@rugby365/shared";
import { buildFactsFromEvent, type MatchContext } from "./context-engine";
import { findMatchingRules, type CommentaryRuleRow } from "./rules-evaluator";
import { renderTemplate } from "./template-renderer";

export type TemplateRow = {
  templateKey: string;
  body: string;
  outputType: string;
};

export type PipelineResult = {
  facts: CommentaryFact;
  outputType: string;
  renderedOptions: string[];
  templateKeys: string[];
};

export function runCommentaryPipeline(
  event: {
    eventType: string;
    minute: number;
    second?: number;
    payload?: Record<string, unknown>;
    teamName?: string;
    opponentName?: string;
  },
  ctx: MatchContext,
  rules: CommentaryRuleRow[],
  templates: TemplateRow[],
): PipelineResult | null {
  const matched = findMatchingRules(rules, {
    eventType: event.eventType,
    payload: event.payload,
  });
  if (!matched.length) return null;

  const rule = matched[0];
  const facts = CommentaryFactSchema.parse(buildFactsFromEvent(event, ctx));
  const templateMap = new Map(templates.map((t) => [t.templateKey, t]));
  const keys = (rule.templateKeys as string[]).slice(0, rule.maxSuggestions);
  const renderedOptions: string[] = [];
  for (const key of keys) {
    const tpl = templateMap.get(key);
    if (tpl) renderedOptions.push(renderTemplate(tpl.body, facts));
  }
  if (!renderedOptions.length) return null;

  return {
    facts,
    outputType: rule.outputType,
    renderedOptions,
    templateKeys: keys,
  };
}
