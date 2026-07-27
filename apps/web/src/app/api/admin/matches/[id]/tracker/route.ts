import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { fixtures, fixtureTrackerSettings } from "@rugby365/db";
import { getDb } from "@/lib/db";

/** CMS Match Tracker settings — activate public animation, delay kick-off, etc. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fixtureId } = await params;
  const db = getDb();
  const [fixture] = await db.select({ id: fixtures.id }).from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  const [row] = await db
    .select()
    .from(fixtureTrackerSettings)
    .where(eq(fixtureTrackerSettings.fixtureId, fixtureId))
    .limit(1);

  return NextResponse.json({
    settings: row ?? {
      fixtureId,
      trackerActivated: false,
      publicAnimationEnabled: false,
      publicReplayEnabled: false,
      mode: "manual",
      countdownHeld: false,
      countdownCancelled: false,
      kickOffDelayed: false,
      revisedKickoffAt: null,
      kickOffConfirmedAt: null,
      matchStartedAt: null,
      matchStartedBy: null,
      previewMode: false,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: fixtureId } = await params;
  const body = (await req.json()) as {
    trackerActivated?: boolean;
    publicAnimationEnabled?: boolean;
    publicReplayEnabled?: boolean;
    countdownHeld?: boolean;
    countdownCancelled?: boolean;
    kickOffDelayed?: boolean;
    revisedKickoffAt?: string | null;
    confirmKickOff?: boolean;
    startMatch?: boolean;
    confirmFullTime?: boolean;
    previewMode?: boolean;
    mode?: string;
  };

  const db = getDb();
  const [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  const now = new Date();
  const [existing] = await db
    .select()
    .from(fixtureTrackerSettings)
    .where(eq(fixtureTrackerSettings.fixtureId, fixtureId))
    .limit(1);

  const next = {
    fixtureId,
    trackerActivated: body.trackerActivated ?? existing?.trackerActivated ?? false,
    publicAnimationEnabled: body.publicAnimationEnabled ?? existing?.publicAnimationEnabled ?? false,
    publicReplayEnabled: body.publicReplayEnabled ?? existing?.publicReplayEnabled ?? false,
    mode: body.mode ?? existing?.mode ?? "manual",
    countdownHeld: body.countdownHeld ?? existing?.countdownHeld ?? false,
    countdownCancelled: body.countdownCancelled ?? existing?.countdownCancelled ?? false,
    kickOffDelayed: body.kickOffDelayed ?? existing?.kickOffDelayed ?? false,
    revisedKickoffAt:
      body.revisedKickoffAt === undefined
        ? existing?.revisedKickoffAt ?? null
        : body.revisedKickoffAt
          ? new Date(body.revisedKickoffAt)
          : null,
    kickOffConfirmedAt: existing?.kickOffConfirmedAt ?? null,
    matchStartedAt: existing?.matchStartedAt ?? null,
    matchStartedBy: existing?.matchStartedBy ?? null,
    fullTimeConfirmedAt: existing?.fullTimeConfirmedAt ?? null,
    fullTimeConfirmedBy: existing?.fullTimeConfirmedBy ?? null,
    previewMode: body.previewMode ?? existing?.previewMode ?? false,
    updatedAt: now,
  };

  if (body.confirmKickOff) {
    next.kickOffConfirmedAt = now;
  }
  if (body.startMatch) {
    next.matchStartedAt = now;
    next.matchStartedBy = "cms";
    next.kickOffConfirmedAt = next.kickOffConfirmedAt ?? now;
    next.publicAnimationEnabled = true;
    next.trackerActivated = true;
    await db
      .update(fixtures)
      .set({ status: "live", period: "first_half", homeScore: 0, awayScore: 0 })
      .where(eq(fixtures.id, fixtureId));
  }
  if (body.confirmFullTime) {
    next.fullTimeConfirmedAt = now;
    next.fullTimeConfirmedBy = "cms";
    next.publicReplayEnabled = true;
    await db
      .update(fixtures)
      .set({ status: "finished", period: "full_time" })
      .where(eq(fixtures.id, fixtureId));
  }

  if (body.kickOffDelayed && body.revisedKickoffAt) {
    await db
      .update(fixtures)
      .set({ kickoffAt: new Date(body.revisedKickoffAt) })
      .where(eq(fixtures.id, fixtureId));
  }

  if (existing) {
    const [row] = await db
      .update(fixtureTrackerSettings)
      .set(next)
      .where(eq(fixtureTrackerSettings.fixtureId, fixtureId))
      .returning();
    return NextResponse.json({ settings: row });
  }

  const [row] = await db.insert(fixtureTrackerSettings).values(next).returning();
  return NextResponse.json({ settings: row });
}
