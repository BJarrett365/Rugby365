import { eq } from "drizzle-orm";
import { integrationSettings } from "@rugby365/db";
import { getDb } from "./db";

export const WIKIMEDIA_ENTERPRISE_SLUG = "wikimedia_enterprise";
export const OPENAI_SLUG = "openai";
export const ELEVENLABS_SLUG = "elevenlabs";
export const RUGBY_DATA_API_SLUG = "rugby_data_api";
export const SUPABASE_SLUG = "supabase";
export const WIKIPEDIA_SLUG = "wikipedia";
export const WIKIDATA_SLUG = "wikidata";

export const DEFAULT_RUGBY_DATA_API_BASE_URL =
  "https://cms-planetrugby-players-investigator-for-barrie.hneeds.com";

/** Public MediaWiki Action API — no paid key; Wikimedia requires a descriptive User-Agent. */
export const DEFAULT_WIKIPEDIA_API_BASE_URL = "https://en.wikipedia.org/w/api.php";
export const DEFAULT_WIKIDATA_API_BASE_URL = "https://www.wikidata.org/w/api.php";
export const DEFAULT_WIKIMEDIA_USER_AGENT =
  "Rugby365CMS/1.0 (https://rugby365.com; contact=admin@local)";
export const WIKIMEDIA_USER_AGENT_POLICY_URL =
  "https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy";

export type OpenAiConfig = {
  apiKey?: string;
  model?: string;
};

export type OpenAiPublicConfig = {
  hasApiKey: boolean;
  apiKeyMasked?: string;
  model: string;
  configured: boolean;
  keySource: "environment" | "admin" | "none";
};

export type WikimediaEnterpriseConfig = {
  username?: string;
  password?: string;
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
};

export type WikimediaEnterprisePublicConfig = {
  username?: string;
  hasPassword: boolean;
  hasRefreshToken: boolean;
  accessTokenExpiresAt?: string;
  configured: boolean;
};

function toPublicConfig(config: WikimediaEnterpriseConfig): WikimediaEnterprisePublicConfig {
  return {
    username: config.username,
    hasPassword: Boolean(config.password),
    hasRefreshToken: Boolean(config.refreshToken),
    accessTokenExpiresAt: config.accessTokenExpiresAt,
    configured: Boolean(config.username && config.password),
  };
}

export async function getWikimediaEnterpriseConfig(): Promise<WikimediaEnterpriseConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, WIKIMEDIA_ENTERPRISE_SLUG))
    .limit(1);

  if (!row) return {};
  return (row.config ?? {}) as WikimediaEnterpriseConfig;
}

export async function getWikimediaEnterprisePublicConfig(): Promise<WikimediaEnterprisePublicConfig> {
  const config = await getWikimediaEnterpriseConfig();
  return toPublicConfig(config);
}

export async function saveWikimediaEnterpriseCredentials(input: {
  username: string;
  password?: string;
}): Promise<WikimediaEnterprisePublicConfig> {
  const db = getDb();
  const existing = await getWikimediaEnterpriseConfig();
  const username = input.username.trim().toLowerCase();
  if (!username) throw new Error("Username is required.");

  const next: WikimediaEnterpriseConfig = {
    ...existing,
    username,
  };

  if (input.password?.trim()) {
    next.password = input.password;
    next.refreshToken = undefined;
    next.accessToken = undefined;
    next.accessTokenExpiresAt = undefined;
  }

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: WIKIMEDIA_ENTERPRISE_SLUG,
      label: "Wikimedia Enterprise",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toPublicConfig((row.config ?? {}) as WikimediaEnterpriseConfig);
}

export async function updateWikimediaEnterpriseTokens(
  patch: Partial<WikimediaEnterpriseConfig>,
): Promise<void> {
  const db = getDb();
  const existing = await getWikimediaEnterpriseConfig();
  const next = { ...existing, ...patch };

  await db
    .insert(integrationSettings)
    .values({
      slug: WIKIMEDIA_ENTERPRISE_SLUG,
      label: "Wikimedia Enterprise",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    });
}

export async function clearWikimediaEnterpriseCredentials(): Promise<void> {
  const db = getDb();
  await db
    .insert(integrationSettings)
    .values({
      slug: WIKIMEDIA_ENTERPRISE_SLUG,
      label: "Wikimedia Enterprise",
      config: {},
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: {},
        updatedAt: new Date(),
      },
    });
}

/** Write-only preview matching Plexa admin: bullet run + last 4 chars. Never returns the full secret. */
function maskSecret(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const suffix = trimmed.length > 6 ? trimmed.slice(-4) : "";
  return `${"•".repeat(Math.max(12, Math.min(40, trimmed.length)))}${suffix ? ` ${suffix}` : ""}`;
}

export type RevealSecretResult =
  | { status: "ok"; secret: string }
  | { status: "env_only"; message: string }
  | { status: "missing"; message: string };

const ENV_REVEAL_MESSAGE =
  "Set via environment variable — reveal from host env, not CMS.";

function openAiKeySource(config: OpenAiConfig): OpenAiPublicConfig["keySource"] {
  if (process.env.OPENAI_API_KEY?.trim()) return "environment";
  if (config.apiKey?.trim()) return "admin";
  return "none";
}

function toOpenAiPublicConfig(config: OpenAiConfig): OpenAiPublicConfig {
  const envModel = process.env.OPENAI_MODEL?.trim();
  const model = envModel || config.model?.trim() || "gpt-4o-mini";
  const hasStoredKey = Boolean(config.apiKey?.trim());
  const keySource = openAiKeySource(config);

  return {
    hasApiKey: keySource !== "none",
    apiKeyMasked:
      keySource === "environment"
        ? maskSecret(process.env.OPENAI_API_KEY)
        : hasStoredKey
          ? maskSecret(config.apiKey)
          : undefined,
    model,
    configured: keySource !== "none",
    keySource,
  };
}

export async function getOpenAiConfig(): Promise<OpenAiConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, OPENAI_SLUG))
    .limit(1);

  if (!row) return {};
  return (row.config ?? {}) as OpenAiConfig;
}

export async function getOpenAiPublicConfig(): Promise<OpenAiPublicConfig> {
  const config = await getOpenAiConfig();
  return toOpenAiPublicConfig(config);
}

