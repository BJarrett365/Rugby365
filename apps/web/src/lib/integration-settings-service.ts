import { eq } from "drizzle-orm";
import { integrationSettings } from "@rugby365/db";
import { getDb } from "./db";

export const WIKIMEDIA_ENTERPRISE_SLUG = "wikimedia_enterprise";
export const OPENAI_SLUG = "openai";
export const RUGBY_DATA_API_SLUG = "rugby_data_api";
export const SUPABASE_SLUG = "supabase";

export const DEFAULT_RUGBY_DATA_API_BASE_URL =
  "https://cms-planetrugby-players-investigator-for-barrie.hneeds.com";

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

function maskSecret(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 3)}…${trimmed.slice(-4)}`;
}

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

export async function resolveOpenAiModel(): Promise<string> {
  const env = process.env.OPENAI_MODEL?.trim();
  if (env) return env;
  const config = await getOpenAiConfig();
  return config.model?.trim() || "gpt-4o-mini";
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
  hasAnonKey: boolean;
  anonKeyMasked?: string;
  hasServiceRoleKey: boolean;
  serviceRoleKeyMasked?: string;
  configured: boolean;
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

  return {
    projectUrl,
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
    configured: Boolean(projectUrl && anonKeySource !== "none"),
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
  clearAnonKey?: boolean;
  clearServiceRoleKey?: boolean;
}): Promise<SupabasePublicConfig> {
  const db = getDb();
  const existing = await getSupabaseConfig();
  const next: SupabaseConfig = {
    projectUrl: existing.projectUrl,
  };

  const clearAnon = input?.clearAnonKey !== false;
  const clearService = input?.clearServiceRoleKey !== false;

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

export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  projectUrl: string | null;
  responseTimeMs: number;
}> {
  const projectUrl = await resolveSupabaseProjectUrl();
  const anonKey = await resolveSupabaseAnonKey();
  if (!projectUrl) {
    return { ok: false, message: "No Supabase project URL configured.", projectUrl: null, responseTimeMs: 0 };
  }
  if (!anonKey) {
    return {
      ok: false,
      message: "No Supabase anon/publishable key configured.",
      projectUrl,
      responseTimeMs: 0,
    };
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

  if (looksLikeSupabasePersonalAccessToken(anonKey)) {
    return {
      ok: false,
      message:
        "Anon key looks like a personal access token (sbp_…). Use the project anon key from Project Settings → API (usually starts with eyJ).",
      projectUrl,
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
          responseTimeMs,
        };
      }
      return {
        ok: false,
        message: `Supabase health check failed (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`,
        projectUrl,
        responseTimeMs,
      };
    }
    return {
      ok: true,
      message: "Connected — Auth health endpoint responded OK.",
      projectUrl,
      responseTimeMs,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Connection failed",
      projectUrl,
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

