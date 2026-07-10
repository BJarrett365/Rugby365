import { NextResponse } from "next/server";
import {
  clearWikimediaEnterpriseCredentials,
  getWikimediaEnterprisePublicConfig,
  saveWikimediaEnterpriseCredentials,
} from "@/lib/integration-settings-service";
import { testWikimediaEnterpriseConnection } from "@/lib/wikimedia-enterprise-client";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const config = await getWikimediaEnterprisePublicConfig();
    return NextResponse.json({
      ...config,
      docsUrl: "https://enterprise.wikimedia.com/docs/authentication/#login",
      readOnly: true,
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Wikimedia settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      await clearWikimediaEnterpriseCredentials();
      return NextResponse.json({ ok: true, cleared: true });
    }

    if (body.action === "test") {
      const result = await testWikimediaEnterpriseConnection();
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : undefined;
    const config = await saveWikimediaEnterpriseCredentials({ username, password });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Wikimedia settings");
  }
}