export async function saveOpenAiCredentials(input: {
  apiKey?: string;
  model?: string;
}): Promise<OpenAiPublicConfig> {
  const db = getDb();
  const existing = await getOpenAiConfig();
  const next: OpenAiConfig = { ...existing };

  if (input.model?.trim()) {
    next.model = input.model.trim();
  }

  if (input.apiKey?.trim()) {
    next.apiKey = input.apiKey.trim();
  }

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: OPENAI_SLUG,
      label: "OpenAI",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toOpenAiPublicConfig((row.config ?? {}) as OpenAiConfig);
}

export async function clearOpenAiCredentials(): Promise<void> {
  const db = getDb();
  const existing = await getOpenAiConfig();
  const next: OpenAiConfig = { model: existing.model };

  await db
    .insert(integrationSettings)
    .values({
      slug: OPENAI_SLUG,
      label: "OpenAI",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    });
}

export async function resolveOpenAiApiKey(): Promise<string | null> {
  const env = process.env.OPENAI_API_KEY?.trim();
  if (env) return env;
  const config = await getOpenAiConfig();
  return config.apiKey?.trim() || null;
}

/** Admin-only: return CMS-stored secret. Never logs the value. Env overrides are not returned. */
export async function revealOpenAiApiKeyFromCms(): Promise<RevealSecretResult> {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return {
      status: "env_only",
      message: ENV_REVEAL_MESSAGE,
    };
  }
  const config = await getOpenAiConfig();
  const secret = config.apiKey?.trim();
  if (!secret) {
    return { status: "missing", message: "No OpenAI API key stored in CMS." };
  }
  return { status: "ok", secret };
}

export async function resolveOpenAiModel(): Promise<string> {
  const env = process.env.OPENAI_MODEL?.trim();
  if (env) return env;
  const config = await getOpenAiConfig();
  return config.model?.trim() || "gpt-4o-mini";
}

export type ElevenLabsConfig = {
  apiKey?: string;
  /** Default model for TTS (e.g. eleven_multilingual_v2). */
  modelId?: string;
};

export type ElevenLabsPublicConfig = {
  hasApiKey: boolean;
  apiKeyMasked?: string;
  modelId: string;
  configured: boolean;
  keySource: "environment" | "admin" | "none";
};

function elevenLabsKeySource(config: ElevenLabsConfig): ElevenLabsPublicConfig["keySource"] {
  if (process.env.ELEVENLABS_API_KEY?.trim()) return "environment";
  if (config.apiKey?.trim()) return "admin";
  return "none";
}

function toElevenLabsPublicConfig(config: ElevenLabsConfig): ElevenLabsPublicConfig {
  const envModel = process.env.ELEVENLABS_MODEL_ID?.trim();
  const modelId = envModel || config.modelId?.trim() || "eleven_multilingual_v2";
  const hasStoredKey = Boolean(config.apiKey?.trim());
  const keySource = elevenLabsKeySource(config);

  return {
    hasApiKey: keySource !== "none",
    apiKeyMasked:
      keySource === "environment"
        ? maskSecret(process.env.ELEVENLABS_API_KEY)
        : hasStoredKey
          ? maskSecret(config.apiKey)
          : undefined,
    modelId,
    configured: keySource !== "none",
    keySource,
  };
}

export async function getElevenLabsConfig(): Promise<ElevenLabsConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, ELEVENLABS_SLUG))
    .limit(1);

  if (!row) return {};
  return (row.config ?? {}) as ElevenLabsConfig;
}

export async function getElevenLabsPublicConfig(): Promise<ElevenLabsPublicConfig> {
  const config = await getElevenLabsConfig();
  return toElevenLabsPublicConfig(config);
}

export async function saveElevenLabsCredentials(input: {
  apiKey?: string;
  modelId?: string;
}): Promise<ElevenLabsPublicConfig> {
  const db = getDb();
  const existing = await getElevenLabsConfig();
  const next: ElevenLabsConfig = { ...existing };

  if (input.modelId?.trim()) {
    next.modelId = input.modelId.trim();
  }

  if (input.apiKey?.trim()) {
    next.apiKey = input.apiKey.trim();
  }

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: ELEVENLABS_SLUG,
      label: "ElevenLabs",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toElevenLabsPublicConfig((row.config ?? {}) as ElevenLabsConfig);
}

export async function clearElevenLabsCredentials(): Promise<void> {
  const db = getDb();
  const existing = await getElevenLabsConfig();
  const next: ElevenLabsConfig = { modelId: existing.modelId };

  await db
    .insert(integrationSettings)
    .values({
      slug: ELEVENLABS_SLUG,
      label: "ElevenLabs",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    });
}

export async function resolveElevenLabsApiKey(): Promise<string | null> {
  const env = process.env.ELEVENLABS_API_KEY?.trim();
  if (env) return env;
  const config = await getElevenLabsConfig();
  return config.apiKey?.trim() || null;
}

/** Admin-only: return CMS-stored secret. Never logs the value. Env overrides are not returned. */
export async function revealElevenLabsApiKeyFromCms(): Promise<RevealSecretResult> {
  if (process.env.ELEVENLABS_API_KEY?.trim()) {
    return {
      status: "env_only",
      message: ENV_REVEAL_MESSAGE,
    };
  }
  const config = await getElevenLabsConfig();
  const secret = config.apiKey?.trim();
  if (!secret) {
    return { status: "missing", message: "No ElevenLabs API key stored in CMS." };
  }
  return { status: "ok", secret };
}

export async function resolveElevenLabsModelId(): Promise<string> {
  const env = process.env.ELEVENLABS_MODEL_ID?.trim();
  if (env) return env;
  const config = await getElevenLabsConfig();
  return config.modelId?.trim() || "eleven_multilingual_v2";
}

export type RugbyDataApiConfig = {
  apiToken?: string;
  baseUrl?: string;
};

export type RugbyDataApiPublicConfig = {
  hasApiToken: boolean;
  apiTokenMasked?: string;
  baseUrl: string;
  configured: boolean;
  tokenSource: "environment" | "admin" | "none";
  baseUrlSource: "environment" | "admin" | "default";
};

function rugbyDataTokenSource(config: RugbyDataApiConfig): RugbyDataApiPublicConfig["tokenSource"] {
  if (process.env.RUGBY_DATA_API_TOKEN?.trim()) return "environment";
  if (config.apiToken?.trim()) return "admin";
  return "none";
}

function rugbyDataBaseUrlSource(config: RugbyDataApiConfig): RugbyDataApiPublicConfig["baseUrlSource"] {
  if (process.env.RUGBY_DATA_API_BASE_URL?.trim()) return "environment";
  if (config.baseUrl?.trim()) return "admin";
  return "default";
}

