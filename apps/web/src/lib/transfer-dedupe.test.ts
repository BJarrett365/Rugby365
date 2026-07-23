import { describe, expect, it } from "vitest";
import {
  buildSemanticTransferKey,
  buildWikiSemanticImportKey,
  isNoOpClubChange,
  scoreTransferKeeper,
} from "./transfer-dedupe";

describe("transfer-dedupe", () => {
  it("builds the same semantic key for In and Out club listings", () => {
    const a = buildWikiSemanticImportKey({
      seasonLabel: "2026–27",
      playerName: "Dan du Preez",
      fromClub: "Sale Sharks",
      toClub: "Bath",
      movementType: "permanent",
    });
    const b = buildWikiSemanticImportKey({
      seasonLabel: "2026–27",
      playerName: "Dan du Preez",
      fromClub: "Sale Sharks",
      toClub: "Bath",
      movementType: "permanent",
    });
    expect(a).toBe(b);
    expect(a).toContain("dan-du-preez");
    expect(a).not.toContain(":in:");
    expect(a).not.toContain(":out:");
  });

  it("treats same from/to club as no-op for permanent moves", () => {
    expect(
      isNoOpClubChange({
        fromClub: "Saracens",
        toClub: "Saracens",
        movementType: "permanent",
      }),
    ).toBe(true);
    expect(
      isNoOpClubChange({
        fromTeamId: "aaa",
        toTeamId: "aaa",
        movementType: "permanent",
      }),
    ).toBe(true);
    expect(
      isNoOpClubChange({
        fromClub: "Saracens",
        toClub: "Exeter Chiefs",
        movementType: "permanent",
      }),
    ).toBe(false);
  });

  it("prefers linked teams and source URL when scoring keepers", () => {
    const weak = scoreTransferKeeper({
      id: "1",
      playerId: "p",
      seasonId: null,
      movementType: "permanent",
      fromTeamId: null,
      toTeamId: null,
      fromClub: "Saracens",
      toClub: "Exeter",
      effectiveDate: null,
      sourceUrl: null,
      sourceProvider: "manual",
      importKey: null,
      notes: null,
      positionName: null,
    });
    const strong = scoreTransferKeeper({
      id: "2",
      playerId: "p",
      seasonId: null,
      movementType: "permanent",
      fromTeamId: "a",
      toTeamId: "b",
      fromClub: "Saracens",
      toClub: "Exeter",
      effectiveDate: new Date("2026-07-12"),
      sourceUrl: "https://en.wikipedia.org/wiki/x",
      sourceProvider: "wikipedia",
      importKey: "key",
      notes: null,
      positionName: null,
    });
    expect(strong).toBeGreaterThan(weak);
  });

  it("uses resolved club names in semantic keys", () => {
    const teamNameById = new Map([
      ["from-id", "Saracens"],
      ["to-id", "Exeter Chiefs"],
    ]);
    const withIds = buildSemanticTransferKey({
      playerId: "player-1",
      seasonId: "season-1",
      movementType: "permanent",
      fromTeamId: "from-id",
      toTeamId: "to-id",
      teamNameById,
    });
    const withNames = buildSemanticTransferKey({
      playerId: "player-1",
      seasonId: "season-1",
      movementType: "permanent",
      fromClub: "Saracens",
      toClub: "Exeter Chiefs",
      teamNameById,
    });
    expect(withIds).toBe(withNames);
  });
});
