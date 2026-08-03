import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_RUGBY_DATA_API_BASE_URL,
  getRugbyDataApiPublicConfig,
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

describe("getRugbyDataApiPublicConfig", () => {
  const originalToken = process.env.RUGBY_DATA_API_TOKEN;
  const originalBase = process.env.RUGBY_DATA_API_BASE_URL;

  beforeEach(() => {
    delete process.env.RUGBY_DATA_API_TOKEN;
    delete process.env.RUGBY_DATA_API_BASE_URL;
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.RUGBY_DATA_API_TOKEN;
    else process.env.RUGBY_DATA_API_TOKEN = originalToken;
    if (originalBase === undefined) delete process.env.RUGBY_DATA_API_BASE_URL;
    else process.env.RUGBY_DATA_API_BASE_URL = originalBase;
  });

  it("uses default base URL when nothing is configured", async () => {
    const config = await getRugbyDataApiPublicConfig();
    expect(config.configured).toBe(true);
    expect(config.tokenSource).toBe("none");
    expect(config.baseUrlSource).toBe("default");
    expect(config.baseUrl).toBe(DEFAULT_RUGBY_DATA_API_BASE_URL);
  });

  it("prefers environment token and base URL", async () => {
    process.env.RUGBY_DATA_API_TOKEN = "test-environment-token-value";
    process.env.RUGBY_DATA_API_BASE_URL = "https://example.test";
    const config = await getRugbyDataApiPublicConfig();
    expect(config.tokenSource).toBe("environment");
    expect(config.baseUrlSource).toBe("environment");
    expect(config.hasApiToken).toBe(true);
    expect(config.apiTokenMasked).toMatch(/•/);
    expect(config.baseUrl).toBe("https://example.test");
  });
});
