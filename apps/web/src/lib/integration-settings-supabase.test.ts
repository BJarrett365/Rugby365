import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  assertSupabaseAnonOrServiceKey,
  assertSupabaseProjectUrl,
  getSupabasePublicConfig,
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

describe("getSupabasePublicConfig", () => {
  const keys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (originals[key] === undefined) delete process.env[key];
      else process.env[key] = originals[key];
    }
  });

  it("reports unconfigured when nothing is set", async () => {
    const config = await getSupabasePublicConfig();
    expect(config.configured).toBe(false);
    expect(config.projectUrlSource).toBe("none");
    expect(config.hasAnonKey).toBe(false);
    expect(config.hasServiceRoleKey).toBe(false);
  });

  it("prefers environment URL and keys", async () => {
    process.env.SUPABASE_URL = "https://demo.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-environment-key-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-environment-key-value";
    const config = await getSupabasePublicConfig();
    expect(config.configured).toBe(true);
    expect(config.anonConfigured).toBe(true);
    expect(config.projectUrl).toBe("https://demo.supabase.co");
    expect(config.projectUrlHost).toBe("demo.supabase.co");
    expect(config.projectUrlSource).toBe("environment");
    expect(config.anonKeySource).toBe("environment");
    expect(config.serviceRoleKeySource).toBe("environment");
    expect(config.anonKeyMasked).toMatch(/•/);
    expect(config.serviceRoleKeyMasked).toMatch(/•/);
    expect(config.serviceRoleKeyMasked).toMatch(/alue$/);
  });
});

describe("assertSupabaseProjectUrl / keys", () => {
  it("accepts project API hosts and rejects dashboard URLs", () => {
    expect(assertSupabaseProjectUrl("https://abcd.supabase.co/")).toBe("https://abcd.supabase.co");
    expect(() => assertSupabaseProjectUrl("https://supabase.com/dashboard/account/tokens")).toThrow(
      /Project API URL/,
    );
  });

  it("rejects personal access tokens", () => {
    expect(() => assertSupabaseAnonOrServiceKey("sbp_secret", "Anon key")).toThrow(/personal access token/);
    expect(assertSupabaseAnonOrServiceKey("eyJhbGciOi.test", "Anon key")).toBe("eyJhbGciOi.test");
  });
});