function toRugbyDataApiPublicConfig(config: RugbyDataApiConfig): RugbyDataApiPublicConfig {
  const tokenSource = rugbyDataTokenSource(config);
  const baseUrlSource = rugbyDataBaseUrlSource(config);
  const baseUrl =
    process.env.RUGBY_DATA_API_BASE_URL?.trim() ||
    config.baseUrl?.trim() ||
    DEFAULT_RUGBY_DATA_API_BASE_URL;

  return {
    hasApiToken: tokenSource !== "none",
    apiTokenMasked:
      tokenSource === "environment"
        ? maskSecret(process.env.RUGBY_DATA_API_TOKEN)
        : config.apiToken?.trim()
          ? maskSecret(config.apiToken)
          : undefined,
    baseUrl,
    // Token optional for current GET samples; base URL is enough to attempt a connection test.
    configured: Boolean(baseUrl),
    tokenSource,
    baseUrlSource,
  };
}

export async function getRugbyDataApiConfig(): Promise<RugbyDataApiConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, RUGBY_DATA_API_SLUG))
    .limit(1);

  if (!row) return {};
  return (row.config ?? {}) as RugbyDataApiConfig;
}

export async function getRugbyDataApiPublicConfig(): Promise<RugbyDataApiPublicConfig> {
  const config = await getRugbyDataApiConfig();
  return toRugbyDataApiPublicConfig(config);
}

export async function saveRugbyDataApiCredentials(input: {
  apiToken?: string;
  baseUrl?: string;
}): Promise<RugbyDataApiPublicConfig> {
  const db = getDb();
  const existing = await getRugbyDataApiConfig();
  const next: RugbyDataApiConfig = { ...existing };

  if (typeof input.baseUrl === "string") {
    const trimmed = input.baseUrl.trim().replace(/\/$/, "");
    if (trimmed) {
      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        throw new Error("Base URL must be a valid https URL.");
      }
      if (parsed.protocol !== "https:") {
        throw new Error("Base URL must use https.");
      }
      next.baseUrl = trimmed;
    }
  }

  if (input.apiToken?.trim()) {
    next.apiToken = input.apiToken.trim();
  }

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: RUGBY_DATA_API_SLUG,
      label: "Rugby Data API",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toRugbyDataApiPublicConfig((row.config ?? {}) as RugbyDataApiConfig);
}

export async function clearRugbyDataApiCredentials(): Promise<void> {
  const db = getDb();
  const existing = await getRugbyDataApiConfig();
  const next: RugbyDataApiConfig = {
    baseUrl: existing.baseUrl,
  };

  await db
    .insert(integrationSettings)
    .values({
      slug: RUGBY_DATA_API_SLUG,
      label: "Rugby Data API",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    });
}

export async function resolveRugbyDataApiToken(): Promise<string | null> {
  const env = process.env.RUGBY_DATA_API_TOKEN?.trim();
  if (env) return env;
  const config = await getRugbyDataApiConfig();
  return config.apiToken?.trim() || null;
}

export async function resolveRugbyDataApiBaseUrl(): Promise<string> {
  const env = process.env.RUGBY_DATA_API_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const config = await getRugbyDataApiConfig();
  return (config.baseUrl?.trim() || DEFAULT_RUGBY_DATA_API_BASE_URL).replace(/\/$/, "");
}

export type SupabaseConfig = {
  projectUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
};

export type SupabasePublicConfig = {
  projectUrl: string;
  /** Hostname only when a project URL is resolved (for admin status lines). */
  projectUrlHost: string;
  hasAnonKey: boolean;
  anonKeyMasked?: string;
  hasServiceRoleKey: boolean;
  serviceRoleKeyMasked?: string;
  /** True when project URL + service_role are available (Plexa-style server credentials). */
  configured: boolean;
  /** True when project URL + anon key are available (client / RLS reads). */
  anonConfigured: boolean;
  projectUrlSource: "environment" | "admin" | "none";
  anonKeySource: "environment" | "admin" | "none";
  serviceRoleKeySource: "environment" | "admin" | "none";
};

function supabaseProjectUrlSource(config: SupabaseConfig): SupabasePublicConfig["projectUrlSource"] {
  if (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "environment";
  }
  if (config.projectUrl?.trim()) return "admin";
  return "none";
}

function supabaseAnonKeySource(config: SupabaseConfig): SupabasePublicConfig["anonKeySource"] {
  if (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  ) {
    return "environment";
  }
  if (config.anonKey?.trim()) return "admin";
  return "none";
}

function supabaseServiceRoleKeySource(
  config: SupabaseConfig,
): SupabasePublicConfig["serviceRoleKeySource"] {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return "environment";
  if (config.serviceRoleKey?.trim()) return "admin";
  return "none";
}

function toSupabasePublicConfig(config: SupabaseConfig): SupabasePublicConfig {
  const projectUrlSource = supabaseProjectUrlSource(config);
  const anonKeySource = supabaseAnonKeySource(config);
  const serviceRoleKeySource = supabaseServiceRoleKeySource(config);

  const projectUrl = (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    config.projectUrl?.trim() ||
    ""
  ).replace(/\/$/, "");

  let projectUrlHost = "";
  if (projectUrl) {
    try {
      projectUrlHost = new URL(projectUrl).hostname;
    } catch {
      projectUrlHost = projectUrl.replace(/^https?:\/\//, "").split("/")[0] ?? "";
    }
  }

  return {
    projectUrl,
    projectUrlHost,
    hasAnonKey: anonKeySource !== "none",
    anonKeyMasked:
      anonKeySource === "environment"
        ? maskSecret(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
        : config.anonKey?.trim()
          ? maskSecret(config.anonKey)
          : undefined,
    hasServiceRoleKey: serviceRoleKeySource !== "none",
    serviceRoleKeyMasked:
      serviceRoleKeySource === "environment"
        ? maskSecret(process.env.SUPABASE_SERVICE_ROLE_KEY)
        : config.serviceRoleKey?.trim()
          ? maskSecret(config.serviceRoleKey)
          : undefined,
    configured: Boolean(projectUrl && serviceRoleKeySource !== "none"),
    anonConfigured: Boolean(projectUrl && anonKeySource !== "none"),
    projectUrlSource,
    anonKeySource,
    serviceRoleKeySource,
  };
}

export async function getSupabaseConfig(): Promise<SupabaseConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, SUPABASE_SLUG))
    .limit(1);

  if (!row) return {};
  return (row.config ?? {}) as SupabaseConfig;
}

export async function getSupabasePublicConfig(): Promise<SupabasePublicConfig> {
  const config = await getSupabaseConfig();
  return toSupabasePublicConfig(config);
}

