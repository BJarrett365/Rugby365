/**
 * Rugby365 Player Value model (player-value-v1).
 * Estimates market worth — not a football-style transfer fee.
 * Pure functions only; no DB / AI I/O.
 */

export const PLAYER_VALUE_MODEL = "player-value-v1";

export type PlayerValueCurrency = "GBP";

export type PlayerValueFactorKey =
  | "age"
  | "form"
  | "international"
  | "club"
  | "position"
  | "contract"
  | "injuries"
  | "potential"
  | "commercial"
  | "leadership";

export type PlayerValueFactor = {
  key: PlayerValueFactorKey;
  label: string;
  /** Percentage points applied to base (e.g. +18 → multiply by 1.18). */
  pct: number;
  note: string;
};

export type PlayerValueInputs = {
  /** Career / current ability rating on ~35–99 scale. */
  currentRating: number | null;
  seasonRating: number | null;
  formScore: number | null;
  /** Last five match ratings on 0–10 scale. */
  lastFiveMatchRatings: number[];
  potential: number | null;
  reputation: number | null;
  age: number | null;
  positionName: string | null;
  /** Club competition slug or normalised name. */
  competitionKey: string | null;
  internationalCaps: number | null;
  /** Months remaining on contract; null = unknown. */
  contractMonthsRemaining: number | null;
  /** Days unavailable in last 365 days (injury/suspension). */
  daysUnavailableLastYear: number | null;
  isCaptain: boolean | null;
  hasSocialPresence: boolean;
  /** Optional media corroboration: -1..+1 nudge after human/AI review. */
  mediaNudgePct: number | null;
};

export type PlayerValueResult = {
  modelVersion: string;
  currency: PlayerValueCurrency;
  /** What the player is worth today. */
  marketValueGbp: number;
  /** Likely settlement / release context for a move (not a Transfermarkt fee). */
  transferValueGbp: number;
  /** Suggested annual salary band midpoint. */
  contractValueGbp: number;
  /** Projected market value in ~3 years. */
  futureValueGbp: number;
  peakCareerValueGbp: number;
  riskScore: number;
  confidence: number;
  trendPct: number | null;
  trendLabel: string;
  factors: PlayerValueFactor[];
  recommendations: {
    transfer: string;
    contract: string;
    resale: string;
  };
  baseValueGbp: number;
  ratingBandLabel: string;
};

export type PlayerValueTimelinePoint = {
  year: number;
  marketValueGbp: number;
};

/** Rating → market value midpoint (GBP). */
export function baseMarketValueFromRating(rating: number | null): {
  midGbp: number;
  bandLabel: string;
} {
  if (rating == null || !Number.isFinite(rating)) {
    return { midGbp: 40_000, bandLabel: "Unrated / under 75" };
  }
  const r = rating;
  if (r >= 95) return { midGbp: 2_250_000, bandLabel: "95–99" };
  if (r >= 90) return { midGbp: 1_150_000, bandLabel: "90–94" };
  if (r >= 85) return { midGbp: 600_000, bandLabel: "85–89" };
  if (r >= 80) return { midGbp: 300_000, bandLabel: "80–84" };
  if (r >= 75) return { midGbp: 137_500, bandLabel: "75–79" };
  if (r >= 65) return { midGbp: 55_000, bandLabel: "65–74" };
  return { midGbp: 25_000, bandLabel: "Under 65" };
}

