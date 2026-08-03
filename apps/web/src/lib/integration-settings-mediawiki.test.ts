import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_WIKIDATA_API_BASE_URL,
  DEFAULT_WIKIMEDIA_USER_AGENT,
  DEFAULT_WIKIPEDIA_API_BASE_URL,
  getWikidataPublicConfig,
  getWikidataSettings,
  getWikipediaPublicConfig,
  getWikipediaSettings,
} from "./integration-settings-service";

vi.mock("./db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  }),
}));

describe("Wikipedia / Wikidata MediaWiki settings", () => {
  const envKeys = [
    "WIKIPEDIA_USER_AGENT",
    "WIKIPEDIA_API_BASE_URL",
    "WIKIPEDIA_ACCESS_TOKEN",
    "WIKIDATA_USER_AGENT",
    "WIKIDATA_API_BASE_URL",
    "WIKIDATA_ACCESS_TOKEN",
  ] as const;
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });

  it("uses Wikipedia defaults when nothing is configured", async () => {
    const publicConfig = await getWikipediaPublicConfig();
    expect(publicConfig.enabled).toBe(true);
    expect(publicConfig.configured).toBe(true);
    expect(publicConfig.userAgent).toBe(DEFAULT_WIKIMEDIA_USER_AGENT);
    expect(publicConfig.apiBaseUrl).toBe(DEFAULT_WIKIPEDIA_API_BASE_URL);
    expect(publicConfig.hasAccessToken).toBe(false);
    expect(publicConfig.userAgentSource).toBe("default");
    expect(publicConfig.apiBaseUrlSource).toBe("default");

    const settings = await getWikipediaSettings();
    expect(settings.enabled).toBe(true);
    expect(settings.userAgent).toBe(DEFAULT_WIKIMEDIA_USER_AGENT);
    expect(settings.apiBaseUrl).toBe(DEFAULT_WIKIPEDIA_API_BASE_URL);
    expect(settings.accessToken).toBeNull();
  });

  it("uses Wikidata defaults when nothing is configured", async () => {
    const publicConfig = await getWikidataPublicConfig();
    expect(publicConfig.enabled).toBe(true);
    expect(publicConfig.configured).toBe(true);
    expect(publicConfig.apiBaseUrl).toBe(DEFAULT_WIKIDATA_API_BASE_URL);
    expect(publicConfig.hasAccessToken).toBe(false);

    const settings = await getWikidataSettings();
    expect(settings.apiBaseUrl).toBe(DEFAULT_WIKIDATA_API_BASE_URL);
    expect(settings.accessToken).toBeNull();
  });

  it("prefers environment overrides and masks access tokens", async () => {
    process.env.WIKIPEDIA_USER_AGENT = "Rugby365Bot/2.0 (contact=ops@example.com)";
    process.env.WIKIPEDIA_API_BASE_URL = "https://en.wikipedia.org/w/api.php";
    process.env.WIKIPEDIA_ACCESS_TOKEN = "wiki-secret-token-value";
    process.env.WIKIDATA_ACCESS_TOKEN = "wd-secret-token-value";

    const wikipedia = await getWikipediaPublicConfig();
    expect(wikipedia.userAgentSource).toBe("environment");
    expect(wikipedia.apiBaseUrlSource).toBe("environment");
    expect(wikipedia.accessTokenSource).toBe("environment");
    expect(wikipedia.hasAccessToken).toBe(true);
    expect(wikipedia.accessTokenMasked).toMatch(/•/);
    expect(wikipedia.accessTokenMasked).not.toContain("wiki-secret-token-value");

    const wikidata = await getWikidataPublicConfig();
    expect(wikidata.accessTokenSource).toBe("environment");
    expect(wikidata.accessTokenMasked).toMatch(/•/);
    expect(wikidata.accessTokenMasked).not.toContain("wd-secret-token-value");

    const settings = await getWikipediaSettings();
    expect(settings.userAgent).toBe("Rugby365Bot/2.0 (contact=ops@example.com)");
    expect(settings.accessToken).toBe("wiki-secret-token-value");
  });
});
