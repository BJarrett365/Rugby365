import { resolveOpenAiApiKey, resolveOpenAiModel } from "./integration-settings-service";

/** @deprecated Prefer resolveOpenAiApiKey() — env-only sync check */
export function getOpenAiApiKeyFromEnv(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export async function getOpenAiApiKey(): Promise<string | null> {
  return resolveOpenAiApiKey();
}

export async function getOpenAiModel(): Promise<string> {
  return resolveOpenAiModel();
}

export async function chatCompletion(input: {
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const key = await getOpenAiApiKey();
  if (!key) {
    throw new Error(
      "OpenAI API key is not configured. Add OPENAI_API_KEY to .env or save a key in Admin → Keys → OpenAI.",
    );
  }

  const model = await getOpenAiModel();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? 1200,
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${error.slice(0, 500)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export function parseJsonObject<T extends Record<string, unknown>>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}
