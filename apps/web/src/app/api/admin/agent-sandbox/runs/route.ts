import { NextResponse } from "next/server";
import { createSandboxRun, DEFAULT_TEST_MATCH_URL, listSandboxRuns } from "@/lib/agent-sandbox-service";

export async function GET() {
  const runs = await listSandboxRuns();
  return NextResponse.json({ runs });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { sourceUrl?: string; mode?: "observer" | "assisted" | "auto" };
    const sourceUrl = body.sourceUrl ?? DEFAULT_TEST_MATCH_URL;
    const mode = body.mode ?? "assisted";
    const { run, cycle } = await createSandboxRun(sourceUrl, mode);
    return NextResponse.json({
      run,
      eventsDetected: cycle.events.length,
      flags: cycle.flags,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start sandbox run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
