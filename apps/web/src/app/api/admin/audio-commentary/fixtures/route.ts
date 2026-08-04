import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { listAudioFixturesForPicker } from "@/lib/audio-voice-settings-service";

/** Admin-only searchable fixtures for Audio Commentary match picker. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const limit = Number(url.searchParams.get("limit") || 40);
    const fixtures = await listAudioFixturesForPicker({ q, limit });
    return NextResponse.json({ ok: true, fixtures });
  } catch (e) {
    return apiErrorResponse(e, "Failed to list fixtures for audio commentary");
  }
}
