import { NextResponse } from "next/server";
import { buildSandboxReport } from "@/lib/agent-sandbox-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const report = await buildSandboxReport(id);
    return NextResponse.json(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Report failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
