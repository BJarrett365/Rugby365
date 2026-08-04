import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  clearTvScheduleCredentials,
  getTvSchedulePublicConfig,
  saveTvScheduleCredentials,
  testTvScheduleConnection,
  type TvScheduleProvider,
} from "@/lib/integration-settings-service";
import {
  previewRugbyKickoffUkTvSchedule,
  syncRugbyKickoffUkTvSchedule,
} from "@/lib/rugbykickoff-tv-import-service";

export async function GET() {
  try {
    const config = await getTvSchedulePublicConfig();
    return NextResponse.json({
      ...config,
      docs: {
        gracenote: "https://developer.tmsapi.com/docs/data_v1_1/sports/Sports_events_airings",
        paMedia: "https://pa.media/pa-tv-metadata/epg-widget/",
        rugbyKickoff: "https://www.rugbykickoff.com/",
      },
      envOverride: {
        gracenote: Boolean(process.env.GRACENOTE_API_KEY?.trim()),
        paMedia: Boolean(process.env.PA_MEDIA_TV_API_KEY?.trim()),
      },
      note:
        "UK international TV listings sync from Rugby Kick Off (no API key). Gracenote / PA Media keys are optional for broader EPG later. Manual CMS broadcasters still work.",
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

    if (body.action === "preview_rugbykickoff" || body.action === "sync_rugbykickoff") {
      const internationalOnly = body.internationalOnly !== false;
      const result =
        body.action === "preview_rugbykickoff"
          ? await previewRugbyKickoffUkTvSchedule({ internationalOnly })
          : await syncRugbyKickoffUkTvSchedule({ internationalOnly });
      return NextResponse.json({
        ...result,
        message:
          body.action === "preview_rugbykickoff"
            ? `Preview: ${result.listingsParsed} listings → ${result.fixturesUpdated} existing fixtures (${result.unmatched} skipped, no new fixtures).`
            : `Assigned UK TV onto ${result.fixturesUpdated} existing fixtures (${result.broadcastersUpserted} channels). ${result.unmatched} listings skipped — no matching fixture.`,
      });
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
