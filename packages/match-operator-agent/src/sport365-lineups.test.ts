import { describe, expect, it } from "vitest";
import { parseSport365Lineups } from "./sport365-lineups";

describe("sport365 lineups", () => {
  it("parses starting XV and substitutes by team position", () => {
    const lineups = parseSport365Lineups(
      [
        {
          pos: 0,
          starting: [
            { id: "1-1", name: "Player One", j_num: 1, a_pos: 1 },
            { id: "1-2", name: "Player Two", j_num: 2, a_pos: 2 },
          ],
          substitutes: [{ id: "1-16", name: "Sub One", j_num: 16, a_pos: 16 }],
        },
        {
          pos: 1,
          starting: [{ id: "2-15", name: "Away Fullback", j_num: 15, a_pos: 15 }],
          substitutes: [],
        },
      ],
      "Home FC",
      "Away FC",
      "1-home",
      "1-away",
    );

    expect(lineups?.home.teamName).toBe("Home FC");
    expect(lineups?.home.starting.map((p) => p.name)).toEqual(["Player One", "Player Two"]);
    expect(lineups?.home.substitutes[0]?.name).toBe("Sub One");
    expect(lineups?.away.starting[0]?.name).toBe("Away Fullback");
  });
});
