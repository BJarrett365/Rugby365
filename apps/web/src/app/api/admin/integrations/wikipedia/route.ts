import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import {
  clearWikipediaSettings,
  getWikipediaPublicConfig,
  revealWikipediaAccessTokenFromCms,
  saveWikipediaSettings,
  testWikipediaConnection,
  WIKIMEDIA_USER_AGENT_POLICY_URL,
} from "@/lib/integration-settings-service";

export async function GET() {
  try {
    const config = await getWikipediaPublicConfig();
    return NextResponse.json({
      ...config,
      requiresApiKey: false,
      envUserAgentOverride: Boolean(process.env.WIKIPEDIA_USER_AGENT?.trim()),
      envApiBaseUrlOverride: Boolean(process.env.WIKIPEDIA_API_BASE_URL?.trim()),
      envAccessTokenOverride: Boolean(process.env.WIKIPEDIA_ACCESS_TOKEN?.trim()),
      note:
        "Wikipedia’s MediaWiki Action API does not require a paid API key. Wikimedia requires a descriptive User-Agent identifying your app and contact.",
      userAgentPolicyUrl: WIKIMEDIA_USER_AGENT_POLICY_URL,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Wikipedia settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      const config = await clearWikipediaSettings({
        clearAccessToken: body.clearAccessToken !== false,
        resetToDefaults: Boolean(body.resetToDefaults),
      });
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "reveal") {
      const revealed = await revealWikipediaAccessTokenFromCms();
      if (revealed.status === "ok") {
        return NextResponse.json({ ok: true, secret: revealed.secret });
      }
      return NextResponse.json(
        {
          ok: false,
          envOnly: revealed.status === "env_only",
          message: revealed.message,
        },
        { status: revealed.status === "env_only" ? 403 : 404 },
      );
    }

    if (body.action === "test") {
      const result = await testWikipediaConnection({
        userAgent: typeof body.userAgent === "string" ? body.userAgent : undefined,
        apiBaseUrl: typeof body.apiBaseUrl === "string" ? body.apiBaseUrl : undefined,
        accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, ...result });
    }

    const config = await saveWikipediaSettings({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      userAgent: typeof body.userAgent === "string" ? body.userAgent : undefined,
      apiBaseUrl: typeof body.apiBaseUrl === "string" ? body.apiBaseUrl : undefined,
      accessToken: typeof body.accessToken === "string" ? body.accessToken : undefined,
      clearAccessToken: Boolean(body.clearAccessToken),
    });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Wikipedia settings");
  }
}
