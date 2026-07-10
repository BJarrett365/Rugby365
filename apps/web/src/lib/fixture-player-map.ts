import { eq, asc } from "drizzle-orm";
import { matchEvents } from "@rugby365/db";
import {
  enrichEventPayloadsFromMatchEvents,
  teamPosForTeamId,
  type Sport365Lineups,
} from "@rugby365/match-operator-agent";
import { getDb } from "./db";

export { teamPosForTeamId };

export async function enrichFixtureEventPlayers(
  fixtureId: string,
  input: {
    homeTeamId?: string | null;
    awayTeamId?: string | null;
    lineups?: Sport365Lineups;
  },
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(asc(matchEvents.sequenceNo));

  if (!rows.length) return 0;

  const sources = rows.map((row) => ({
    id: row.id,
    teamPos: teamPosForTeamId(row.teamId, input.homeTeamId, input.awayTeamId),
    payload: (row.payload ?? {}) as Record<string, unknown>,
  }));

  const updates = enrichEventPayloadsFromMatchEvents(sources, input.lineups);
  let changed = 0;

  for (const row of rows) {
    const nextPayload = updates.get(row.id);
    if (!nextPayload) continue;
    const prev = JSON.stringify(row.payload ?? {});
    const next = JSON.stringify(nextPayload);
    if (prev === next) continue;
    await db.update(matchEvents).set({ payload: nextPayload }).where(eq(matchEvents.id, row.id));
    changed += 1;
  }

  return changed;
}
