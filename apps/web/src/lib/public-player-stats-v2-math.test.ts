import { describe, expect, it } from "vitest";
import {
  aggregateDefensiveStats,
  averagePerAppearance,
  buildAvailableSeasons,
  buildKickingAccuracy,
  buildPointsBreakdown,
  defaultGameLogSeasonSlug,
  defenceMatchesGameLog,
  extraNumber,
  filterGameLogBySeason,
  formatAccuracyDetail,
  formatKickStat,
  formatRankLabel,
  formatRankTooltip,
  formatStatNumber,
  kickMissAttributedToPlayer,
  passSuccessPct,
  per80,
  playerNamesMatch,
  rankAmong,
  rankAmongDetailed,
  resolveDefaultSeasonStart,
  resolveGoalKickAttempts,
  rugbySeasonStartFromKickoff,
  successPct,
  sumKnown,
  tackleSuccessPct,
} from "./public-player-stats-v2-math";

describe("public-player-stats-v2-math", () => {
  it("treats missing extras keys as unknown, not zero", () => {
    expect(extraNumber({}, "missedTackles")).toBeNull();
    expect(extraNumber({ missedTackles: 0 }, "missedTackles")).toBe(0);
    expect(extraNumber({ missed_tackles: 3 }, "missedTackles", "missed_tackles")).toBe(3);
    expect(extraNumber({ "Missed goals": 2 }, "missedGoals", "Missed goals")).toBe(2);
    expect(extraNumber({ "Conversion attempts": 6 }, "conversionAttempts", "Conversion attempts")).toBe(6);
  });

  it("sums known values and returns null when every value is unknown", () => {
    expect(sumKnown([null, undefined])).toBeNull();
    expect(sumKnown([0, 0, null])).toEqual({ total: 0, sample: 2 });
    expect(sumKnown([4, 1, null])).toEqual({ total: 5, sample: 2 });
  });

  it("builds points doughnut from stored points and flags mismatch", () => {
    const ok = buildPointsBreakdown({
      storedPoints: 26,
      tries: 2,
      conversions: 5,
      penalties: 2,
      dropGoals: 0,
    });
    expect(ok.computedPoints).toBe(26);
    expect(ok.mismatch).toBe(false);
    expect(ok.segments.find((s) => s.key === "tries")?.percent).toBe(38.5);
    expect(ok.segments.find((s) => s.key === "conversions")?.percent).toBe(38.5);
    expect(ok.segments.find((s) => s.key === "penalties")?.percent).toBe(23.1);

    const mismatch = buildPointsBreakdown({
      storedPoints: 30,
      tries: 2,
      conversions: 5,
      penalties: 2,
      dropGoals: 0,
    });
    expect(mismatch.mismatch).toBe(true);
    expect(mismatch.segments.find((s) => s.key === "tries")?.percent).toBe(33.3);
  });

  it("never derives kicking accuracy from successes alone", () => {
    expect(successPct(12, null)).toBeNull();
    expect(successPct(12, 0)).toBeNull();
    expect(successPct(12, 15)).toBe(80);
  });

  it("builds goal-kicking accuracy with overall excluding drop goals", () => {
    const live = buildKickingAccuracy({
      conversions: 23,
      conversionAttempts: 25,
      penalties: 14,
      penaltyAttempts: 16,
      dropGoals: 3,
      dropGoalAttempts: 4,
      matches: 12,
      matchesWithAttemptData: 12,
      goalKickRole: true,
      periodLabel: "season 2025/26",
    });
    expect(live.available).toBe(true);
    expect(live.applicable).toBe(true);
    const overall = live.rows.find((r) => r.key === "overall")!;
    const dg = live.rows.find((r) => r.key === "dropGoals")!;
    // (23+14)/(25+16) = 37/41 ≈ 90.2 → display 90; DG 75% separate
    expect(overall.made).toBe(37);
    expect(overall.attempts).toBe(41);
    expect(overall.displayPercent).toBe(90);
    expect(dg.displayPercent).toBe(75);
    expect(dg.made).toBe(3);
    expect(dg.attempts).toBe(4);
  });

  it("shows honest empty state when attempts are unknown", () => {
    const empty = buildKickingAccuracy({
      conversions: 64,
      conversionAttempts: null,
      penalties: 20,
      penaltyAttempts: null,
      dropGoals: 0,
      dropGoalAttempts: null,
      matches: 22,
      matchesWithAttemptData: 0,
      goalKickRole: true,
      periodLabel: "season 2025/26",
    });
    expect(empty.available).toBe(false);
    expect(empty.applicable).toBe(true);
    expect(empty.rows.every((r) => r.percent == null)).toBe(true);
    expect(empty.rows.find((r) => r.key === "overall")?.made).toBe(84);
    expect(empty.message).toMatch(/attempts are not stored/i);
  });

  it("marks tiny samples provisional and verified zeros as 0%", () => {
    const tiny = buildKickingAccuracy({
      conversions: 1,
      conversionAttempts: 1,
      penalties: 0,
      penaltyAttempts: 0,
      dropGoals: 0,
      dropGoalAttempts: 2,
      matches: 1,
      matchesWithAttemptData: 1,
      goalKickRole: true,
      periodLabel: "season 2025/26",
    });
    const conv = tiny.rows.find((r) => r.key === "conversions")!;
    const pen = tiny.rows.find((r) => r.key === "penalties")!;
    const dg = tiny.rows.find((r) => r.key === "dropGoals")!;
    expect(conv.displayPercent).toBe(100);
    expect(conv.provisional).toBe(true);
    expect(conv.tooltip).toMatch(/PROVISIONAL/i);
    expect(pen.displayPercent).toBeNull(); // 0/0 → null
    expect(dg.displayPercent).toBe(0);
  });

  it("does not show 0% drop goals when there are no attempts", () => {
    const none = buildKickingAccuracy({
      conversions: 10,
      conversionAttempts: 12,
      penalties: 4,
      penaltyAttempts: 5,
      dropGoals: 0,
      dropGoalAttempts: 0,
      matches: 8,
      matchesWithAttemptData: 8,
      goalKickRole: true,
      periodLabel: "season 2025/26",
    });
    expect(none.rows.find((r) => r.key === "dropGoals")?.displayPercent).toBeNull();
    expect(none.rows.find((r) => r.key === "overall")?.displayPercent).toBe(82);
  });

  it("hides the card for non-kickers with no goal involvement", () => {
    const na = buildKickingAccuracy({
      conversions: 0,
      conversionAttempts: null,
      penalties: 0,
      penaltyAttempts: null,
      dropGoals: 0,
      dropGoalAttempts: null,
      matches: 10,
      matchesWithAttemptData: 0,
      goalKickRole: false,
      periodLabel: "season 2025/26",
    });
    expect(na.applicable).toBe(false);
    expect(na.message).toMatch(/not applicable/i);
  });

  it("resolves attempts from miss events only when misses exist", () => {
    expect(resolveGoalKickAttempts(null, 5, null)).toBeNull();
    expect(resolveGoalKickAttempts(null, 5, 0)).toBeNull();
    expect(resolveGoalKickAttempts(null, 5, 1)).toBe(6);
    expect(resolveGoalKickAttempts(8, 5, 1)).toBe(8);
    expect(resolveGoalKickAttempts(null, 5, 0, 1)).toBe(6);
    expect(resolveGoalKickAttempts(null, 5, null, 0)).toBe(5);
  });

  it("fills overall kicking from combined missed-goals extras", () => {
    const overall = buildKickingAccuracy({
      conversions: 10,
      conversionAttempts: null,
      penalties: 4,
      penaltyAttempts: null,
      dropGoals: 0,
      dropGoalAttempts: null,
      missedGoalKicks: 3,
      matches: 8,
      matchesWithAttemptData: 8,
      goalKickRole: true,
      periodLabel: "season 2025/26",
    });
    expect(overall.rows.find((r) => r.key === "overall")?.made).toBe(14);
    expect(overall.rows.find((r) => r.key === "overall")?.attempts).toBe(17);
    expect(overall.rows.find((r) => r.key === "overall")?.displayPercent).toBe(82);
    expect(overall.rows.find((r) => r.key === "conversions")?.percent).toBeNull();
  });

  it("attributes kick misses by payload name and provider id", () => {
    expect(playerNamesMatch("Handre Pollard", "Pollard Handre")).toBe(true);
    expect(
      kickMissAttributedToPlayer(
        { playerId: null, payload: { player_name: "Pollard Handre", player_external_id: "5325" } },
        { id: "p1", name: "Handre Pollard", externalProviderId: "og9nmd6l" },
      ),
    ).toBe(true);
    expect(
      kickMissAttributedToPlayer(
        { playerId: null, payload: { player_name: "Sam Prendergast" } },
        { id: "p1", name: "Handre Pollard" },
      ),
    ).toBe(false);
  });

  it("computes tackle success only when made and missed are known", () => {
    expect(tackleSuccessPct(68, null)).toBeNull();
    expect(tackleSuccessPct(68, 7)).toBe(90.7);
    expect(passSuccessPct(40, 5)).toBe(87.5);
    expect(passSuccessPct(0, 0)).toBeNull();
  });

  it("aggregates defence from paired match grains only", () => {
    const full = aggregateDefensiveStats([
      { tacklesCompleted: 10, tacklesMade: 12, missedTackles: 2, dominantTackles: 1, turnoversWon: 0, hasPerf: true },
      { tacklesCompleted: 5, tacklesMade: 5, missedTackles: 0, dominantTackles: 0, turnoversWon: 1, hasPerf: true },
      // made without missed — excluded from success % / paired totals
      { tacklesCompleted: 8, tacklesMade: 8, missedTackles: null, dominantTackles: 0, turnoversWon: 0, hasPerf: true },
    ]);
    expect(full.tacklesMade).toBe(15);
    expect(full.missedTackles).toBe(2);
    expect(full.attempts).toBe(17);
    expect(full.tackleSuccessPct).toBe(88.2);
    expect(full.dominantTackles).toBe(1);
    expect(full.turnoversWon).toBe(1);
    expect(full.matchesWithTackleSample).toBe(2);
    expect(full.limitedSample).toBe(false);
    expect(full.metricCoverage).toEqual({
      tacklesMade: 3,
      missedTackles: 2,
      dominantTackles: 3,
      turnoversWon: 3,
    });

    const unknownMissed = aggregateDefensiveStats([
      { tacklesCompleted: 10, tacklesMade: 10, missedTackles: null, dominantTackles: 0, turnoversWon: 0, hasPerf: true },
    ]);
    expect(unknownMissed.tackleSuccessPct).toBeNull();
    expect(unknownMissed.missedTackles).toBeNull();
    expect(unknownMissed.tacklesMade).toBe(10);

    const tiny = aggregateDefensiveStats([
      { tacklesCompleted: 2, tacklesMade: 3, missedTackles: 1, dominantTackles: 0, turnoversWon: 0, hasPerf: true },
    ]);
    expect(tiny.limitedSample).toBe(true);
    expect(tiny.message).toMatch(/Limited sample/);
  });

  it("reconciles defence totals with game-log rows under the same season filter", () => {
    const seasonSlug = "2025-26";
    const gameLog = [
      {
        seasonSlug,
        tacklesMade: 10,
        missedTackles: 2,
        dominantTackles: 1,
        turnoversWon: 0,
      },
      {
        seasonSlug,
        tacklesMade: 5,
        missedTackles: 0,
        dominantTackles: 0,
        turnoversWon: 1,
      },
      {
        seasonSlug: "2024-25",
        tacklesMade: 99,
        missedTackles: 9,
        dominantTackles: 9,
        turnoversWon: 9,
      },
    ];
    const filtered = filterGameLogBySeason(gameLog, seasonSlug);
    const defence = aggregateDefensiveStats(
      filtered.map((row) => ({
        tacklesCompleted: row.tacklesMade,
        tacklesMade: row.tacklesMade,
        missedTackles: row.missedTackles,
        dominantTackles: row.dominantTackles,
        turnoversWon: row.turnoversWon,
        hasPerf: true,
      })),
    );
    expect(defence.tacklesMade).toBe(15);
    expect(defence.missedTackles).toBe(2);
    expect(defence.attempts).toBe(17);
    expect(defence.tackleSuccessPct).toBe(88.2);
    expect(defence.dominantTackles).toBe(1);
    expect(defence.turnoversWon).toBe(1);
    expect(defenceMatchesGameLog(defence, filtered)).toBe(true);
    expect(defenceMatchesGameLog(defence, gameLog)).toBe(false);
  });

  it("does not average percentages — per-appearance is for counts only", () => {
    expect(averagePerAppearance(152, 19)).toBe(8);
    expect(averagePerAppearance(null, 19)).toBeNull();
    expect(per80(1245, 1520)).toBe(65.5);
    expect(per80(10, 40)).toBeNull();
  });

  it("gates ranks behind the sample threshold", () => {
    const peers = [
      { value: 10, minutes: 400, appearances: 6 },
      { value: 8, minutes: 350, appearances: 6 },
      { value: 20, minutes: 40, appearances: 1 },
    ];
    expect(rankAmong(8, peers, { minutes: 350, appearances: 6 })).toBe(2);
    expect(rankAmong(8, peers, { minutes: 20, appearances: 1 })).toBeNull();
  });

  it("counts the player in the eligible pool and marks thin pools provisional", () => {
    const peers = [
      { value: 10, minutes: 400, appearances: 6 },
      { value: 8, minutes: 350, appearances: 6 },
    ];
    const detailed = rankAmongDetailed(8, peers, { minutes: 350, appearances: 6 });
    expect(detailed.rank).toBe(2);
    expect(detailed.eligibleCount).toBe(3);
    expect(detailed.provisional).toBe(true);
  });

  it("formats integers with thousands separators and accuracy with parentheses", () => {
    expect(formatStatNumber(1253, { digits: 0 })).toBe("1,253");
    expect(formatStatNumber(64, { digits: 0 })).toBe("64");
    expect(formatAccuracyDetail(23, 25, 92)).toBe("23 / 25 (92%)");
    expect(formatAccuracyDetail(12, null, null)).toBeNull();
    expect(formatRankLabel(2, true)).toBe("#2*");
    expect(formatRankTooltip({
      rank: 2,
      eligibleCount: 6,
      provisional: true,
      peerPlural: "Fly-Halves",
      periodLabel: "season 2025–26",
      metricBasis: "per-80 vs same-position peers",
    })).toContain("#2* of 6 eligible Fly-Halves");
  });

  it("defaults season from current active year when the player has appearances there", () => {
    expect(
      resolveDefaultSeasonStart({
        appearanceSeasonStarts: [2024, 2025, 2026],
        appearanceCountsByStart: { 2024: 10, 2025: 20, 2026: 8 },
        referenceDate: new Date("2026-08-13T00:00:00Z"),
      }),
    ).toBe(2026);
    expect(
      resolveDefaultSeasonStart({
        appearanceSeasonStarts: [2024, 2025, 2026],
        appearanceCountsByStart: { 2024: 10, 2025: 20, 2026: 1 },
        referenceDate: new Date("2026-08-13T00:00:00Z"),
      }),
    ).toBe(2025);
    expect(
      resolveDefaultSeasonStart({
        appearanceSeasonStarts: [2023, 2024],
        appearanceCountsByStart: { 2023: 5, 2024: 12 },
        referenceDate: new Date("2026-08-13T00:00:00Z"),
      }),
    ).toBe(2024);
    expect(rugbySeasonStartFromKickoff("2026-08-01T15:00:00Z")).toBe(2026);
    expect(rugbySeasonStartFromKickoff("2026-05-01T15:00:00Z")).toBe(2025);
  });

  it("lists appearance seasons newest first and always includes the current season", () => {
    const seasons = buildAvailableSeasons({
      appearanceCountsByStart: { 2023: 12, 2024: 18, 2025: 4 },
      currentStartYear: 2026,
      selectedStartYear: 2025,
    });
    expect(seasons.map((s) => s.slug)).toEqual(["2026-27", "2025-26", "2024-25", "2023-24"]);
    expect(seasons[0]).toEqual({ slug: "2026-27", label: "2026–27", appearances: 0 });
    expect(seasons.find((s) => s.slug === "2024-25")?.appearances).toBe(18);
    expect(seasons.find((s) => s.slug === "2024-25")?.label).toBe("2024–25");
  });

  it("defaults game log to the page season, or latest with appearances in career mode", () => {
    const availableSeasons = [
      { slug: "2026-27", appearances: 0 },
      { slug: "2025-26", appearances: 8 },
      { slug: "2024-25", appearances: 20 },
    ];
    expect(
      defaultGameLogSeasonSlug({
        period: "season",
        selectedSeasonSlug: "2025-26",
        availableSeasons,
      }),
    ).toBe("2025-26");
    expect(
      defaultGameLogSeasonSlug({
        period: "career",
        selectedSeasonSlug: "2024-25",
        availableSeasons,
      }),
    ).toBe("2025-26");
  });

  it("filters game log rows by season slug and stays empty when none match", () => {
    const rows = [
      { fixtureId: "a", seasonSlug: "2025-26" },
      { fixtureId: "b", seasonSlug: "2024-25" },
      { fixtureId: "c", seasonSlug: "2025-26" },
    ];
    expect(filterGameLogBySeason(rows, "2024-25").map((r) => r.fixtureId)).toEqual(["b"]);
    expect(filterGameLogBySeason(rows, "2022-23")).toEqual([]);
    expect(filterGameLogBySeason(rows, "career").map((r) => r.fixtureId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("formats kick stats with attempts when known", () => {
    expect(formatKickStat(2, 2)).toBe("2 / 2");
    expect(formatKickStat(1, 2)).toBe("1 / 2");
    expect(formatKickStat(3, null)).toBe("3");
    expect(formatKickStat(null, null)).toBe("—");
  });
});
