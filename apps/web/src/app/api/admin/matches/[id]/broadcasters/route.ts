import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  listFixtureBroadcasters,
  replaceFixtureBroadcasters,
  type FixtureBroadcasterInput,
} from "@/lib/fixture-broadcasters-service";
import { RUGBY_BROADCASTER_PRESETS } from "@/lib/rugby-broadcaster-presets";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const broadcasters = await listFixtureBroadcasters(id);
    return NextResponse.json({ broadcasters, presets: RUGBY_BROADCASTER_PRESETS });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load broadcasters");
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as { broadcasters?: FixtureBroadcasterInput[] };
    const broadcasters = await replaceFixtureBroadcasters(id, body.broadcasters ?? []);
    return NextResponse.json({ ok: true, broadcasters });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save broadcasters";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
