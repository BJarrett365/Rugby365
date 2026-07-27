import { NextResponse } from "next/server";
import {
  clearRugbyDataApiCredentials,
  getRugbyDataApiPublicConfig,
  saveRugbyDataApiCredentials,
} from "@/lib/integration-settings-service";
import { testRugbyDataApiConnection } from "@/lib/rugby-data-api-client";
import { syncRugbyDataFixturesForDate } from "@/lib/rugby-data-day-sync-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const config = await getRugbyDataApiPublicConfig();
    return NextResponse.json({
      ...config,
      docsUrl: "/docs/rugby-data-api",
      envTokenOverride: Boolean(process.env.RUGBY_DATA_API_TOKEN?.trim()),
      envBaseUrlOverride: Boolean(process.env.RUGBY_DATA_API_BASE_URL?.trim()),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Rugby Data API settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      await clearRugbyDataApiCredentials();
      const config = await getRugbyDataApiPublicConfig();
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "test") {
      const result = await testRugbyDataApiConnection();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, message: result.message },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        message: `${result.message} (${result.responseTimeMs}ms)`,
      });
    }

    if (body.action === "sync-day") {
      const dateKey =
        typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : new Date().toISOString().slice(0, 10);
      const result = await syncRugbyDataFixturesForDate(dateKey, {
        syncEvents: body.syncEvents !== false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const apiToken = typeof body.apiToken === "string" ? body.apiToken : undefined;
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : undefined;
    const config = await saveRugbyDataApiCredentials({ apiToken, baseUrl });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Rugby Data API settings");
  }
}
