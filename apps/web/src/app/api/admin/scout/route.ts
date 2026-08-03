import { NextResponse } from "next/server";
import { listTopRecruitmentTargets } from "@/lib/player-scout-intelligence-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 40) || 40));
  try {
    const targets = await listTopRecruitmentTargets(limit);
    return NextResponse.json({ targets });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list recruitment targets" },
      { status: 500 },
    );
  }
}
