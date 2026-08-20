import { NextResponse } from "next/server";
import {
  listEntityAchievements,
  listAwardDefinitions,
  seedAwardDefinitions,
  syncCoachLegacyAchievements,
} from "@/lib/achievement-service";
import { apiErrorResponse } from "@/lib/api-errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [rows, definitions] = await Promise.all([
      listEntityAchievements("coach", id),
      listAwardDefinitions(),
    ]);
    return NextResponse.json({
      achievements: rows.map((r) => ({
        ...r.achievement,
        award: r.award,
      })),
      awardDefinitions: definitions,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load achievements");
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action === "seed_definitions") {
      const count = await seedAwardDefinitions();
      return NextResponse.json({ ok: true, seeded: count });
    }
    if (body.action === "sync_legacy") {
      const result = await syncCoachLegacyAchievements(id);
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json(
      { error: "action must be seed_definitions or sync_legacy" },
      { status: 400 },
    );
  } catch (e) {
    return apiErrorResponse(e, "Failed to sync achievements");
  }
}
