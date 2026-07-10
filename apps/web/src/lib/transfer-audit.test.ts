import { describe, expect, it } from "vitest";
import { computeTransferAuditStatuses } from "./transfer-audit-utils";
import {
  resolveTransferSourceConfidence,
  resolveTransferSourceLabel,
} from "./transfer-source-utils";

describe("transfer-source-utils", () => {
  it("maps wikipedia provider to label", () => {
    expect(resolveTransferSourceLabel("wikipedia")).toBe("Wikipedia");
  });

  it("scores wikipedia with url as high confidence", () => {
    expect(
      resolveTransferSourceConfidence({
        sourceProvider: "wikipedia",
        sourceUrl: "https://en.wikipedia.org/wiki/Foo",
        importKey: "abc",
        fromTeamId: "1",
        toTeamId: "2",
        effectiveDate: new Date(),
      }),
    ).toBe("high");
  });
});

describe("transfer-audit-utils", () => {
  it("flags missing source and date", () => {
    const statuses = computeTransferAuditStatuses({
      id: "1",
      playerId: "p1",
      movementType: "permanent",
      fromTeamId: null,
      toTeamId: null,
      fromClub: null,
      toClub: null,
      effectiveDate: null,
      sourceProvider: "unknown",
      sourceUrl: null,
      importKey: null,
      seasonId: null,
    });
    expect(statuses).toContain("missing_source");
    expect(statuses).toContain("date_missing");
    expect(statuses).toContain("missing_club_in");
    expect(statuses).toContain("missing_club_out");
  });

  it("marks clean transfer as confirmed", () => {
    const statuses = computeTransferAuditStatuses({
      id: "1",
      playerId: "p1",
      movementType: "permanent",
      fromTeamId: "a",
      toTeamId: "b",
      fromClub: "Bath",
      toClub: "Saints",
      effectiveDate: new Date(),
      sourceProvider: "wikipedia",
      sourceUrl: "https://en.wikipedia.org/wiki/Foo",
      importKey: "key",
      seasonId: "s1",
      playerClubTeamId: "b",
    });
    expect(statuses).toEqual(["confirmed"]);
  });
});
