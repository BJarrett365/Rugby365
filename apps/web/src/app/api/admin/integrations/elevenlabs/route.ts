import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { testElevenLabsConnection } from "@/lib/elevenlabs-tts-service";
import {
  clearElevenLabsCredentials,
  getElevenLabsPublicConfig,
  revealElevenLabsApiKeyFromCms,
  saveElevenLabsCredentials,
} from "@/lib/integration-settings-service";

export async function GET() {
  try {
    const config = await getElevenLabsPublicConfig();
    return NextResponse.json({
      ...config,
      docsUrl: "https://elevenlabs.io/app/settings/api-keys",
      envOverride: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
      envModelOverride: Boolean(process.env.ELEVENLABS_MODEL_ID?.trim()),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load ElevenLabs settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      await clearElevenLabsCredentials();
      const config = await getElevenLabsPublicConfig();
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "reveal") {
      const revealed = await revealElevenLabsApiKeyFromCms();
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
      const overrideKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      const result = await testElevenLabsConnection(
        overrideKey ? { apiKeyOverride: overrideKey } : undefined,
      );
      if (!result.ok) {
        return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, message: result.message });
    }

    const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
    const modelId = typeof body.modelId === "string" ? body.modelId : undefined;
    const config = await saveElevenLabsCredentials({ apiKey, modelId });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save ElevenLabs settings");
  }
}
