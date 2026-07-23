import { describe, expect, it } from "vitest";
import { hashPayload, sanitizeRequestParams } from "./rugby-data-api-client";

describe("sanitizeRequestParams", () => {
  it("redacts token and secret keys", () => {
    const sanitized = sanitizeRequestParams({
      path: "/api/v1/rugby-union/teams",
      token: "super-secret-token",
      Authorization: "Bearer abc",
      api_key: "key",
      match_type: "finished",
    });
    expect(sanitized.token).toBe("[redacted]");
    expect(sanitized.Authorization).toBe("[redacted]");
    expect(sanitized.api_key).toBe("[redacted]");
    expect(sanitized.match_type).toBe("finished");
    expect(sanitized.path).toBe("/api/v1/rugby-union/teams");
  });
});

describe("hashPayload", () => {
  it("returns stable sha256 hex", () => {
    const a = hashPayload({ status: 200, data: [1, 2] });
    const b = hashPayload({ status: 200, data: [1, 2] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
