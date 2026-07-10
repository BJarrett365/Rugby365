import { NextResponse } from "next/server";
import {
  clearOpenAiCredentials,
  getOpenAiPublicConfig,
  resolveOpenAiApiKey,
  resolveOpenAiModel,
  saveOpenAiCredentials,
} from "@/lib/integration-settings-service";
import { apiErrorResponse } from "@/lib/api-errors";

export async function GET() {
  try {
    const config = await getOpenAiPublicConfig();
    return NextResponse.json({
      ...config,
      docsUrl: "https://platform.openai.com/api-keys",
      envOverride: Boolean(process.env.OPENAI_API_KEY?.trim()),
      envModelOverride: Boolean(process.env.OPENAI_MODEL?.trim()),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load OpenAI settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      await clearOpenAiCredentials();
      const config = await getOpenAiPublicConfig();
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "test") {
      const key = await resolveOpenAiApiKey();
      if (!key) {
        return NextResponse.json(
          { ok: false, message: "No OpenAI API key configured." },
          { status: 400 },
        );
      }

      const model = await resolveOpenAiModel();
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: "user", content: "Reply with OK only." }],
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        return NextResponse.json(
          { ok: false, message: `OpenAI test failed (${res.status}): ${error.slice(0, 280)}` },
          { status: 400 },
        );
      }

      return NextResponse.json({
        ok: true,
        message: `Connected with model ${model}.`,
      });
    }

    const apiKey = typeof body.apiKey === "string" ? body.apiKey : undefined;
    const model = typeof body.model === "string" ? body.model : undefined;
    const config = await saveOpenAiCredentials({ apiKey, model });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save OpenAI settings");
  }
}
