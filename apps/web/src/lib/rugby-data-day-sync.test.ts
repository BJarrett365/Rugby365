import { describe, expect, it } from "vitest";
import {
  buildRugbyDataEventId,
  filterRugbyDataMatchesOnDate,
  flattenRugbyDataDayMatches,
  listedMatchIdentityKey,
  parseRugbyDataScore,
  pickRugbyDataSyncCandidate,
  pickRugbyDataSyncCandidateByExternalId,
  rugbyDataCandidateNameKeys,
  rugbyDataEventTypeToMatchEvent,
  rugbyDataStatusToFixtureStatus,
  teamNameKey,
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

  it("matches unknown-named clones via fixture slug and picks the best duplicate", () => {
    expect(
      rugbyDataCandidateNameKeys({
        id: "u",
        slug: "counties-manukau-v-tasman-2026-08-16__legacy__1966f110",
        homeName: "Unknown team 528a75ca0173",
        awayName: "Tasman",
      }),
    ).toContain("counties manukau:tasman");

    const picked = pickRugbyDataSyncCandidate(
      [
        {
          id: "unknown-legacy",
          slug: "auckland-v-wellington-2026-08-08__legacy__016700a7",
          homeName: "Unknown team 4b02e612985e",
          awayName: "Wellington",
          status: "scheduled",
          homeScore: 0,
          awayScore: 0,
        },
        {
          id: "zero-legacy",
          slug: "auckland-v-wellington-2026-08-08__legacy__65c0a39c",
          homeName: "Auckland",
          awayName: "Wellington",
          status: "scheduled",
          homeScore: 0,
          awayScore: 0,
        },
        {
          id: "canonical",
          slug: "auckland-v-wellington-2026-08-08",
          homeName: "Auckland",
          awayName: "Wellington",
          status: "scheduled",
          homeScore: 0,
          awayScore: 0,
        },
      ],
      "auckland:wellington",
    );
    expect(picked?.id).toBe("canonical");
  });

  it("aliases French club names onto one identity key", () => {
    expect(teamNameKey("US Oyonnax")).toBe(teamNameKey("Oyonnax"));
    expect(teamNameKey("Grenoble FC")).toBe(teamNameKey("FC Grenoble"));
    expect(teamNameKey("Angouleme")).toBe(teamNameKey("Soyaux Angoulême"));
  });

  it("aliases Currie Cup XV / XXIII sides onto the franchise key", () => {
    expect(teamNameKey("DHL Stormers XXIII")).toBe(teamNameKey("Stormers"));
    expect(teamNameKey("Stormers XXIII")).toBe(teamNameKey("Stormers"));
    expect(teamNameKey("Bulls XV")).toBe(teamNameKey("Bulls"));
    expect(teamNameKey("Vodacom Bulls XV")).toBe(teamNameKey("Bulls"));
    expect(teamNameKey("Hollywoodbets Sharks XV")).toBe(teamNameKey("Sharks"));
  });

  it("matches CMS rows by Rugby Data externalMatchId", () => {
    const picked = pickRugbyDataSyncCandidateByExternalId(
      [
        {
          id: "wrong",
          slug: "other",
          externalMatchId: "1111",
          homeName: "A",
          awayName: "B",
        },
        {
          id: "prod2",
          slug: "orphan-v-orphan",
          externalMatchId: "9636",
          homeName: "Unknown team",
          awayName: "Unknown team",
        },
      ],
      "9636",
    );
    expect(picked?.id).toBe("prod2");
  });
});
