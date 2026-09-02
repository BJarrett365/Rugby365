import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_STATS_PERFORM_SDAPI_BASE_URL,
} from "./stats-perform-sdapi-client";
import { getStatsPerformSdapiPublicConfig } from "./integration-settings-service";

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

describe("getStatsPerformSdapiPublicConfig", () => {
  const envKeys = [
    "STATS_PERFORM_DOCS_USERNAME",
    "STATS_PERFORM_DOCS_PASSWORD",
    "STATS_PERFORM_OUTLET_AUTH_KEY",
    "STATS_PERFORM_SDAPI_BASE_URL",
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

  it("uses the default Perform Feeds URL and docs sample outlet key when nothing is stored", async () => {
    const config = await getStatsPerformSdapiPublicConfig();
    expect(config.baseUrl).toBe(DEFAULT_STATS_PERFORM_SDAPI_BASE_URL);
    expect(config.baseUrlSource).toBe("default");
    expect(config.docsConfigured).toBe(false);
    expect(config.apiConfigured).toBe(true);
    expect(config.outletAuthKeySource).toBe("docs");
    expect(config.configured).toBe(true);
  });

  it("prefers environment credentials and masks secrets", async () => {
    process.env.STATS_PERFORM_DOCS_USERNAME = "statsperformdocs";
    process.env.STATS_PERFORM_DOCS_PASSWORD = "docs-password-value";
    process.env.STATS_PERFORM_OUTLET_AUTH_KEY = "abcdefghijklmnopqrstuvwxyz";
    process.env.STATS_PERFORM_SDAPI_BASE_URL = "https://api.performfeeds.com/";
    const config = await getStatsPerformSdapiPublicConfig();
    expect(config.docsConfigured).toBe(true);
    expect(config.apiConfigured).toBe(true);
    expect(config.docsUsername).toBe("statsperformdocs");
    expect(config.docsPasswordMasked).toMatch(/•/);
    expect(config.outletAuthKeyMasked).toMatch(/•/);
    expect(config.outletAuthKeySource).toBe("environment");
    expect(config.baseUrl).toBe("https://api.performfeeds.com");
    expect(config.baseUrlSource).toBe("environment");
  });
});