function assertHttpsUrl(value: string, label: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} must be a valid https URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${label} must use https.`);
  }
  return trimmed;
}

/** Reject dashboard / account URLs; accept *.supabase.co (and optional custom API hosts). */
export function assertSupabaseProjectUrl(value: string): string {
  const trimmed = assertHttpsUrl(value, "Project URL");
  const host = new URL(trimmed).hostname.toLowerCase();

  if (host === "supabase.com" || host.endsWith(".supabase.com")) {
    throw new Error(
      "Use the Project API URL from Project Settings → API (https://YOUR_REF.supabase.co), not the dashboard or account tokens page.",
    );
  }

  const looksLikeProject =
    host.endsWith(".supabase.co") ||
    host.endsWith(".supabase.in") ||
    // self-hosted / custom domain — allow but require path root only
    (!host.includes("supabase.com") && new URL(trimmed).pathname === "/");

  if (!looksLikeProject) {
    throw new Error(
      "Project URL should look like https://YOUR_REF.supabase.co (from Project Settings → API).",
    );
  }

  if (new URL(trimmed).pathname !== "/" && !host.endsWith(".supabase.co")) {
    // allow only origin for custom hosts
  }
  // Strip accidental paths like /auth/v1
  const origin = new URL(trimmed).origin;
  return origin;
}

export function looksLikeSupabasePersonalAccessToken(value: string): boolean {
  return /^sbp_/i.test(value.trim());
}

export function assertSupabaseAnonOrServiceKey(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  if (looksLikeSupabasePersonalAccessToken(trimmed)) {
    throw new Error(
      `${label} looks like a personal access token (sbp_…). Use the project anon or service_role key from Project Settings → API (usually starts with eyJ).`,
    );
  }
  return trimmed;
}

export async function saveSupabaseCredentials(input: {
  projectUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
}): Promise<SupabasePublicConfig> {
  const db = getDb();
  const existing = await getSupabaseConfig();
  const next: SupabaseConfig = { ...existing };

  if (typeof input.projectUrl === "string" && input.projectUrl.trim()) {
    next.projectUrl = assertSupabaseProjectUrl(input.projectUrl);
  }
  if (input.anonKey?.trim()) {
    next.anonKey = assertSupabaseAnonOrServiceKey(input.anonKey, "Anon key");
  }
  if (input.serviceRoleKey?.trim()) {
    next.serviceRoleKey = assertSupabaseAnonOrServiceKey(input.serviceRoleKey, "Service role key");
  }

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: SUPABASE_SLUG,
      label: "Supabase",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toSupabasePublicConfig((row.config ?? {}) as SupabaseConfig);
}

export async function clearSupabaseCredentials(input?: {
  clearProjectUrl?: boolean;
  clearAnonKey?: boolean;
  clearServiceRoleKey?: boolean;
}): Promise<SupabasePublicConfig> {
  const db = getDb();
  const existing = await getSupabaseConfig();
  const clearUrl = Boolean(input?.clearProjectUrl);
  const clearAnon = input?.clearAnonKey !== false;
  const clearService = input?.clearServiceRoleKey !== false;

  const next: SupabaseConfig = {};
  if (!clearUrl && existing.projectUrl) next.projectUrl = existing.projectUrl;
  if (!clearAnon && existing.anonKey) next.anonKey = existing.anonKey;
  if (!clearService && existing.serviceRoleKey) next.serviceRoleKey = existing.serviceRoleKey;

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: SUPABASE_SLUG,
      label: "Supabase",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toSupabasePublicConfig((row.config ?? {}) as SupabaseConfig);
}

export async function resolveSupabaseProjectUrl(): Promise<string | null> {
  const env = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const config = await getSupabaseConfig();
  return config.projectUrl?.trim().replace(/\/$/, "") || null;
}

export async function resolveSupabaseAnonKey(): Promise<string | null> {
  const env = process.env.SUPABASE_ANON_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (env) return env;
  const config = await getSupabaseConfig();
  return config.anonKey?.trim() || null;
}

/** Server-only. Never expose via NEXT_PUBLIC_* or client responses. */
export async function resolveSupabaseServiceRoleKey(): Promise<string | null> {
  const env = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (env) return env;
  const config = await getSupabaseConfig();
  return config.serviceRoleKey?.trim() || null;
}

export type SupabaseRevealField = "serviceRoleKey" | "anonKey";

/** Admin-only: return CMS-stored Supabase secret. Env overrides are not returned. */
export async function revealSupabaseSecretFromCms(
  field: SupabaseRevealField,
): Promise<RevealSecretResult> {
  if (field === "serviceRoleKey") {
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return { status: "env_only", message: ENV_REVEAL_MESSAGE };
    }
    const config = await getSupabaseConfig();
    const secret = config.serviceRoleKey?.trim();
    if (!secret) {
      return { status: "missing", message: "No Supabase service role key stored in CMS." };
    }
    return { status: "ok", secret };
  }

  if (
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  ) {
    return { status: "env_only", message: ENV_REVEAL_MESSAGE };
  }
  const config = await getSupabaseConfig();
  const secret = config.anonKey?.trim();
  if (!secret) {
    return { status: "missing", message: "No Supabase anon key stored in CMS." };
  }
  return { status: "ok", secret };
}

export async function testSupabaseConnection(input?: {
  projectUrl?: string;
  serviceRoleKey?: string;
  anonKey?: string;
}): Promise<{
  ok: boolean;
  message: string;
  projectUrl: string | null;
  host?: string;
  responseTimeMs: number;
}> {
  const projectUrl = (
    input?.projectUrl?.trim() ||
    (await resolveSupabaseProjectUrl()) ||
    ""
  ).replace(/\/$/, "");
  const serviceRoleKey =
    input?.serviceRoleKey?.trim() || (await resolveSupabaseServiceRoleKey()) || "";
  const anonKey = input?.anonKey?.trim() || (await resolveSupabaseAnonKey()) || "";

  if (!projectUrl) {
    return { ok: false, message: "No Supabase project URL configured.", projectUrl: null, responseTimeMs: 0 };
  }

  try {
    assertSupabaseProjectUrl(projectUrl);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid project URL",
      projectUrl,
      responseTimeMs: 0,
    };
  }

  let host = projectUrl;
  try {
    host = new URL(projectUrl).hostname;
  } catch {
    /* keep raw */
  }

  // Prefer service_role (Plexa-style): list storage buckets to prove server credentials work.
  if (serviceRoleKey) {
    if (looksLikeSupabasePersonalAccessToken(serviceRoleKey)) {
      return {
        ok: false,
        message:
          "Service role looks like a personal access token (sbp_…). Use the project service_role key from Project Settings → API (usually starts with eyJ).",
        projectUrl,
        host,
        responseTimeMs: 0,
      };
    }

    const started = Date.now();
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(projectUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const listed = await supabase.storage.listBuckets();
      const responseTimeMs = Date.now() - started;
      if (listed.error) {
        return {
          ok: false,
          message: listed.error.message || "Storage listBuckets failed with service_role.",
          projectUrl,
          host,
          responseTimeMs,
        };
      }
      const bucketCount = listed.data?.length ?? 0;
      return {
        ok: true,
        message: `Supabase reachable (${host}). Service role OK — ${bucketCount} storage bucket${bucketCount === 1 ? "" : "s"} listed.`,
        projectUrl,
        host,
        responseTimeMs,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Connection failed",
        projectUrl,
        host,
        responseTimeMs: Date.now() - started,
      };
    }
  }

  if (!anonKey) {
    return {
      ok: false,
      message:
        "Supabase URL and service role key are required (paste in the form or save in admin settings first). Anon key alone can also be used for a basic health check.",
      projectUrl,
      host,
      responseTimeMs: 0,
    };
  }

  if (looksLikeSupabasePersonalAccessToken(anonKey)) {
    return {
      ok: false,
      message:
        "Anon key looks like a personal access token (sbp_…). Use the project anon key from Project Settings → API (usually starts with eyJ).",
      projectUrl,
      host,
      responseTimeMs: 0,
    };
  }

  const started = Date.now();
  try {
    const res = await fetch(`${projectUrl}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      cache: "no-store",
    });
    const responseTimeMs = Date.now() - started;
    const body = await res.text().catch(() => "");
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      if (contentType.includes("text/html") || body.trimStart().startsWith("<!DOCTYPE")) {
        return {
          ok: false,
          message:
            "Health check returned a web page, not the Supabase API. Project URL must be https://YOUR_REF.supabase.co from Project Settings → API (not the dashboard).",
          projectUrl,
          host,
          responseTimeMs,
        };
      }
      return {
        ok: false,
        message: `Supabase health check failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        projectUrl,
        host,
        responseTimeMs,
      };
    }
    return {
      ok: true,
      message: `Connected — Auth health endpoint responded OK (${host}). Paste a service_role key for a full server credential check.`,
      projectUrl,
      host,
      responseTimeMs,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Connection failed",
      projectUrl,
      host,
      responseTimeMs: Date.now() - started,
    };
  }
}

export const TV_SCHEDULE_SLUG = "tv_schedule";
export const DEFAULT_GRACENOTE_BASE_URL = "https://data.tmsapi.com/v1.1";

export type TvScheduleProvider = "none" | "gracenote" | "pa_media";

export type TvScheduleConfig = {
  provider?: TvScheduleProvider;
  gracenoteApiKey?: string;
  gracenoteBaseUrl?: string;
  gracenoteLineupId?: string;
  paApiKey?: string;
  defaultRegion?: string;
};

export type TvSchedulePublicConfig = {
  provider: TvScheduleProvider;
  hasGracenoteApiKey: boolean;
  gracenoteApiKeyMasked?: string;
  gracenoteBaseUrl: string;
  gracenoteLineupId: string;
  hasPaApiKey: boolean;
  paApiKeyMasked?: string;
  defaultRegion: string;
  configured: boolean;
  gracenoteKeySource: "environment" | "admin" | "none";
  paKeySource: "environment" | "admin" | "none";
};

function normalizeTvProvider(value: unknown): TvScheduleProvider {
  if (value === "gracenote" || value === "pa_media" || value === "none") return value;
  return "none";
}

function toTvSchedulePublicConfig(config: TvScheduleConfig): TvSchedulePublicConfig {
  const envGracenote = process.env.GRACENOTE_API_KEY?.trim();
  const envPa = process.env.PA_MEDIA_TV_API_KEY?.trim();
  const gracenoteKey = envGracenote || config.gracenoteApiKey?.trim() || "";
  const paKey = envPa || config.paApiKey?.trim() || "";
  const provider = normalizeTvProvider(config.provider);
  const hasGracenote = Boolean(gracenoteKey);
  const hasPa = Boolean(paKey);
  return {
    provider,
    hasGracenoteApiKey: hasGracenote,
    gracenoteApiKeyMasked: hasGracenote
      ? maskSecret(envGracenote || config.gracenoteApiKey)
      : undefined,
    gracenoteBaseUrl:
      process.env.GRACENOTE_BASE_URL?.trim() ||
      config.gracenoteBaseUrl?.trim() ||
      DEFAULT_GRACENOTE_BASE_URL,
    gracenoteLineupId: config.gracenoteLineupId?.trim() || "",
    hasPaApiKey: hasPa,
    paApiKeyMasked: hasPa ? maskSecret(envPa || config.paApiKey) : undefined,
    defaultRegion: config.defaultRegion?.trim() || "UK",
    configured:
      (provider === "gracenote" && hasGracenote) ||
      (provider === "pa_media" && hasPa) ||
      (provider === "none" && false),
    gracenoteKeySource: envGracenote
      ? "environment"
      : config.gracenoteApiKey?.trim()
        ? "admin"
        : "none",
    paKeySource: envPa ? "environment" : config.paApiKey?.trim() ? "admin" : "none",
  };
}

export async function getTvScheduleConfig(): Promise<TvScheduleConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, TV_SCHEDULE_SLUG))
    .limit(1);
  if (!row) return { provider: "none", defaultRegion: "UK" };
  return (row.config ?? {}) as TvScheduleConfig;
}

export async function getTvSchedulePublicConfig(): Promise<TvSchedulePublicConfig> {
  const config = await getTvScheduleConfig();
  return toTvSchedulePublicConfig(config);
}

export async function saveTvScheduleCredentials(input: {
  provider?: TvScheduleProvider;
  gracenoteApiKey?: string;
  gracenoteBaseUrl?: string;
  gracenoteLineupId?: string;
  paApiKey?: string;
  defaultRegion?: string;
}): Promise<TvSchedulePublicConfig> {
  const db = getDb();
  const existing = await getTvScheduleConfig();
  const next: TvScheduleConfig = { ...existing };

  if (input.provider !== undefined) next.provider = normalizeTvProvider(input.provider);
  if (input.gracenoteApiKey?.trim()) next.gracenoteApiKey = input.gracenoteApiKey.trim();
  if (input.gracenoteBaseUrl !== undefined) {
    next.gracenoteBaseUrl = input.gracenoteBaseUrl.trim() || DEFAULT_GRACENOTE_BASE_URL;
  }
  if (input.gracenoteLineupId !== undefined) {
    next.gracenoteLineupId = input.gracenoteLineupId.trim();
  }
  if (input.paApiKey?.trim()) next.paApiKey = input.paApiKey.trim();
  if (input.defaultRegion !== undefined) {
    next.defaultRegion = input.defaultRegion.trim() || "UK";
  }

  const [row] = await db
    .insert(integrationSettings)
    .values({
      slug: TV_SCHEDULE_SLUG,
      label: "TV Schedule",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toTvSchedulePublicConfig((row.config ?? {}) as TvScheduleConfig);
}

export async function clearTvScheduleCredentials(input?: {
  clearGracenote?: boolean;
  clearPa?: boolean;
}): Promise<TvSchedulePublicConfig> {
  const db = getDb();
  const existing = await getTvScheduleConfig();
  const next: TvScheduleConfig = { ...existing };
  if (input?.clearGracenote !== false) delete next.gracenoteApiKey;
  if (input?.clearPa !== false) delete next.paApiKey;

  await db
    .insert(integrationSettings)
    .values({
      slug: TV_SCHEDULE_SLUG,
      label: "TV Schedule",
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: { config: next, updatedAt: new Date() },
    });

  return getTvSchedulePublicConfig();
}

export async function resolveGracenoteApiKey(): Promise<string | null> {
  const env = process.env.GRACENOTE_API_KEY?.trim();
  if (env) return env;
  const config = await getTvScheduleConfig();
  return config.gracenoteApiKey?.trim() || null;
}

export async function resolvePaMediaTvApiKey(): Promise<string | null> {
  const env = process.env.PA_MEDIA_TV_API_KEY?.trim();
  if (env) return env;
  const config = await getTvScheduleConfig();
  return config.paApiKey?.trim() || null;
}

export async function testTvScheduleConnection(): Promise<{
  ok: boolean;
  message: string;
  provider: TvScheduleProvider;
}> {
  const config = await getTvScheduleConfig();
  const provider = normalizeTvProvider(config.provider);

  if (provider === "none") {
    return {
      ok: false,
      message:
        "No EPG provider selected. Choose Gracenote or PA Media, or keep using manual CMS broadcasters.",
      provider,
    };
  }

  if (provider === "gracenote") {
    const key = await resolveGracenoteApiKey();
    if (!key) {
      return { ok: false, message: "No Gracenote API key configured.", provider };
    }
    const base =
      process.env.GRACENOTE_BASE_URL?.trim() ||
      config.gracenoteBaseUrl?.trim() ||
      DEFAULT_GRACENOTE_BASE_URL;
    const url = `${base.replace(/\/$/, "")}/sports/genres?api_key=${encodeURIComponent(key)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        return {
          ok: false,
          message: `Gracenote test failed (${res.status}): ${body.slice(0, 220)}`,
          provider,
        };
      }
      return {
        ok: true,
        message: "Connected to Gracenote — sports genres endpoint OK. Match sync can be built next.",
        provider,
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Gracenote request failed",
        provider,
      };
    }
  }

  const paKey = await resolvePaMediaTvApiKey();
  if (!paKey) {
    return { ok: false, message: "No PA Media TV API key configured.", provider };
  }
  return {
    ok: true,
    message:
      "PA Media key stored. Full EPG sync needs a commercial endpoint URL from PA — contact PA Media for access.",
    provider,
  };
}

