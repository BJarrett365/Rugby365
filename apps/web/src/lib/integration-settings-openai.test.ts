import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getOpenAiPublicConfig } from "./integration-settings-service";

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

describe("getOpenAiPublicConfig", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  });

  it("reports none when no key is configured", async () => {
    const config = await getOpenAiPublicConfig();
    expect(config.configured).toBe(false);
    expect(config.keySource).toBe("none");
    expect(config.model).toBe("gpt-4o-mini");
  });

  it("prefers environment key over stored config", async () => {
    process.env.OPENAI_API_KEY = "sk-test-environment-key";
    const config = await getOpenAiPublicConfig();
    expect(config.configured).toBe(true);
    expect(config.keySource).toBe("environment");
    expect(config.apiKeyMasked).toContain("…");
  });
});
