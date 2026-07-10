import { describe, expect, it } from "vitest";
import { parseTransferListFilters } from "./transfer-filters";

describe("parseTransferListFilters", () => {
  it("parses season, team, player and movement filters", () => {
    const params = new URLSearchParams({
      seasonId: "season-1",
      teamId: "team-bath",
      playerId: "player-1",
      movementType: "loan",
      search: "Smith",
      page: "2",
      pageSize: "50",
      sortBy: "playerName",
      sortDir: "asc",
    });
    expect(parseTransferListFilters(params)).toEqual({
      seasonId: "season-1",
      competitionId: undefined,
      teamId: "team-bath",
      playerId: "player-1",
      movementType: "loan",
      transferType: undefined,
      search: "Smith",
      page: 2,
      pageSize: 50,
      sortBy: "playerName",
      sortDir: "asc",
    });
  });

  it("defaults sort direction to desc", () => {
    const params = new URLSearchParams({ sortBy: "effectiveDate" });
    expect(parseTransferListFilters(params).sortDir).toBe("desc");
  });

  it("parses international transfer scope", () => {
    const params = new URLSearchParams({ transferType: "international" });
    expect(parseTransferListFilters(params).transferType).toBe("international");
  });
});
