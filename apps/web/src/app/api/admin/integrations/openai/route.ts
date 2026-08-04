import { NextResponse } from "next/server";
import {
  clearOpenAiCredentials,
  getOpenAiPublicConfig,
  resolveOpenAiApiKey,
  revealOpenAiApiKeyFromCms,
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

    if (body.action === "reveal") {
      const revealed = await revealOpenAiApiKeyFromCms();
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
      const key = overrideKey || (await resolveOpenAiApiKey());
      if (!key) {
        return NextResponse.json(
          { ok: false, message: "No OpenAI API key configured." },
          { status: 400 },
        );
      }

      const res = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as
        | { data?: unknown[]; error?: { message?: string } }
        | Record<string, unknown>;

      if (!res.ok) {
        const message =
          typeof data === "object" &&
          data &&
          "error" in data &&
          typeof data.error === "object" &&
          data.error &&
          "message" in data.error &&
          typeof data.error.message === "string"
            ? data.error.message
            : `OpenAI API error (${res.status})`;
        return NextResponse.json({ ok: false, message }, { status: 400 });
      }

      const modelCount = Array.isArray((data as { data?: unknown[] }).data)
        ? (data as { data?: unknown[] }).data!.length
        : 0;

      return NextResponse.json({
        ok: true,
        modelCount,
        message: `OpenAI connected. API key is valid (${modelCount} models listed).`,
      });
    }

    if (body.action === "test-caption") {
      const overrideKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
      const key = overrideKey || (await resolveOpenAiApiKey());
      if (!key) {
        return NextResponse.json(
          {
            ok: false,
            message: "No OpenAI API key provided (or stored in admin settings).",
          },
          { status: 400 },
        );
      }

      const userPrompt =
        typeof body.prompt === "string" && body.prompt.trim()
          ? body.prompt.trim()
          : "Write one punchy social caption for a last-minute rugby try in under 20 words.";

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 80,
          messages: [
            {
              role: "system",
              content:
                "You are writing concise social media captions for rugby sports video and match highlights.",
            },
            { role: "user", content: userPrompt },
          ],
        }),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => ({}))) as
        | {
            choices?: { message?: { content?: string } }[];
            error?: { message?: string };
          }
        | Record<string, unknown>;

      if (!res.ok) {
        const message =
          typeof data === "object" &&
          data &&
          "error" in data &&
          typeof data.error === "object" &&
          data.error &&
          "message" in data.error &&
          typeof data.error.message === "string"
            ? data.error.message
            : `OpenAI API error (${res.status})`;
        return NextResponse.json({ ok: false, message, error: message }, { status: 400 });
      }

      const caption = Array.isArray((data as { choices?: { message?: { content?: string } }[] }).choices)
        ? (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content?.trim()
        : "";

      if (!caption) {
        return NextResponse.json(
          { ok: false, message: "No caption text returned from OpenAI." },
          { status: 502 },
        );
      }

      return NextResponse.json({
        ok: true,
        caption,
        model: "gpt-4o-mini",
        message: `OpenAI caption generation passed (gpt-4o-mini).`,
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
