import { describe, expect, it } from "vitest";
import {
  classifyFixtureStatus,
  isEligibleNextMatchStatus,
  isInternationalWindowActive,
  pickSoonestEligible,
  resolvePlayerNextMatch,
  type NextMatchCandidate,
} from "./player-next-match-engine";

function fixture(partial: Partial<NextMatchCandidate> & { fixtureId: string }): NextMatchCandidate {
  return {
    slug: partial.slug ?? partial.fixtureId,
    kickoffAt: partial.kickoffAt ?? "2026-05-17T14:00:00.000Z",
    status: partial.status ?? "scheduled",
    competitionName: partial.competitionName ?? "Premiership Rugby",
    homeTeamId: partial.homeTeamId ?? "home",
    awayTeamId: partial.awayTeamId ?? "away",
    homeTeamName: partial.homeTeamName ?? "Leicester Tigers",
    awayTeamName: partial.awayTeamName ?? "Exeter Chiefs",
    homeTeamCrestUrl: partial.homeTeamCrestUrl ?? null,
    awayTeamCrestUrl: partial.awayTeamCrestUrl ?? null,
    venueName: partial.venueName ?? "Welford Road",
    href: partial.href ?? "/matches/test",
    fixtureId: partial.fixtureId,
  };
}

describe("player-next-match-engine", () => {
  it("classifies FT and cancelled as ineligible", () => {
    expect(classifyFixtureStatus("full_time")).toBe("full_time");
    expect(classifyFixtureStatus("FT")).toBe("full_time");
    expect(classifyFixtureStatus("cancelled")).toBe("cancelled");
    expect(isEligibleNextMatchStatus("full_time")).toBe(false);
    expect(isEligibleNextMatchStatus("cancelled")).toBe(false);
    expect(isEligibleNextMatchStatus("live")).toBe(true);
    expect(isEligibleNextMatchStatus("scheduled")).toBe(true);
  });

  it("advances past full-time fixtures", () => {
    const pick = pickSoonestEligible(
      [
        fixture({ fixtureId: "ft", status: "full_time", kickoffAt: "2026-05-10T14:00:00.000Z" }),
        fixture({ fixtureId: "next", status: "scheduled", kickoffAt: "2026-05-17T14:00:00.000Z" }),
      ],
      Date.parse("2026-05-11T12:00:00.000Z"),
    );
    expect(pick?.fixtureId).toBe("next");
  });

  it("prefers live over later scheduled", () => {
    const pick = pickSoonestEligible(
      [
        fixture({ fixtureId: "later", status: "scheduled", kickoffAt: "2026-05-20T14:00:00.000Z" }),
        fixture({ fixtureId: "live", status: "live", kickoffAt: "2026-05-17T14:00:00.000Z" }),
      ],
      Date.parse("2026-05-17T15:00:00.000Z"),
    );
    expect(pick?.fixtureId).toBe("live");
  });

  it("priority: confirmed squad beats club and international", () => {
    const resolved = resolvePlayerNextMatch({
      nowIso: "2026-05-11T12:00:00.000Z",
      confirmedSquadFixtures: [
        fixture({
          fixtureId: "squad",
          competitionName: "Champions Cup",
          homeTeamName: "Leicester Tigers",
          awayTeamName: "Toulouse",
        }),
      ],
      clubFixtures: [
        fixture({
          fixtureId: "club",
          competitionName: "Premiership Rugby",
        }),
      ],
      clubMembershipVerified: true,
      internationalFixtures: [
        fixture({
          fixtureId: "intl",
          competitionName: "Rugby Championship",
          homeTeamName: "South Africa",
          awayTeamName: "New Zealand",
        }),
      ],
      internationalWindowActive: true,
    });
    expect(resolved.source).toBe("confirmed_squad");
    expect(resolved.match?.fixtureId).toBe("squad");
  });

  it("uses verified club when no squad confirmation", () => {
    const resolved = resolvePlayerNextMatch({
      nowIso: "2026-05-11T12:00:00.000Z",
      confirmedSquadFixtures: [],
      clubFixtures: [fixture({ fixtureId: "club" })],
      clubMembershipVerified: true,
      internationalFixtures: [fixture({ fixtureId: "intl" })],
      internationalWindowActive: true,
    });
    expect(resolved.source).toBe("current_club");
    expect(resolved.match?.fixtureId).toBe("club");
  });

  it("withholds unverified club fixtures", () => {
    const resolved = resolvePlayerNextMatch({
      nowIso: "2026-05-11T12:00:00.000Z",
      confirmedSquadFixtures: [],
      clubFixtures: [fixture({ fixtureId: "club" })],
      clubMembershipVerified: false,
      internationalFixtures: [],
      internationalWindowActive: false,
    });
    expect(resolved.source).toBe("none");
    expect(resolved.match).toBeNull();
    expect(resolved.reason.toLowerCase()).toContain("unverified");
  });

  it("falls back to international window when club unverified", () => {
    const resolved = resolvePlayerNextMatch({
      nowIso: "2026-05-11T12:00:00.000Z",
      confirmedSquadFixtures: [],
      clubFixtures: [fixture({ fixtureId: "club" })],
      clubMembershipVerified: false,
      internationalFixtures: [fixture({ fixtureId: "intl" })],
      internationalWindowActive: true,
    });
    expect(resolved.source).toBe("international_window");
    expect(resolved.match?.fixtureId).toBe("intl");
  });

  it("skips cancelled international candidates", () => {
    const resolved = resolvePlayerNextMatch({
      nowIso: "2026-05-11T12:00:00.000Z",
      confirmedSquadFixtures: [],
      clubFixtures: [],
      clubMembershipVerified: false,
      internationalFixtures: [
        fixture({ fixtureId: "cx", status: "cancelled" }),
        fixture({ fixtureId: "ok", status: "scheduled", kickoffAt: "2026-05-18T14:00:00.000Z" }),
      ],
      internationalWindowActive: true,
    });
    expect(resolved.match?.fixtureId).toBe("ok");
  });

  it("detects active international window from near-term fixtures", () => {
    expect(
      isInternationalWindowActive({
        nowIso: "2026-08-01T12:00:00.000Z",
        internationalFixtures: [
          { kickoffAt: "2026-08-16T14:00:00.000Z", status: "scheduled" },
        ],
        horizonDays: 28,
      }),
    ).toBe(true);

    expect(
      isInternationalWindowActive({
        nowIso: "2026-08-01T12:00:00.000Z",
        internationalFixtures: [
          { kickoffAt: "2026-10-16T14:00:00.000Z", status: "scheduled" },
        ],
        horizonDays: 28,
      }),
    ).toBe(false);
  });
});