// —— Wikipedia / Wikidata MediaWiki Action APIs (no paid API key; User-Agent required) ——

export type MediaWikiIntegrationConfig = {
  enabled?: boolean;
  userAgent?: string;
  apiBaseUrl?: string;
  /** Optional OAuth / bearer token for higher rate limits (rarely needed for read-only). */
  accessToken?: string;
};

export type MediaWikiPublicConfig = {
  enabled: boolean;
  userAgent: string;
  apiBaseUrl: string;
  hasAccessToken: boolean;
  accessTokenMasked?: string;
  /** True when enabled and a User-Agent is available (env, CMS, or default). */
  configured: boolean;
  userAgentSource: "environment" | "admin" | "default";
  apiBaseUrlSource: "environment" | "admin" | "default";
  accessTokenSource: "environment" | "admin" | "none";
  docsUrl: string;
  userAgentPolicyUrl: string;
};

export type ResolvedMediaWikiSettings = {
  enabled: boolean;
  userAgent: string;
  apiBaseUrl: string;
  accessToken: string | null;
};

function assertMediaWikiApiUrl(value: string, label: string): string {
  const trimmed = assertHttpsUrl(value, label);
  const pathname = new URL(trimmed).pathname.toLowerCase();
  if (!pathname.includes("api.php") && !pathname.endsWith("/w/api.php")) {
    // Allow any https Action API endpoint; warn only if path looks unrelated.
    if (!pathname.includes("api")) {
      throw new Error(`${label} should point at a MediaWiki Action API (…/w/api.php).`);
    }
  }
  return trimmed;
}

