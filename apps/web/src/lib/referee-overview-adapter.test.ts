import { describe, expect, it } from "vitest";
import { ANDREW_BRACE_DASHBOARD_MOCK } from "./referee-dashboard-mock";
import { ratingToTen, refereeForm, refereeMatchRows, refereeStars } from "./referee-overview-adapter";

describe("referee-overview-adapter", () => {
  it("converts 0–100 ratings to the player 0–10 match scale", () => {
    expect(ratingToTen(88.1)).toBe(8.8);
    expect(ratingToTen(7.4)).toBe(7.4);
  });

  it("maps form squares and season metrics onto the player form widget", () => {
    const form = refereeForm(ANDREW_BRACE_DASHBOARD_MOCK);
    expect(form.resultStrip).toContain("W");
    expect(form.resultStrip).toContain("L");
    expect(form.metricDisplays.length).toBeGreaterThan(0);
    expect(form.formScore).toBeGreaterThan(0);
  });

  it("keeps live fixture labels in the recent-matches widget", () => {
    const rows = refereeMatchRows(ANDREW_BRACE_DASHBOARD_MOCK);
    expect(rows[0]?.matchLabel).toContain("Ireland");
    expect(rows[0]?.kickoffAt).toBe("2026-03-14T15:00:00.000Z");
    expect(rows[0]?.homeCrestUrl).toBeTruthy();
    expect(rows[0]?.homeScore).toBe(22);
    expect(rows[0]?.yellowCards).toBe(2);
  });

  it("maps overall rating onto the five-star scale", () => {
    expect(refereeStars(86.4)).toBe(4.3);
  });
});
