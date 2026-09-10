import { describe, expect, it } from "vitest";
import { countDedupedScoringForTeam } from "./team-match-event-scoring";

describe("countDedupedScoringForTeam", () => {
  it("does not double timed Wikipedia rows and untimed rugby-box copies", () => {
    const teamId = "nz";
    const events = [
      {
        eventType: "try",
        minute: 12,
        teamId,
        sequenceNo: 1,
        sourceProvider: "wikipedia",
        payload: { playerName: "Julian Savea" },
      },
      {
        eventType: "try",
        minute: 40,
        teamId,
        sequenceNo: 2,
        sourceProvider: "wikipedia",
        payload: { playerName: "Julian Savea" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId,
        sequenceNo: 10,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Julian Savea" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId,
        sequenceNo: 11,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Julian Savea" },
      },
    ];
    expect(countDedupedScoringForTeam(events, teamId).tries).toBe(2);
  });

  it("keeps a Wikipedia try whose minute failed to parse when timed rows exist", () => {
    const teamId = "nz";
    const events = [
      {
        eventType: "try",
        minute: 20,
        teamId,
        sequenceNo: 1,
        sourceProvider: "wikipedia",
        payload: { playerName: "McCaw" },
      },
      {
        eventType: "try",
        minute: 40,
        teamId,
        sequenceNo: 2,
        sourceProvider: "wikipedia",
        payload: { playerName: "Nonu" },
      },
      {
        eventType: "try",
        minute: 42,
        teamId,
        sequenceNo: 3,
        sourceProvider: "wikipedia",
        payload: { playerName: "Piutau" },
      },
      {
        eventType: "try",
        minute: 48,
        teamId,
        sequenceNo: 4,
        sourceProvider: "wikipedia",
        payload: { playerName: "Read" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId,
        sequenceNo: 5,
        sourceProvider: "wikipedia",
        payload: { playerName: "Taylor" },
      },
      {
        eventType: "try",
        minute: 0,
        teamId,
        sequenceNo: 10,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Taylor" },
      },
    ];
    expect(countDedupedScoringForTeam(events, teamId).tries).toBe(5);
  });

  it("counts rugby-box events when timed Wikipedia rows are absent", () => {
    const teamId = "sa";
    const events = [
      {
        eventType: "conversion",
        minute: 0,
        teamId,
        sequenceNo: 1,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Morné Steyn" },
      },
      {
        eventType: "conversion",
        minute: 0,
        teamId,
        sequenceNo: 2,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Morné Steyn" },
      },
      {
        eventType: "penalty",
        minute: 0,
        teamId,
        sequenceNo: 3,
        sourceProvider: "wikipedia-rugby-box",
        payload: { playerName: "Morné Steyn" },
      },
    ];
    expect(countDedupedScoringForTeam(events, teamId)).toMatchObject({
      conversions: 2,
      penalties: 1,
      tries: 0,
    });
  });
});

/** Wikipedia 2012 Rugby Championship standings — points for. */
export const TRC_2012_WIKIPEDIA_POINTS_FOR = {
  "New Zealand": 177,
  "South Africa": 120,
  Australia: 101,
  Argentina: 80,
} as const;

/** Wikipedia 2013 Rugby Championship standings — points for. */
export const TRC_2013_WIKIPEDIA_POINTS_FOR = {
  "South Africa": 203,
  "New Zealand": 202,
  Australia: 133,
  Argentina: 88,
} as const;

/** Wikipedia 2012 tournament try total (Matches played 12, tries scored 44). */
export const TRC_2012_WIKIPEDIA_TRIES = 44;

/**
 * Most Points source of truth: Wikipedia standings PF, except 2022 where the
 * Wikipedia PF column (SA 159 / Aus 139 / Arg 141) disagrees with summed match
 * scores. Ultimate Rugby and Global Sports Archive match the fixture totals.
 */
export const TRC_VERIFIED_POINTS_FOR: Record<number, Record<string, number>> = {
  2012: { "New Zealand": 177, "South Africa": 120, Australia: 101, Argentina: 80 },
  2013: { "South Africa": 203, "New Zealand": 202, Australia: 133, Argentina: 88 },
  2014: { "New Zealand": 164, "South Africa": 134, Australia: 115, Argentina: 105 },
  2015: { Australia: 85, "New Zealand": 85, "South Africa": 65, Argentina: 64 },
  2016: { "New Zealand": 262, Argentina: 129, Australia: 119, "South Africa": 117 },
  2017: { "New Zealand": 246, Australia: 195, "South Africa": 152, Argentina: 110 },
  2018: { "New Zealand": 225, "South Africa": 160, Argentina: 151, Australia: 124 },
  2019: { "South Africa": 97, Australia: 80, "New Zealand": 62, Argentina: 39 },
  2020: { "New Zealand": 118, Australia: 60, Argentina: 56 },
  2021: { "New Zealand": 218, Australia: 160, "South Africa": 152, Argentina: 60 },
  2022: { "New Zealand": 195, "South Africa": 164, Argentina: 143, Australia: 142 },
  2023: { "New Zealand": 114, "South Africa": 85, Argentina: 67, Australia: 50 },
  2024: { "South Africa": 188, "New Zealand": 175, Argentina: 170, Australia: 107 },
  2025: { "South Africa": 208, Argentina: 162, "New Zealand": 159, Australia: 152 },
};

/** Wikipedia infobox / standings TF. 2015 standings TF (36) disagrees with rugbyboxes (33). */
export const TRC_VERIFIED_TRIES: Record<number, Record<string, number>> = {
  2012: { "New Zealand": 18, "South Africa": 12, Argentina: 7, Australia: 7 },
  2015: { Australia: 10, "New Zealand": 10, "South Africa": 7, Argentina: 6 },
  2017: { "New Zealand": 35, Australia: 25, "South Africa": 17, Argentina: 10 },
  2018: { "New Zealand": 33, "South Africa": 21, Argentina: 18, Australia: 16 },
  2019: { "South Africa": 11, Australia: 9, "New Zealand": 7, Argentina: 3 },
  2020: { "New Zealand": 16, Australia: 4, Argentina: 2 },
  2021: { "New Zealand": 28, Australia: 19, "South Africa": 12, Argentina: 5 },
  2022: { "New Zealand": 24, "South Africa": 20, Australia: 17, Argentina: 15 },
  2023: { "New Zealand": 17, "South Africa": 12, Argentina: 8, Australia: 7 },
  2024: { "South Africa": 24, "New Zealand": 22, Argentina: 20, Australia: 11 },
  2025: { "South Africa": 27, Australia: 21, "New Zealand": 21, Argentina: 14 },
};

describe("2012–2013 Rugby Championship verified scoring", () => {
  it("uses Wikipedia standings points-for as the Most Points source of truth", () => {
    const total2012 = Object.values(TRC_2012_WIKIPEDIA_POINTS_FOR).reduce((sum, value) => sum + value, 0);
    const total2013 = Object.values(TRC_2013_WIKIPEDIA_POINTS_FOR).reduce((sum, value) => sum + value, 0);
    expect(total2012).toBe(478);
    expect(total2013).toBe(626);
    expect(TRC_2012_WIKIPEDIA_TRIES).toBe(44);
  });
});

describe("Rugby Championship verified Most Points / Most Tries tables", () => {
  it("covers every staged Championship season from 2012 through 2025", () => {
    for (let year = 2012; year <= 2025; year += 1) {
      expect(TRC_VERIFIED_POINTS_FOR[year]).toBeTruthy();
    }
    expect(TRC_VERIFIED_POINTS_FOR[2020]).not.toHaveProperty("South Africa");
  });

  it("matches Wikipedia 2012 try total and 2015 rugbybox try total", () => {
    expect(Object.values(TRC_VERIFIED_TRIES[2012]!).reduce((sum, value) => sum + value, 0)).toBe(44);
    expect(Object.values(TRC_VERIFIED_TRIES[2015]!).reduce((sum, value) => sum + value, 0)).toBe(33);
    expect(Object.values(TRC_VERIFIED_TRIES[2017]!).reduce((sum, value) => sum + value, 0)).toBe(87);
    expect(Object.values(TRC_VERIFIED_TRIES[2018]!).reduce((sum, value) => sum + value, 0)).toBe(88);
    expect(Object.values(TRC_VERIFIED_TRIES[2022]!).reduce((sum, value) => sum + value, 0)).toBe(76);
    expect(Object.values(TRC_VERIFIED_TRIES[2023]!).reduce((sum, value) => sum + value, 0)).toBe(44);
    expect(Object.values(TRC_VERIFIED_TRIES[2025]!).reduce((sum, value) => sum + value, 0)).toBe(83);
  });
});
