import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { fixtures, matchEvents } from "@rugby365/db";
import { getDb } from "@/lib/db";
import { processEventForCommentary } from "@/lib/commentary-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fixtureId } = await params;
  const body = (await req.json()) as {
    eventType: string;
    minute: number;
    second?: number;
    teamId?: string;
    payload?: Record<string, unknown>;
  };

  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  const [last] = await db
    .select()
    .from(matchEvents)
    .where(eq(matchEvents.fixtureId, fixtureId))
    .orderBy(desc(matchEvents.sequenceNo))
    .limit(1);
  const sequenceNo = (last?.sequenceNo ?? 0) + 1;

  const [event] = await db
    .insert(matchEvents)
    .values({
      fixtureId,
      eventType: body.eventType,
      minute: body.minute,
      second: body.second ?? 0,
      teamId: body.teamId ?? fixture.homeTeamId,
      payload: body.payload ?? {},
      sequenceNo,
    })
    .returning();

  await db
    .update(fixtures)
    .set({ matchMinute: body.minute, matchSecond: body.second ?? 0, status: "live" })
    .where(eq(fixtures.id, fixtureId));

  const suggestion = await processEventForCommentary(event.id);

  try {
    const { refreshActivatedNarrativeCommentary } = await import(
      "@/lib/match-narrative-live-refresh"
    );
    await refreshActivatedNarrativeCommentary(fixtureId, {
      force: true,
      syncProvider: false,
    });
  } catch (error) {
    console.warn(
      `[events] narrative refresh failed for ${fixtureId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({ event, suggestion });
}
