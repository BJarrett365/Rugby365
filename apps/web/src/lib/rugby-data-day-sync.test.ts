import { describe, expect, it } from "vitest";
import {
  buildRugbyDataEventId,
  filterRugbyDataMatchesOnDate,
  flattenRugbyDataDayMatches,
  listedMatchIdentityKey,
  parseRugbyDataScore,
  rugbyDataEventTypeToMatchEvent,
  rugbyDataStatusToFixtureStatus,
} from "./rugby-data-day-sync";

describe("rugby-data-day-sync helpers", () => {
  it("flattens nested league match lists and filters by date", () => {
    const flat = flattenRugbyDataDayMatches([
      {
        id: 218,
        nm: "Currie Cup",
        sea: "2026",
        matches: [
          {
            id: 8909,
            dt: "2026-07-24 15:00:00",
            ft: "43-21",
            st: "Finished",
            competitors: { htn: "Cheetahs", atn: "Sharks" },
          },
          {
            id: 8910,
            dt: "2026-07-25 13:00:00",
            ft: "52-29",
            st: "Finished",
            competitors: { htn: "Lions", atn: "Pumas" },
          },
        ],
      },
    ]);
    expect(flat).toHaveLength(2);
    expect(flat[0].league).toBe("Currie Cup");
    expect(filterRugbyDataMatchesOnDate(flat, "2026-07-24")).toHaveLength(1);
    expect(listedMatchIdentityKey(flat[0])).toBe("2026-07-24:cheetahs:sharks");
  });

  it("parses scores and maps statuses/events", () => {
    expect(parseRugbyDataScore("43-21")).toEqual({ homeScore: 43, awayScore: 21 });
    expect(parseRugbyDataScore("")).toBeNull();
    expect(rugbyDataStatusToFixtureStatus("Finished")).toBe("full_time");
    expect(rugbyDataStatusToFixtureStatus("Result only")).toBe("full_time");
    expect(rugbyDataStatusToFixtureStatus("result")).toBe("full_time");
    expect(rugbyDataStatusToFixtureStatus("inprogress")).toBe("live");
    expect(rugbyDataEventTypeToMatchEvent("Try")).toBe("try");
    expect(rugbyDataEventTypeToMatchEvent("Missed conversion")).toBe("conversion_missed");
    expect(rugbyDataEventTypeToMatchEvent("Missed penalty")).toBe("penalty_missed");
    expect(rugbyDataEventTypeToMatchEvent("Missed drop goal")).toBe("drop_goal_missed");
    expect(rugbyDataEventTypeToMatchEvent("Yellow card")).toBe("yellow_card");
  });

  it("builds stable rugby_data event ids", () => {
    const id = buildRugbyDataEventId(
      8909,
      { ty: "Try", mins: 3, isH: 1, pl: { id: 6503, name: "Nkabinde Prince" } },
      0,
    );
    expect(id).toBe("rd:8909:try:3:6503:h:0");
  });
});
