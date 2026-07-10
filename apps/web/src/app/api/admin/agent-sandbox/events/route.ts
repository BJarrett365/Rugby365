import { NextResponse } from "next/server";
import { listSandboxEvents } from "@/lib/agent-sandbox-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId required" }, { status: 400 });
  }
  const events = await listSandboxEvents(runId);
  return NextResponse.json({ events });
}
