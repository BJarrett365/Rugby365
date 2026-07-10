import { matchCommentary } from "@rugby365/db";
import { getDb } from "./db";

export async function publishManualCommentary(
  fixtureId: string,
  input: {
    minute: number;
    second?: number;
    body: string;
    outputType: string;
    facts?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [line] = await db
    .insert(matchCommentary)
    .values({
      fixtureId,
      minute: input.minute,
      second: input.second ?? 0,
      outputType: input.outputType,
      body: input.body.trim(),
      facts: input.facts ?? {},
      source: "operator_edit",
    })
    .returning();
  return line;
}
