import { NextResponse } from "next/server";
import { pollSandboxRun } from "@/lib/agent-sandbox-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cycle = await pollSandboxRun(id);
    return NextResponse.json({
      eventsDetected: cycle.events.length,
      flags: cycle.flags,
      snapshot: {
        homeScore: cycle.snapshot.homeScore,
        awayScore: cycle.snapshot.awayScore,
        status: cycle.snapshot.statusLabel,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