function mediaWikiUserAgentSource(
  config: MediaWikiIntegrationConfig,
  envUserAgent: string | undefined,
): MediaWikiPublicConfig["userAgentSource"] {
  if (envUserAgent?.trim()) return "environment";
  if (config.userAgent?.trim()) return "admin";
  return "default";
}

function mediaWikiApiBaseUrlSource(
  config: MediaWikiIntegrationConfig,
  envBaseUrl: string | undefined,
): MediaWikiPublicConfig["apiBaseUrlSource"] {
  if (envBaseUrl?.trim()) return "environment";
  if (config.apiBaseUrl?.trim()) return "admin";
  return "default";
}

function mediaWikiAccessTokenSource(
  config: MediaWikiIntegrationConfig,
  envToken: string | undefined,
): MediaWikiPublicConfig["accessTokenSource"] {
  if (envToken?.trim()) return "environment";
  if (config.accessToken?.trim()) return "admin";
  return "none";
}

function toMediaWikiPublicConfig(
  config: MediaWikiIntegrationConfig,
  defaults: {
    envUserAgent?: string;
    envBaseUrl?: string;
    envAccessToken?: string;
    defaultBaseUrl: string;
    docsUrl: string;
  },
): MediaWikiPublicConfig {
  const userAgentSource = mediaWikiUserAgentSource(config, defaults.envUserAgent);
  const apiBaseUrlSource = mediaWikiApiBaseUrlSource(config, defaults.envBaseUrl);
  const accessTokenSource = mediaWikiAccessTokenSource(config, defaults.envAccessToken);
  const userAgent =
    defaults.envUserAgent?.trim() ||
    config.userAgent?.trim() ||
    DEFAULT_WIKIMEDIA_USER_AGENT;
  const apiBaseUrl = (
    defaults.envBaseUrl?.trim() ||
    config.apiBaseUrl?.trim() ||
    defaults.defaultBaseUrl
  ).replace(/\/$/, "");
  const enabled = config.enabled !== false;
  const hasAccessToken = accessTokenSource !== "none";

  return {
    enabled,
    userAgent,
    apiBaseUrl,
    hasAccessToken,
    accessTokenMasked: hasAccessToken
      ? maskSecret(defaults.envAccessToken || config.accessToken)
      : undefined,
    configured: enabled && Boolean(userAgent),
    userAgentSource,
    apiBaseUrlSource,
    accessTokenSource,
    docsUrl: defaults.docsUrl,
    userAgentPolicyUrl: WIKIMEDIA_USER_AGENT_POLICY_URL,
  };
}

