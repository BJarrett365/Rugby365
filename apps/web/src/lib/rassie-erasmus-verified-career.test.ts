import { describe, expect, it } from "vitest";
import {
  RASSIE_ERASMUS_PROFILE,
  RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026,
  RASSIE_ERASMUS_COACHING_TENURES,
  rassieErasmusRugbyChampionshipHeadCoachYears,
  isRassieSpringbokHeadCoachMatchDate,
} from "./rassie-erasmus-verified-career";

describe("Rassie Erasmus verified Rugby Championship involvement", () => {
  it("covers every season from 2012 through 2026", () => {
    expect(RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026.map((row) => row.year)).toEqual([
      2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ]);
  });

  it("does not treat SARU employment as Springboks head-coach years", () => {
    for (const year of [2012, 2013, 2014, 2015, 2016, 2017, 2020, 2021, 2022, 2023, 2026]) {
      const row = RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026.find((item) => item.year === year);
      expect(row, String(year)).toBeTruthy();
      if (row && row.involved) {
        expect(row.namedHeadCoach).toBe(false);
      }
    }
  });

  it("credits only 2018, 2019, 2024 and 2025 as named Rugby Championship head-coach seasons", () => {
    expect(rassieErasmusRugbyChampionshipHeadCoachYears()).toEqual([2018, 2019, 2024, 2025]);
  });

  it("records the verified Championship titles under his named head-coach stints", () => {
    const titles = RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026.filter(
      (row) => row.involved && row.namedHeadCoach && row.result?.toLowerCase().includes("champion"),
    ).map((row) => row.year);
    expect(titles).toEqual([2019, 2024, 2025]);
  });

  it("stores sourced Rugby Championship records for named head-coach seasons", () => {
    const byYear = new Map(
      RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026.map((row) => [row.year, row]),
    );
    expect(byYear.get(2018)).toMatchObject({
      involved: true,
      namedHeadCoach: true,
      result: "2nd (6 matches, 3 wins, 3 losses)",
    });
    expect(byYear.get(2019)).toMatchObject({
      involved: true,
      namedHeadCoach: true,
      result: "Champions (3 matches, 2 wins, 1 draw)",
    });
    expect(byYear.get(2024)).toMatchObject({
      involved: true,
      namedHeadCoach: true,
      result: "Champions (6 matches, 5 wins, 1 loss)",
    });
    expect(byYear.get(2025)).toMatchObject({
      involved: true,
      namedHeadCoach: true,
      result: "Champions (6 matches, 4 wins, 2 losses)",
    });
  });

  it("does not invent a 2026 Rugby Championship", () => {
    const row = RASSIE_ERASMUS_RUGBY_CHAMPIONSHIP_2012_2026.find((item) => item.year === 2026);
    expect(row?.involved).toBe(false);
  });
});

describe("Rassie Erasmus verified profile and tenures", () => {
  it("uses sourced identity fields and leaves unverified style/system empty", () => {
    expect(RASSIE_ERASMUS_PROFILE.fullName).toBe("Johan Erasmus");
    expect(RASSIE_ERASMUS_PROFILE.birthDate).toBe("1972-11-05");
    expect(RASSIE_ERASMUS_PROFILE.appointedOn).toBe("2024-02-06");
    expect(RASSIE_ERASMUS_PROFILE.contractExpiresOn).toBeNull();
    expect(RASSIE_ERASMUS_PROFILE.preferredSystem).toBeNull();
    expect(RASSIE_ERASMUS_PROFILE.coachingStyle).toBeNull();
  });

  it("keeps Springboks DoR and high-performance tenures out of the career-record match set", () => {
    const blocked = RASSIE_ERASMUS_COACHING_TENURES.filter((row) =>
      ["wikipedia:rassie:sa:dor:2017-2024", "wikipedia:rassie:sa:gm-hp:2012-2016"].includes(
        row.importKey,
      ),
    );
    expect(blocked).toHaveLength(2);
    expect(blocked.every((row) => row.eligibleForCareerRecord === false)).toBe(true);
  });

  it("starts the current Springboks head-coach stint on the 2024 SA Rugby announcement", () => {
    const current = RASSIE_ERASMUS_COACHING_TENURES.find(
      (row) => row.importKey === "wikipedia:rassie:sa:hc:2024-",
    );
    expect(current).toMatchObject({
      startDate: "2024-02-06",
      endDate: null,
      isCurrent: true,
      eligibleForCareerRecord: true,
      role: "head_coach",
    });
  });

  it("does not overlap the 2018–19 head-coach window with Nienaber-era Tests", () => {
    const first = RASSIE_ERASMUS_COACHING_TENURES.find(
      (row) => row.importKey === "wikipedia:rassie:sa:hc:2018-2019",
    );
    expect(first?.endDate).toBe("2019-11-02");
  });

  it("does not treat Nienaber-era Tests as Springboks head-coach matches", () => {
    expect(isRassieSpringbokHeadCoachMatchDate("2021-07-02")).toBe(false);
    expect(isRassieSpringbokHeadCoachMatchDate("2023-10-28")).toBe(false);
    expect(isRassieSpringbokHeadCoachMatchDate("2018-06-02")).toBe(true);
    expect(isRassieSpringbokHeadCoachMatchDate("2019-11-02")).toBe(true);
    expect(isRassieSpringbokHeadCoachMatchDate("2019-11-03")).toBe(false);
    expect(isRassieSpringbokHeadCoachMatchDate("2024-02-06")).toBe(true);
  });

  it("marks Munster DoR as eligible because he was the de facto head coach", () => {
    const munster = RASSIE_ERASMUS_COACHING_TENURES.find(
      (row) => row.importKey === "wikipedia:rassie:munster:dor:2016-2017",
    );
    expect(munster).toMatchObject({
      role: "director_of_rugby",
      eligibleForCareerRecord: true,
      startDate: "2016-07-01",
      endDate: "2017-12-31",
    });
  });
});
