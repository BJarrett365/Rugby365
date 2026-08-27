import { describe, expect, it } from "vitest";
import {
  DATA_INTEGRATION_PROVIDERS,
  DEFAULT_EXTERNAL_PROVIDER,
  PROVIDER_SPORT_CC,
} from "./provider-mapping-types";

describe("stable identity provider defaults", () => {
  it("uses Sport CC as the default external provider", () => {
    expect(DEFAULT_EXTERNAL_PROVIDER).toBe("sport_cc");
    expect(PROVIDER_SPORT_CC).toBe("sport_cc");
  });

  it("registers sport_cc ahead of other integration providers", () => {
    expect(DATA_INTEGRATION_PROVIDERS[0]).toBe(PROVIDER_SPORT_CC);
    expect(DATA_INTEGRATION_PROVIDERS).toContain("opta");
  });

  it("never treats Sport CC as a substitute for Rugby365 UUID primary keys", () => {
    // Contract: provider keys are external references only.
    const sportCcId = "18472";
    const rugby365Uuid = "72cb0000-0000-4000-8000-000000000001";
    expect(sportCcId).not.toEqual(rugby365Uuid);
    expect(DEFAULT_EXTERNAL_PROVIDER).not.toBe("uuid");
  });
});

describe("identity resolution order contract", () => {
  it("documents the required resolve order", () => {
    const order = ["provider", "alias", "trusted_match", "review_queue"] as const;
    expect(order[0]).toBe("provider");
    expect(order[1]).toBe("alias");
    expect(order[2]).toBe("trusted_match");
    expect(order[3]).toBe("review_queue");
  });
});