async function getMediaWikiConfig(slug: string): Promise<MediaWikiIntegrationConfig> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.slug, slug))
    .limit(1);
  if (!row) return { enabled: true };
  return (row.config ?? {}) as MediaWikiIntegrationConfig;
}

async function saveMediaWikiConfig(
  slug: string,
  label: string,
  input: {
    enabled?: boolean;
    userAgent?: string;
    apiBaseUrl?: string;
    accessToken?: string;
    clearAccessToken?: boolean;
  },
  defaultBaseUrl: string,
): Promise<MediaWikiIntegrationConfig> {
  const db = getDb();
  const existing = await getMediaWikiConfig(slug);
  const next: MediaWikiIntegrationConfig = { ...existing };

  if (typeof input.enabled === "boolean") {
    next.enabled = input.enabled;
  }
  if (typeof input.userAgent === "string") {
    const trimmed = input.userAgent.trim();
    if (trimmed) next.userAgent = trimmed;
  }
  if (typeof input.apiBaseUrl === "string") {
    const trimmed = input.apiBaseUrl.trim();
    if (trimmed) {
      next.apiBaseUrl = assertMediaWikiApiUrl(trimmed, "API base URL");
    } else {
      next.apiBaseUrl = defaultBaseUrl;
    }
  }
  if (input.clearAccessToken) {
    delete next.accessToken;
  } else if (input.accessToken?.trim()) {
    next.accessToken = input.accessToken.trim();
  }

  if (next.enabled === undefined) next.enabled = true;

  await db
    .insert(integrationSettings)
    .values({
      slug,
      label,
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    });

  return next;
}

async function clearMediaWikiSecrets(
  slug: string,
  label: string,
  options?: { clearAccessToken?: boolean; resetToDefaults?: boolean },
): Promise<MediaWikiIntegrationConfig> {
  const db = getDb();
  const existing = await getMediaWikiConfig(slug);
  const next: MediaWikiIntegrationConfig = options?.resetToDefaults
    ? { enabled: true }
    : { ...existing };

  if (options?.clearAccessToken !== false) {
    delete next.accessToken;
  }
  if (options?.resetToDefaults) {
    delete next.userAgent;
    delete next.apiBaseUrl;
  }

  await db
    .insert(integrationSettings)
    .values({
      slug,
      label,
      config: next,
    })
    .onConflictDoUpdate({
      target: integrationSettings.slug,
      set: {
        config: next,
        updatedAt: new Date(),
      },
    });

  return next;
}

function resolveMediaWikiSettingsSync(
  config: MediaWikiIntegrationConfig,
  env: {
    userAgent?: string;
    baseUrl?: string;
    accessToken?: string;
    defaultBaseUrl: string;
  },
): ResolvedMediaWikiSettings {
  return {
    enabled: config.enabled !== false,
    userAgent: env.userAgent?.trim() || config.userAgent?.trim() || DEFAULT_WIKIMEDIA_USER_AGENT,
    apiBaseUrl: (
      env.baseUrl?.trim() ||
      config.apiBaseUrl?.trim() ||
      env.defaultBaseUrl
    ).replace(/\/$/, ""),
    accessToken: env.accessToken?.trim() || config.accessToken?.trim() || null,
  };
}

