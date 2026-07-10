import { describe, expect, it } from "vitest";
import { parseExeterChiefsRscSquad } from "./fetch-mens-squad";

describe("parseExeterChiefsRscSquad", () => {
  it("extracts player names and position titles only from positions array", () => {
    const payload = `
      "playerName":"Henry Slade","positions":[{"_type":"position","title":"Centre"}]},
      {"_type":"player","metadata":{"title":"Ethan Burger"},
      "playerName":"Ethan Burger","positions":[{"_type":"position","title":"Prop"}]}
    `;
    const players = parseExeterChiefsRscSquad(payload);
    expect(players).toEqual([
      { name: "Ethan Burger", positionName: "Prop", squadNumber: null, profileUrl: null },
      { name: "Henry Slade", positionName: "Centre", squadNumber: null, profileUrl: null },
    ]);
  });
});
