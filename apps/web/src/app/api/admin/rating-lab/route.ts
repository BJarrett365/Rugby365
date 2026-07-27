import { NextResponse } from "next/server";
import {
  calculateAndPersistFixtureMatchRatings,
  listMatchRatingsForFixture,
  listRatingLabRows,
} from "@/lib/match-rating-service";
import {
  calculateAndPersistFixtureStaffMatchRatings,
  listStaffMatchRatingsForFixture,
  listStaffRatingLabRows,
} from "@/lib/staff-match-rating-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fixtureId = searchParams.get("fixtureId");
  const entity = (searchParams.get("entity") ?? "players").toLowerCase();

  if (fixtureId) {
    if (entity === "staff" || entity === "coaches" || entity === "referees") {
      const staff = await listStaffMatchRatingsForFixture(fixtureId);
      return NextResponse.json(staff);
    }
    const bundle = await listMatchRatingsForFixture(fixtureId);
    return NextResponse.json(bundle);
  }

  const limit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
  const safeLimit = Number.isFinite(limit) ? limit : 100;

  if (entity === "coaches" || entity === "referees" || entity === "staff") {
    const rows = await listStaffRatingLabRows(safeLimit);
    const filtered =
      entity === "staff"
        ? rows
        : rows.filter((r) => (entity === "coaches" ? r.entityType === "coach" : r.entityType === "referee"));
    return NextResponse.json({ rows: filtered, entity });
  }

  const rows = await listRatingLabRows(safeLimit);
  return NextResponse.json({ rows, entity: "players" });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    fixtureId?: string;
    entity?: string;
  };
  if (!body.fixtureId) {
    return NextResponse.json({ error: "fixtureId required" }, { status: 400 });
  }

  const entity = (body.entity ?? "all").toLowerCase();
  let calculated = 0;
  let potmPlayerId: string | null = null;
  let coachesCalculated = 0;
  let refereeCalculated = 0;

  if (entity === "all" || entity === "players") {
    const playerResult = await calculateAndPersistFixtureMatchRatings(body.fixtureId);
    calculated = playerResult.calculated;
    potmPlayerId = playerResult.potmPlayerId;
    coachesCalculated = playerResult.coachesCalculated ?? 0;
    refereeCalculated = playerResult.refereeCalculated ?? 0;
  } else if (entity === "staff" || entity === "coaches" || entity === "referees") {
    const staffResult = await calculateAndPersistFixtureStaffMatchRatings(body.fixtureId);
    coachesCalculated = staffResult.coachesCalculated;
    refereeCalculated = staffResult.refereeCalculated;
  }

  const playerBundle = await listMatchRatingsForFixture(body.fixtureId);
  const staffBundle = await listStaffMatchRatingsForFixture(body.fixtureId);

  return NextResponse.json({
    calculated,
    potmPlayerId,
    coachesCalculated,
    refereeCalculated,
    bundle: playerBundle,
    staffBundle,
  });
}
