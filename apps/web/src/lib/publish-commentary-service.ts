import { and, eq } from "drizzle-orm";
import { commentarySuggestions, matchCommentary } from "@rugby365/db";
import { getDb } from "./db";

function finalizePublishedBody(body: string, facts: Record<string, unknown>): string {
  return body
    .replace(/\{player_jersey\}/g, facts.player_jersey !== undefined ? String(facts.player_jersey) : "")
    .replace(/\{player_role\}/g, typeof facts.player_role === "string" ? facts.player_role : "")
    .replace(/\{player_position\}/g, typeof facts.player_position === "string" ? facts.player_position : "")
    .replace(/\{player_club\}/g, typeof facts.player_club === "string" ? facts.player_club : "")
    .replace(/\{venue\}/g, typeof facts.venue === "string" ? facts.venue : "")
    .replace(/\{referee\}/g, typeof facts.referee === "string" ? facts.referee : "")
    .replace(/\{player\}/g, typeof facts.player === "string" && facts.player ? facts.player : "the scorer")
    .replace(/\{team\}/g, typeof facts.team === "string" ? facts.team : "")
    .replace(/\{opponent\}/g, typeof facts.opponent === "string" ? facts.opponent : "")
    .replace(/\{minute\}/g, facts.minute !== undefined ? String(facts.minute) : "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function approveCommentarySuggestion(
  suggestionId: string,
  selectedIndex = 0,
  editedBody?: string,
) {
  const db = getDb();
  const [suggestion] = await db
    .select()
    .from(commentarySuggestions)
    .where(eq(commentarySuggestions.id, suggestionId))
    .limit(1);

  if (!suggestion) return null;

  const options = suggestion.renderedOptions as string[];
  const rawBody = editedBody ?? options[selectedIndex];
  if (!rawBody) return null;

  const facts = (suggestion.facts ?? {}) as Record<string, unknown> & {
    minute?: number;
    second?: number;
    output_type?: string;
    source?: string;
  };

  const bodyText = finalizePublishedBody(rawBody, facts);

  const [existing] = await db
    .select({ id: matchCommentary.id })
    .from(matchCommentary)
    .where(eq(matchCommentary.suggestionId, suggestion.id))
    .limit(1);
  if (existing) return existing;

  const [line] = await db
    .insert(matchCommentary)
    .values({
      fixtureId: suggestion.fixtureId,
      minute: facts.minute ?? 0,
      second: facts.second ?? 0,
      outputType: facts.output_type ?? "phase_play_update",
      body: bodyText,
      facts: suggestion.facts,
      suggestionId: suggestion.id,
      source: editedBody ? "operator_edit" : facts.source === "openai" ? "openai" : "template",
    })
    .returning();

  await db
    .update(commentarySuggestions)
    .set({ status: "approved", selectedIndex })
    .where(eq(commentarySuggestions.id, suggestion.id));

  return line;
}

export async function publishPendingCommentaryForFixture(fixtureId: string): Promise<number> {
  const db = getDb();
  const pending = await db
    .select()
    .from(commentarySuggestions)
    .where(
      and(eq(commentarySuggestions.fixtureId, fixtureId), eq(commentarySuggestions.status, "pending")),
    );

  let published = 0;
  for (const suggestion of pending) {
    const line = await approveCommentarySuggestion(suggestion.id, 0);
    if (line) published += 1;
  }
  return published;
}
