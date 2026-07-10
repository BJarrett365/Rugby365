import { NextResponse } from "next/server";
import { enqueueSquadAuditJob, getSquadAuditJob } from "@/lib/premiership-squad-audit-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const teamId = String(body.teamId ?? "");
    const jobType = String(body.jobType ?? "preview") as "preview" | "dry_run" | "import";
    if (!teamId) return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    if (!["preview", "dry_run", "import"].includes(jobType)) {
      return NextResponse.json({ error: "Invalid jobType" }, { status: 400 });
    }

    const job = await enqueueSquadAuditJob({
      teamId,
      jobType,
      userLabel: body.userLabel ? String(body.userLabel) : "admin",
    });
    return NextResponse.json({ job }, { status: 202 });
  } catch (e) {
    return apiErrorResponse(e, "Failed to enqueue squad audit job");
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    const job = await getSquadAuditJob(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    return NextResponse.json({ job });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load squad audit job");
  }
}
