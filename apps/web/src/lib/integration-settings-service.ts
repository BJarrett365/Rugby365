import { eq } from "drizzle-orm";
import { integrationSettings } from "@rugby365/db";
import { getDb } from "./db";

export const WIKIMEDIA_ENTERPRISE_SLUG = "wikimedia_enterprise";
export const OPENAI_SLUG = "openai";
export const RUGBY_DATA_API_SLUG = "rugby_data_api";

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