/** Suggested annual salary midpoint from career rating. */
export function contractSalaryFromRating(rating: number | null): number {
  if (rating == null || !Number.isFinite(rating)) return 40_000;
  if (rating >= 95) return 1_050_000;
  if (rating >= 90) return 900_000;
  if (rating >= 85) return 450_000;
  if (rating >= 80) return 185_000;
  if (rating >= 75) return 90_000;
  if (rating >= 65) return 55_000;
  return 30_000;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundGbp(n: number): number {
  if (n >= 1_000_000) return Math.round(n / 10_000) * 10_000;
  if (n >= 100_000) return Math.round(n / 5_000) * 5_000;
  if (n >= 10_000) return Math.round(n / 1_000) * 1_000;
  return Math.round(n / 500) * 500;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function competitionStrengthPct(competitionKey: string | null): { pct: number; note: string } {
  const key = (competitionKey ?? "").toLowerCase();
  if (!key) return { pct: 0, note: "Club competition unknown" };
  if (key.includes("top-14") || key.includes("top 14") || key === "top14") {
    return { pct: 10, note: "Top 14 — highest spending league" };
  }
  if (key.includes("premiership") || key.includes("gallagher")) {
    return { pct: 8, note: "Premiership Rugby" };
  }
  if (
    key.includes("united-rugby") ||
    key.includes("urc") ||
    key.includes("united rugby")
  ) {
    return { pct: 6, note: "United Rugby Championship" };
  }
  if (key.includes("super-rugby") || key.includes("super rugby")) {
    return { pct: 5, note: "Super Rugby Pacific" };
  }
  if (
    key.includes("champions-cup") ||
    key.includes("investec") ||
    key.includes("european")
  ) {
    return { pct: 7, note: "European / Champions Cup exposure" };
  }
  if (key.includes("currie")) return { pct: 2, note: "Currie Cup" };
  if (key.includes("pro") && key.includes("d2")) {
    return { pct: 1, note: "Pro D2" };
  }
  return { pct: 2, note: "Domestic competition" };
}

function positionScarcityPct(positionName: string | null): { pct: number; note: string } {
  const p = (positionName ?? "").toLowerCase();
  if (!p) return { pct: 0, note: "Position unknown" };
  if (/(fly.?half|out.?half|number.?10|10\b)/.test(p)) {
    return { pct: 6, note: "Fly-half scarcity premium" };
  }
  if (/(scrum.?half|half.?back|number.?9|9\b)/.test(p)) {
    return { pct: 5, note: "Scrum-half scarcity premium" };
  }
  if (/(lock|second.?row)/.test(p)) return { pct: 3, note: "Lock demand" };
  if (/(openside|blindside|flanker|number.?8|back.?row)/.test(p)) {
    return { pct: 3, note: "Back-row demand" };
  }
  if (/(centre|midfield)/.test(p)) return { pct: 2, note: "Centre" };
  if (/(wing|full.?back)/.test(p)) return { pct: 2, note: "Outside back" };
  if (/(prop|hooker|front.?row)/.test(p)) return { pct: 4, note: "Front-row specialist" };
  return { pct: 1, note: "Position factored" };
}

function ageFactor(age: number | null): { pct: number; note: string } {
  if (age == null) return { pct: 0, note: "Age unknown" };
  if (age <= 21) return { pct: 8, note: "Young talent upside" };
  if (age <= 24) return { pct: 10, note: "Entering peak window" };
  if (age <= 28) return { pct: 10, note: "Peak age band" };
  if (age <= 31) return { pct: 4, note: "Established peak / early decline risk" };
  if (age <= 34) return { pct: -8, note: "Late-career age adjustment" };
  return { pct: -18, note: "Veteran age adjustment" };
}

export function computePlayerValue(input: PlayerValueInputs): PlayerValueResult {
  const ratingCandidates = [
    input.currentRating,
    input.seasonRating,
    input.formScore,
    input.reputation,
  ].filter((n): n is number => n != null && Number.isFinite(n));
  const rating =
    ratingCandidates.length > 0
      ? Math.max(...ratingCandidates)
      : avg(input.lastFiveMatchRatings.map((n) => n * 10)) != null
        ? clamp((avg(input.lastFiveMatchRatings.map((n) => n * 10)) ?? 50) + 20, 40, 90)
        : null;

  const { midGbp: base, bandLabel } = baseMarketValueFromRating(rating);
  const factors: PlayerValueFactor[] = [];

  const age = ageFactor(input.age);
  factors.push({ key: "age", label: "Age", pct: age.pct, note: age.note });

  const formMatchAvg = avg(input.lastFiveMatchRatings);
  let formPct = 0;
  let formNote = "Form data limited";
  if (input.formScore != null && Number.isFinite(input.formScore)) {
    // formScore typically sits near career scale; treat 50 as neutral-ish
    formPct = clamp(Math.round((input.formScore - 55) * 0.6), -15, 20);
    formNote = `Form score ${input.formScore.toFixed(0)}`;
  } else if (formMatchAvg != null) {
    formPct = clamp(Math.round((formMatchAvg - 6.5) * 8), -15, 20);
    formNote = `Last-five match avg ${formMatchAvg.toFixed(1)}`;
  }
  factors.push({ key: "form", label: "Current form", pct: formPct, note: formNote });

  const caps = input.internationalCaps ?? 0;
  let intlPct = 0;
  let intlNote = "No international caps recorded";
  if (caps >= 80) {
    intlPct = 22;
    intlNote = `${caps} caps — established international`;
  } else if (caps >= 40) {
    intlPct = 16;
    intlNote = `${caps} caps`;
  } else if (caps >= 15) {
    intlPct = 10;
    intlNote = `${caps} caps`;
  } else if (caps >= 1) {
    intlPct = 5;
    intlNote = `${caps} cap${caps === 1 ? "" : "s"}`;
  }
  factors.push({
    key: "international",
    label: "International",
    pct: intlPct,
    note: intlNote,
  });

  const club = competitionStrengthPct(input.competitionKey);
  factors.push({ key: "club", label: "Club competition", pct: club.pct, note: club.note });

  const pos = positionScarcityPct(input.positionName);
  factors.push({ key: "position", label: "Position", pct: pos.pct, note: pos.note });

  let contractPct = 0;
  let contractNote = "Contract length unknown";
  if (input.contractMonthsRemaining != null) {
    const m = input.contractMonthsRemaining;
    if (m <= 6) {
      contractPct = -4;
      contractNote = "Short remaining contract (mobility ↑, security ↓)";
    } else if (m <= 18) {
      contractPct = 2;
      contractNote = "Mid-term contract";
    } else {
      contractPct = 7;
      contractNote = "Long remaining contract";
    }
  }
  factors.push({
    key: "contract",
    label: "Contract",
    pct: contractPct,
    note: contractNote,
  });

  let injuryPct = 0;
  let injuryNote = "No recent absence data";
  if (input.daysUnavailableLastYear != null) {
    const d = input.daysUnavailableLastYear;
    if (d >= 120) {
      injuryPct = -14;
      injuryNote = `${d} days unavailable in last year`;
    } else if (d >= 60) {
      injuryPct = -8;
      injuryNote = `${d} days unavailable in last year`;
    } else if (d >= 21) {
      injuryPct = -4;
      injuryNote = `${d} days unavailable in last year`;
    } else if (d > 0) {
      injuryPct = -1;
      injuryNote = `${d} days unavailable in last year`;
    } else {
      injuryNote = "No significant absences recorded";
    }
  }
  factors.push({
    key: "injuries",
    label: "Injuries / availability",
    pct: injuryPct,
    note: injuryNote,
  });

  let potPct = 0;
  let potNote = "Potential unknown";
  if (input.potential != null && rating != null) {
    const gap = input.potential - rating;
    potPct = clamp(Math.round(gap * 0.8), -5, 14);
    potNote = `Potential ${input.potential.toFixed(0)} vs current ${rating.toFixed(0)}`;
  } else if (input.age != null && input.age <= 23) {
    potPct = 6;
    potNote = "Youth growth assumed";
  }
  factors.push({
    key: "potential",
    label: "Future potential",
    pct: potPct,
    note: potNote,
  });

  const commercialPct = input.hasSocialPresence ? 6 : 0;
  factors.push({
    key: "commercial",
    label: "Commercial profile",
    pct: commercialPct,
    note: input.hasSocialPresence
      ? "Public social / commercial footprint present"
      : "Limited public commercial signals",
  });

  const leadershipPct = input.isCaptain === true ? 5 : 0;
  factors.push({
    key: "leadership",
    label: "Leadership",
    pct: leadershipPct,
    note:
      input.isCaptain === true
        ? "Captaincy signal"
        : input.isCaptain === false
          ? "Not flagged as captain"
          : "Captaincy not recorded",
  });

  if (input.mediaNudgePct != null && Number.isFinite(input.mediaNudgePct)) {
    const mediaPct = clamp(Math.round(input.mediaNudgePct), -8, 8);
    if (mediaPct !== 0) {
      factors.push({
        key: "commercial",
        label: "Media corroboration",
        pct: mediaPct,
        note: "Adjustment from reputable media/club sources (reviewed)",
      });
    }
  }

  let multiplier = 1;
  for (const f of factors) {
    multiplier *= 1 + f.pct / 100;
  }
  multiplier = clamp(multiplier, 0.35, 2.4);

  const marketValueGbp = roundGbp(base * multiplier);
  const contractValueGbp = roundGbp(contractSalaryFromRating(rating));

  // Transfer value: rugby rarely has fees — frame as settlement context.
  let transferMult = 0.92;
  if (input.contractMonthsRemaining != null && input.contractMonthsRemaining <= 6) {
    transferMult = 0.55;
  } else if (input.contractMonthsRemaining != null && input.contractMonthsRemaining >= 24) {
    transferMult = 1.05;
  }
  if (input.age != null && input.age >= 32) transferMult *= 0.85;
  const transferValueGbp = roundGbp(marketValueGbp * transferMult);

  const futureGrowth =
    1 +
    clamp(potPct, -5, 14) / 100 +
    (input.age != null && input.age <= 24 ? 0.12 : input.age != null && input.age >= 30 ? -0.08 : 0.03);
  const futureValueGbp = roundGbp(marketValueGbp * clamp(futureGrowth, 0.55, 1.55));

  const peakCareerValueGbp = roundGbp(
    Math.max(marketValueGbp, futureValueGbp, base * 1.15 * clamp(multiplier, 0.8, 2.2)),
  );

  const riskFromAge = input.age != null && input.age >= 32 ? 25 : input.age != null && input.age >= 29 ? 12 : 5;
  const riskFromInjury = injuryPct <= -8 ? 30 : injuryPct <= -4 ? 18 : 6;
  const riskFromContract =
    input.contractMonthsRemaining == null ? 15 : input.contractMonthsRemaining <= 6 ? 20 : 5;
  const riskScore = clamp(Math.round(riskFromAge + riskFromInjury + riskFromContract), 5, 95);

  let dataPoints = 0;
  if (input.currentRating != null) dataPoints += 2;
  if (input.seasonRating != null) dataPoints += 1;
  if (input.lastFiveMatchRatings.length >= 3) dataPoints += 2;
  if (input.age != null) dataPoints += 1;
  if (input.internationalCaps != null) dataPoints += 1;
  if (input.competitionKey) dataPoints += 1;
  if (input.daysUnavailableLastYear != null) dataPoints += 1;
  if (input.contractMonthsRemaining != null) dataPoints += 1;
  const confidence = clamp(0.35 + dataPoints * 0.07, 0.35, 0.92);

  const seasonVsCareer =
    input.seasonRating != null && input.currentRating != null
      ? input.seasonRating - input.currentRating
      : formPct / 4;
  const trendPct =
    Number.isFinite(seasonVsCareer) ? Math.round(seasonVsCareer * 10) / 10 : null;
  const trendLabel =
    trendPct == null
      ? "Stable"
      : trendPct >= 3
        ? `▲ +${Math.abs(Math.round(trendPct))}%`
        : trendPct <= -3
          ? `▼ −${Math.abs(Math.round(trendPct))}%`
          : "→ Stable";

  const recommendations = {
    transfer:
      riskScore >= 60
        ? "High-risk move — verify medicals and remaining contract carefully."
        : transferValueGbp < marketValueGbp * 0.7
          ? "Out-of-contract / short-deal window — value is mostly wage-driven."
          : "Hold / monitor: market value supports a negotiated settlement rather than a football-style fee.",
    contract:
      contractValueGbp >= 500_000
        ? `Suggest top-tier band around £${Math.round(contractValueGbp / 1000)}k p.a. (plus image/intl).`
        : `Suggest wage band around £${Math.round(contractValueGbp / 1000)}k p.a. subject to league salary-cap rules.`,
    resale:
      futureValueGbp > marketValueGbp * 1.08
        ? "Positive resale outlook if form and availability hold."
        : futureValueGbp < marketValueGbp * 0.95
          ? "Resale potential limited — harvest peak now or extend carefully."
          : "Neutral resale outlook.",
  };

  return {
    modelVersion: PLAYER_VALUE_MODEL,
    currency: "GBP",
    marketValueGbp,
    transferValueGbp,
    contractValueGbp,
    futureValueGbp,
    peakCareerValueGbp,
    riskScore,
    confidence,
    trendPct,
    trendLabel,
    factors,
    recommendations,
    baseValueGbp: roundGbp(base),
    ratingBandLabel: bandLabel,
  };
}

/** Rough yearly timeline from current value + optional prior ratings by year. */
export function buildValueTimeline(input: {
  currentYear: number;
  currentMarketValueGbp: number;
  /** Map year → approximate career rating used for that season. */
  ratingByYear?: Record<number, number>;
}): PlayerValueTimelinePoint[] {
  const years: PlayerValueTimelinePoint[] = [];
  const start = input.currentYear - 4;
  for (let y = start; y <= input.currentYear; y++) {
    if (y === input.currentYear) {
      years.push({ year: y, marketValueGbp: input.currentMarketValueGbp });
      continue;
    }
    const rating = input.ratingByYear?.[y];
    if (rating != null) {
      years.push({
        year: y,
        marketValueGbp: roundGbp(baseMarketValueFromRating(rating).midGbp),
      });
    } else {
      // Soft back-cast: assume growth into current
      const steps = input.currentYear - y;
      const factor = Math.pow(0.82, steps);
      years.push({
        year: y,
        marketValueGbp: roundGbp(input.currentMarketValueGbp * factor),
      });
    }
  }
  return years;
}

export function formatGbpCompact(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `£${m >= 10 ? Math.round(m) : m.toFixed(2).replace(/\.?0+$/, "")}m`;
  }
  if (value >= 1_000) return `£${Math.round(value / 1000)}k`;
  return `£${Math.round(value)}`;
}
