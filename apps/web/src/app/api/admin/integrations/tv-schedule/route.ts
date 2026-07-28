import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  clearTvScheduleCredentials,
  getTvSchedulePublicConfig,
  saveTvScheduleCredentials,
  testTvScheduleConnection,
  type TvScheduleProvider,
} from "@/lib/integration-settings-service";

export async function GET() {
  try {
    const config = await getTvSchedulePublicConfig();
    return NextResponse.json({
      ...config,
      docs: {
        gracenote: "https://developer.tmsapi.com/docs/data_v1_1/sports/Sports_events_airings",
        paMedia: "https://pa.media/pa-tv-metadata/epg-widget/",
      },
      envOverride: {
        gracenote: Boolean(process.env.GRACENOTE_API_KEY?.trim()),
        paMedia: Boolean(process.env.PA_MEDIA_TV_API_KEY?.trim()),
      },
      note:
        "No rugby TV schedule is in Planet Rugby / SDMS feeds. Use CMS broadcasters now, or store Gracenote / PA Media keys here for automated sync later.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load TV schedule settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      const config = await clearTvScheduleCredentials({
        clearGracenote: body.clearGracenote !== false,
        clearPa: body.clearPa !== false,
      });
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "test") {
      const result = await testTvScheduleConnection();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const provider =
      typeof body.provider === "string" ? (body.provider as TvScheduleProvider) : undefined;
    const config = await saveTvScheduleCredentials({
      provider,
      gracenoteApiKey:
        typeof body.gracenoteApiKey === "string" ? body.gracenoteApiKey : undefined,
      gracenoteBaseUrl:
        typeof body.gracenoteBaseUrl === "string" ? body.gracenoteBaseUrl : undefined,
      gracenoteLineupId:
        typeof body.gracenoteLineupId === "string" ? body.gracenoteLineupId : undefined,
      paApiKey: typeof body.paApiKey === "string" ? body.paApiKey : undefined,
      defaultRegion: typeof body.defaultRegion === "string" ? body.defaultRegion : undefined,
    });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save TV schedule settings");
  }
}
