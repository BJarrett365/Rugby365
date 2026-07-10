import { NextResponse } from "next/server";
import { approveSandboxEvent } from "@/lib/agent-sandbox-service";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      eventId: string;
      status: "approved" | "rejected";
      note?: string;
    };
    if (!body.eventId || !body.status) {
      return NextResponse.json({ error: "eventId and status required" }, { status: 400 });
    }
    const row = await approveSandboxEvent(body.eventId, body.status, body.note);
    return NextResponse.json({ event: row });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Approval failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
