import { NextResponse } from "next/server";
import {
  clearRugbyDataApiCredentials,
  getRugbyDataApiPublicConfig,
  resolveRugbyDataApiBaseUrl,
  resolveRugbyDataApiToken,
  saveRugbyDataApiCredentials,
} from "@/lib/integration-settings-service";
import { apiErrorResponse } from "@/lib/api-errors";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
      const baseUrl = await resolveRugbyDataApiBaseUrl();
      const token = await resolveRugbyDataApiToken();
      const url = `${baseUrl}/api/v1/rugby-union/teams`;
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": BROWSER_UA,
      };
      if (token) {
        headers.token = token;
      }

      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        const error = await res.text();
        return NextResponse.json(
          {
            ok: false,
            message: `Rugby Data API test failed (${res.status}): ${error.slice(0, 280)}`,
          },
          { status: 400 },
        );
      }

      const payload = (await res.json()) as unknown;
      const count = Array.isArray(payload)
        ? payload.length
        : Array.isArray((payload as { data?: unknown })?.data)
          ? ((payload as { data: unknown[] }).data.length)
          : undefined;

      return NextResponse.json({
        ok: true,
        message:
          count !== undefined
            ? `Connected — teams endpoint returned ${count} records.`
            : "Connected — teams endpoint responded OK.",
      });
    }

    const apiToken = typeof body.apiToken === "string" ? body.apiToken : undefined;
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : undefined;
    const config = await saveRugbyDataApiCredentials({ apiToken, baseUrl });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Rugby Data API settings");
  }
}
