import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  STATS_PERFORM_DOCS_INDEX_URL,
  STATS_PERFORM_SWAGGER_URL,
} from "@/lib/stats-perform-sdapi-client";
import {
  clearStatsPerformSdapiCredentials,
  getStatsPerformSdapiPublicConfig,
  saveStatsPerformSdapiCredentials,
  testResolvedStatsPerformDocsLogin,
  testResolvedStatsPerformSdapiConnection,
} from "@/lib/integration-settings-service";

export async function GET() {
  try {
    const config = await getStatsPerformSdapiPublicConfig();
    return NextResponse.json({
      ...config,
      docsUrl: STATS_PERFORM_DOCS_INDEX_URL,
      swaggerUrl: STATS_PERFORM_SWAGGER_URL,
      envOverride: {
        docsUsername: Boolean(process.env.STATS_PERFORM_DOCS_USERNAME?.trim()),
        docsPassword: Boolean(process.env.STATS_PERFORM_DOCS_PASSWORD?.trim()),
        outletAuthKey: Boolean(process.env.STATS_PERFORM_OUTLET_AUTH_KEY?.trim()),
        baseUrl: Boolean(process.env.STATS_PERFORM_SDAPI_BASE_URL?.trim()),
      },
      note:
        "Docs username/password unlock documentation.statsperform.com. Rugby feeds use the 26-character outletAuthKey from the sample URLs on those pages (saved here). Tournament calendar / standings may be unauthorised on that sample outlet; match, matchstats, matchevent and squads return data.",
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Stats Perform SDAPI settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      const config = await clearStatsPerformSdapiCredentials({
        clearDocs: body.clearDocs !== false,
        clearOutletKey: body.clearOutletKey !== false,
      });
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "test-docs") {
      const result = await testResolvedStatsPerformDocsLogin();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (body.action === "test-api" || body.action === "test") {
      const result = await testResolvedStatsPerformSdapiConnection();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const config = await saveStatsPerformSdapiCredentials({
      docsUsername: typeof body.docsUsername === "string" ? body.docsUsername : undefined,
      docsPassword: typeof body.docsPassword === "string" ? body.docsPassword : undefined,
      outletAuthKey: typeof body.outletAuthKey === "string" ? body.outletAuthKey : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : undefined,
    });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Stats Perform SDAPI settings");
  }
}