async function testMediaWikiSiteInfo(input: {
  apiBaseUrl: string;
  userAgent: string;
  accessToken?: string | null;
  label: string;
}): Promise<{ ok: boolean; message: string; responseTimeMs: number; sitename?: string }> {
  if (!input.userAgent.trim()) {
    return {
      ok: false,
      message: "User-Agent is required by Wikimedia policy.",
      responseTimeMs: 0,
    };
  }

  let apiUrl: string;
  try {
    apiUrl = assertMediaWikiApiUrl(input.apiBaseUrl, "API base URL");
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid API base URL",
      responseTimeMs: 0,
    };
  }

  const url = new URL(apiUrl);
  url.searchParams.set("action", "query");
  url.searchParams.set("meta", "siteinfo");
  url.searchParams.set("siprop", "general");
  url.searchParams.set("format", "json");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": input.userAgent.trim(),
  };
  if (input.accessToken?.trim()) {
    headers.Authorization = `Bearer ${input.accessToken.trim()}`;
  }

  const started = Date.now();
  try {
    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    const responseTimeMs = Date.now() - started;
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        message: `${input.label} siteinfo failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        responseTimeMs,
      };
    }
    let sitename: string | undefined;
    try {
      const json = JSON.parse(body) as {
        query?: { general?: { sitename?: string; servername?: string } };
      };
      sitename = json.query?.general?.sitename || json.query?.general?.servername;
    } catch {
      /* ignore parse errors — HTTP OK is enough */
    }
    return {
      ok: true,
      message: sitename
        ? `Connected to ${input.label} — ${sitename} (${responseTimeMs}ms).`
        : `Connected to ${input.label} — siteinfo OK (${responseTimeMs}ms).`,
      responseTimeMs,
      sitename,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : `${input.label} connection failed`,
      responseTimeMs: Date.now() - started,
    };
  }
}

// —— Wikipedia ——

export async function getWikipediaConfig(): Promise<MediaWikiIntegrationConfig> {
  return getMediaWikiConfig(WIKIPEDIA_SLUG);
}

export async function getWikipediaPublicConfig(): Promise<MediaWikiPublicConfig> {
  const config = await getWikipediaConfig();
  return toMediaWikiPublicConfig(config, {
    envUserAgent: process.env.WIKIPEDIA_USER_AGENT,
    envBaseUrl: process.env.WIKIPEDIA_API_BASE_URL,
    envAccessToken: process.env.WIKIPEDIA_ACCESS_TOKEN,
    defaultBaseUrl: DEFAULT_WIKIPEDIA_API_BASE_URL,
    docsUrl: "https://www.mediawiki.org/wiki/API:Main_page",
  });
}

/** Resolved settings for app code (env → CMS → defaults). */
export async function getWikipediaSettings(): Promise<ResolvedMediaWikiSettings> {
  const config = await getWikipediaConfig();
  return resolveMediaWikiSettingsSync(config, {
    userAgent: process.env.WIKIPEDIA_USER_AGENT,
    baseUrl: process.env.WIKIPEDIA_API_BASE_URL,
    accessToken: process.env.WIKIPEDIA_ACCESS_TOKEN,
    defaultBaseUrl: DEFAULT_WIKIPEDIA_API_BASE_URL,
  });
}

export async function saveWikipediaSettings(input: {
  enabled?: boolean;
  userAgent?: string;
  apiBaseUrl?: string;
  accessToken?: string;
  clearAccessToken?: boolean;
}): Promise<MediaWikiPublicConfig> {
  await saveMediaWikiConfig(WIKIPEDIA_SLUG, "Wikipedia", input, DEFAULT_WIKIPEDIA_API_BASE_URL);
  return getWikipediaPublicConfig();
}

export async function clearWikipediaSettings(input?: {
  clearAccessToken?: boolean;
  resetToDefaults?: boolean;
}): Promise<MediaWikiPublicConfig> {
  await clearMediaWikiSecrets(WIKIPEDIA_SLUG, "Wikipedia", input);
  return getWikipediaPublicConfig();
}

export async function revealWikipediaAccessTokenFromCms(): Promise<RevealSecretResult> {
  if (process.env.WIKIPEDIA_ACCESS_TOKEN?.trim()) {
    return { status: "env_only", message: ENV_REVEAL_MESSAGE };
  }
  const config = await getWikipediaConfig();
  const secret = config.accessToken?.trim();
  if (!secret) {
    return { status: "missing", message: "No Wikipedia access token stored in CMS." };
  }
  return { status: "ok", secret };
}

export async function testWikipediaConnection(input?: {
  userAgent?: string;
  apiBaseUrl?: string;
  accessToken?: string;
}): Promise<{ ok: boolean; message: string; responseTimeMs: number; sitename?: string }> {
  const resolved = await getWikipediaSettings();
  if (!resolved.enabled && !input?.userAgent && !input?.apiBaseUrl) {
    return {
      ok: false,
      message: "Wikipedia integration is disabled. Enable it and save before testing.",
      responseTimeMs: 0,
    };
  }
  return testMediaWikiSiteInfo({
    label: "Wikipedia",
    userAgent: input?.userAgent?.trim() || resolved.userAgent,
    apiBaseUrl: input?.apiBaseUrl?.trim() || resolved.apiBaseUrl,
    accessToken: input?.accessToken?.trim() || resolved.accessToken,
  });
}

// —— Wikidata ——

export async function getWikidataConfig(): Promise<MediaWikiIntegrationConfig> {
  return getMediaWikiConfig(WIKIDATA_SLUG);
}

export async function getWikidataPublicConfig(): Promise<MediaWikiPublicConfig> {
  const config = await getWikidataConfig();
  return toMediaWikiPublicConfig(config, {
    envUserAgent: process.env.WIKIDATA_USER_AGENT,
    envBaseUrl: process.env.WIKIDATA_API_BASE_URL,
    envAccessToken: process.env.WIKIDATA_ACCESS_TOKEN,
    defaultBaseUrl: DEFAULT_WIKIDATA_API_BASE_URL,
    docsUrl: "https://www.wikidata.org/wiki/Wikidata:Data_access",
  });
}

/** Resolved settings for app code (env → CMS → defaults). */
export async function getWikidataSettings(): Promise<ResolvedMediaWikiSettings> {
  const config = await getWikidataConfig();
  return resolveMediaWikiSettingsSync(config, {
    userAgent: process.env.WIKIDATA_USER_AGENT,
    baseUrl: process.env.WIKIDATA_API_BASE_URL,
    accessToken: process.env.WIKIDATA_ACCESS_TOKEN,
    defaultBaseUrl: DEFAULT_WIKIDATA_API_BASE_URL,
  });
}

export async function saveWikidataSettings(input: {
  enabled?: boolean;
  userAgent?: string;
  apiBaseUrl?: string;
  accessToken?: string;
  clearAccessToken?: boolean;
}): Promise<MediaWikiPublicConfig> {
  await saveMediaWikiConfig(WIKIDATA_SLUG, "Wikidata", input, DEFAULT_WIKIDATA_API_BASE_URL);
  return getWikidataPublicConfig();
}

export async function clearWikidataSettings(input?: {
  clearAccessToken?: boolean;
  resetToDefaults?: boolean;
}): Promise<MediaWikiPublicConfig> {
  await clearMediaWikiSecrets(WIKIDATA_SLUG, "Wikidata", input);
  return getWikidataPublicConfig();
}

export async function revealWikidataAccessTokenFromCms(): Promise<RevealSecretResult> {
  if (process.env.WIKIDATA_ACCESS_TOKEN?.trim()) {
    return { status: "env_only", message: ENV_REVEAL_MESSAGE };
  }
  const config = await getWikidataConfig();
  const secret = config.accessToken?.trim();
  if (!secret) {
    return { status: "missing", message: "No Wikidata access token stored in CMS." };
  }
  return { status: "ok", secret };
}

export async function testWikidataConnection(input?: {
  userAgent?: string;
  apiBaseUrl?: string;
  accessToken?: string;
}): Promise<{ ok: boolean; message: string; responseTimeMs: number; sitename?: string }> {
  const resolved = await getWikidataSettings();
  if (!resolved.enabled && !input?.userAgent && !input?.apiBaseUrl) {
    return {
      ok: false,
      message: "Wikidata integration is disabled. Enable it and save before testing.",
      responseTimeMs: 0,
    };
  }
  return testMediaWikiSiteInfo({
    label: "Wikidata",
    userAgent: input?.userAgent?.trim() || resolved.userAgent,
    apiBaseUrl: input?.apiBaseUrl?.trim() || resolved.apiBaseUrl,
    accessToken: input?.accessToken?.trim() || resolved.accessToken,
  });
}

