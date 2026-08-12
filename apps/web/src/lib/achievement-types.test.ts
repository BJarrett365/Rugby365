import { describe, expect, it } from "vitest";
import {
  buildAchievementDedupeKey,
  isMajorHonourWin,
  normalizeAwardDisplayTitle,
} from "./achievement-types";

describe("normalizeAwardDisplayTitle", () => {
  it("strips duplicated World Rugby prefix", () => {
    const result = normalizeAwardDisplayTitle(
      "World Rugby World Rugby Coach of the Year",
      "World Rugby",
    );
    expect(result.organisation).toBe("World Rugby");
    expect(result.title).toBe("Coach of the Year");
  });

  it("splits Pro12 award", () => {
    const result = normalizeAwardDisplayTitle("Pro12 Coach of the Season", "Pro12");
    expect(result.organisation).toBe("Pro12");
    expect(result.title).toBe("Coach of the Season");
  });
});

describe("isMajorHonourWin", () => {
  it("counts major winners only", () => {
    expect(
      isMajorHonourWin({ honourLevel: "MAJOR", placing: "WINNER" }),
    ).toBe(true);
    expect(
      isMajorHonourWin({ honourLevel: "MAJOR", placing: "RUNNER_UP" }),
    ).toBe(false);
    expect(
      isMajorHonourWin({ honourLevel: "CUP", placing: "WINNER" }),
    ).toBe(false);
    expect(
      isMajorHonourWin({
        honourLevel: "AWARD",
        placing: "WINNER",
        achievementType: "PERSONAL_AWARD",
      }),
    ).toBe(false);
  });
});

describe("buildAchievementDedupeKey", () => {
  it("is stable for same inputs", () => {
    const a = buildAchievementDedupeKey({
      achievementType: "MEDAL",
      competitionName: "Rugby World Cup",
      year: 2019,
      teamName: "South Africa",
      roleType: "HEAD_COACH",
      placing: "WINNER",
    });
    const b = buildAchievementDedupeKey({
      achievementType: "MEDAL",
      competitionName: "Rugby World Cup",
      year: 2019,
      teamName: "South Africa",
      roleType: "HEAD_COACH",
      placing: "WINNER",
    });
    expect(a).toBe(b);
  });
});
