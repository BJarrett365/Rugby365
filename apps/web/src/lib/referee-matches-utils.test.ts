import { describe, expect, it } from "vitest";
import {
  buildRefereeMatchCentreHref,
  sanitizeRefereeAppointments,
  type RefereeAppointmentInput,
} from "./referee-matches-utils";

function appt(overrides: Partial<RefereeAppointmentInput> = {}): RefereeAppointmentInput {
  return {
    id: "fx-1",
    slug: "cardiff-rugby-v-stormers-2025-09-27",
    kickoffAt: "2025-09-27T14:00:00.000Z",
    status: "full_time",
    competitionName: "United Rugby Championship",
    homeTeamName: "Cardiff Rugby",
    awayTeamName: "Stormers",
    homeScore: 22,
    awayScore: 16,
    homeTeamId: "home-1",
    awayTeamId: "away-1",
    homeTeamSlug: "cardiff-rugby",
    awayTeamSlug: "stormers",
    homeCrestUrl: "https://example.com/cardiff.png",
    awayCrestUrl: "https://example.com/stormers.png",
    planetRugbyUrl: null,
    externalMatchId: "abc123xy",
    competitionCode: "urc",
    competitionSlug: "united-rugby-championship",
    ...overrides,
  };
}

describe("sanitizeRefereeAppointments", () => {
  it("drops unknown and orphan sides", () => {
    const rows = sanitizeRefereeAppointments([
      appt({ id: "keep", homeTeamName: "Leinster", awayTeamName: "Munster" }),
      appt({
        id: "unknown",
        slug: "unknown-v-munster-2025-09-27",
        homeTeamName: "Unknown team e416a7d7de5e",
        awayTeamName: "Munster",
      }),
      appt({
        id: "orphan",
        slug: "orphan-v-stormers-2025-09-27",
        homeTeamName: "Orphan",
        awayTeamName: "Stormers",
      }),
    ]);
    expect(rows.map((row) => row.id)).toEqual(["keep"]);
  });

  it("collapses Cardiff Rugby vs DHL duplicates of the same scoreline", () => {
    const rows = sanitizeRefereeAppointments([
      appt({
        id: "first",
        homeTeamName: "Cardiff Rugby",
        awayTeamName: "DHL Stormers XXIII",
        homeCrestUrl: "https://example.com/cardiff.png",
        awayCrestUrl: null,
      }),
      appt({
        id: "dup",
        slug: "cardiff-v-dhl-stormers-2025-09-27",
        homeTeamName: "Cardiff",
        awayTeamName: "DHL Stormers",
        homeTeamSlug: "cardiff",
        awayTeamSlug: "dhl-stormers",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeTeamName).toBe("Cardiff Rugby");
    expect(rows[0]?.awayTeamName).toBe("Stormers");
    expect(rows[0]?.homeScore).toBe(22);
    expect(rows[0]?.awayScore).toBe(16);
  });

  it("collapses Glasgow vs Glasgow Warriors on the same day", () => {
    const rows = sanitizeRefereeAppointments([
      appt({
        id: "warriors",
        slug: "glasgow-warriors-v-bulls-2026-06-06",
        kickoffAt: "2026-06-06T18:00:00.000Z",
        homeTeamName: "Glasgow Warriors",
        awayTeamName: "Bulls",
        homeScore: 21,
        awayScore: 22,
        homeTeamSlug: "glasgow-warriors",
        awayTeamSlug: "bulls",
      }),
      appt({
        id: "short",
        slug: "glasgow-v-bulls-2026-06-06",
        kickoffAt: "2026-06-06T18:00:00.000Z",
        homeTeamName: "Glasgow",
        awayTeamName: "Bulls",
        homeScore: 21,
        awayScore: 22,
        homeTeamSlug: "glasgow",
        awayTeamSlug: "bulls",
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeTeamName).toBe("Glasgow Warriors");
  });
});

describe("buildRefereeMatchCentreHref", () => {
  it("prefers the Planet Rugby match-centre path", () => {
    expect(
      buildRefereeMatchCentreHref({
        id: "uuid-1",
        slug: "cardiff-rugby-v-stormers-2025-09-27",
        planetRugbyUrl: "https://www.planetrugby.com/matches/abc123xy/urc/urc/cardiff-rugby-v-stormers/2025-09-27",
        externalMatchId: "abc123xy",
        competitionName: "United Rugby Championship",
        competitionCode: "urc",
        competitionSlug: "united-rugby-championship",
        homeTeamSlug: "cardiff-rugby",
        awayTeamSlug: "stormers",
        homeTeamName: "Cardiff Rugby",
        awayTeamName: "Stormers",
        kickoffAt: "2025-09-27T14:00:00.000Z",
      }),
    ).toBe("/matches/abc123xy/urc/urc/cardiff-rugby-v-stormers/2025-09-27");
  });

  it("builds a match-centre URL from the fixture id when no Planet Rugby URL exists", () => {
    expect(
      buildRefereeMatchCentreHref({
        id: "uuid-1",
        slug: "leinster-v-munster-2026-03-01",
        planetRugbyUrl: null,
        externalMatchId: null,
        competitionName: "URC",
        competitionCode: null,
        competitionSlug: "urc",
        homeTeamSlug: "leinster",
        awayTeamSlug: "munster",
        homeTeamName: "Leinster",
        awayTeamName: "Munster",
        kickoffAt: "2026-03-01T15:00:00.000Z",
      }),
    ).toBe("/matches/uuid-1/urc/urc/leinster-v-munster/2026-03-01");
  });
});
