import { describe, expect, it } from "vitest";
import type { TeamClassificationContext } from "./international-team-classify";
import {
  resolvePlayerInternationalStatus,
  resolveTransferPosition,
  transferClubImageUrl,
} from "./public-transfers-service";

function mockCtx(overrides?: Partial<TeamClassificationContext>): TeamClassificationContext {
  return {
    internationalTeamIds: new Set(["intl-eng"]),
    clubTeamIds: new Set(["club-bath"]),
    internationalNameKeys: new Set(["england"]),
    clubNameKeys: new Set(["bath"]),
    teamNameById: new Map([
      ["intl-eng", "England"],
      ["club-bath", "Bath"],
    ]),
    ...overrides,
  };
}

describe("public transfer display helpers", () => {
  it("prefers transfer position then player position", () => {
    expect(resolveTransferPosition("Fly-half", "Centre")).toBe("Fly-half");
    expect(resolveTransferPosition(null, "Hooker")).toBe("Hooker");
    expect(resolveTransferPosition("  ", null)).toBeNull();
  });

  it("sets international status from player database fields", () => {
    const ctx = mockCtx();

    expect(
      resolvePlayerInternationalStatus(ctx, {
        nationCode: "WAL",
        internationalTeamId: "intl-eng",
        internationalTeamName: "England",
        countryName: "Wales",
      }),
    ).toBe("Wales");

    expect(
      resolvePlayerInternationalStatus(ctx, {
        nationCode: null,
        internationalTeamId: "intl-eng",
        internationalTeamName: "England",
        countryName: null,
      }),
    ).toBe("England");

    expect(
      resolvePlayerInternationalStatus(ctx, {
        nationCode: null,
        internationalTeamId: "club-bath",
        internationalTeamName: "Bath",
        countryName: "England",
        clubName: "Bath",
      }),
    ).toBe("England");

    expect(
      resolvePlayerInternationalStatus(ctx, {
        nationCode: null,
        internationalTeamId: "club-bath",
        internationalTeamName: "Bath",
        countryName: "Bath",
        clubName: "Bath",
      }),
    ).toBeNull();

    expect(
      resolvePlayerInternationalStatus(ctx, {
        nationCode: "UN",
        countryName: "England",
        clubName: "Ulster",
      }),
    ).toBe("England");

    expect(
      resolvePlayerInternationalStatus(ctx, {
        nationCode: "UN",
        countryName: null,
        clubName: "Saracens",
      }),
    ).toBeNull();
  });

  it("attaches club crests for real clubs and skips released/retired", () => {
    expect(transferClubImageUrl("Bath", "https://cdn.example/bath.png", "Bath")).toBe(
      "https://cdn.example/bath.png",
    );
    expect(transferClubImageUrl("Released", "https://cdn.example/bath.png")).toBeNull();
    expect(transferClubImageUrl("—", null)).toBeNull();
  });
});
