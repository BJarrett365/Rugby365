/**
 * PlayerPositionUsageService — field-position usage from linked match data.
 * Pure calculations. Replacement/bench is an APPEARANCE ROLE, never a field position.
 * Do not invent positions for unknown appearances.
 */

export const POSITION_CLASS_THRESHOLDS = {
  /** PRIMARY >= 60% */
  primary: 60,
  /** SECONDARY 15–59% */
  secondary: 15,
  /** UTILITY 5–14%; below → RARE */
  utility: 5,
} as const;

export const POSITION_MODE_THRESHOLDS = {
  /** Career appearance coverage (linked / verified) for CAREER_* modes */
  careerAppearanceCoveragePct: 70,
  /** Minute coverage for CAREER_TIME */
  careerMinuteCoveragePct: 60,
  /** Position-known coverage for CAREER_USAGE */
  careerPositionKnownPct: 70,
} as const;

export type PositionClass = "PRIMARY" | "SECONDARY" | "UTILITY" | "RARE";

export type PositionUsageMode =
  | "CAREER_TIME"
  | "CAREER_USAGE"
  | "LINKED_USAGE"
  | "START_POSITION_ONLY";

export type PositionCalculationMethod =
  | "MINUTES"
  | "MIXED"
  | "APPEARANCE_BASED"
  | "START_POSITION_ONLY";

export type PositionUsageScope =
  | "career"
  | "current_season"
  | "last_24_months"
  | "linked_matches"
  | "international"
  | "club";

export type PositionUsageBarTone = "primary" | "secondary" | "utility" | "rare";

export type PositionUsageRow = {
  positionId: string;
  positionName: string;
  /** Canonical slug for stats deep-link, e.g. fly-half */
  positionSlug: string;
  number: number | null;
  appearances: number;
  starts: number;
  benchEntries: number;
  minutes: number | null;
  usagePercent: number;
  averageMatchRating: number | null;
  /** Position intelligence / rating when enough samples; else null. */
  positionRating: number | null;
  lastPlayed: string | null;
  classification: PositionClass;
  barTone: PositionUsageBarTone;
  jerseyNumbers: number[];
};

export type AppearanceRoleSummary = {
  starts: number;
  bench: number;
  total: number;
  startsPct: number;
  benchPct: number;
};

export type PositionCoverage = {
  verifiedCareerApps: number | null;
  linkedApps: number;
  positionKnownApps: number;
  minutesKnownApps: number;
  starts: number;
  benchApps: number;
  internationalLinked: number;
  clubLinked: number;
  /** 0–100 linked / verified career apps when verified known. */
  careerCoveragePct: number | null;
  /** 0–100 positionKnown / linked. */
  positionKnownPct: number;
  /** 0–100 minutesKnown / linked. */
  minuteCoveragePct: number;
  label: string;
  hoverBreakdown: string;
};

export type PlayerPositionUsageResult = {
  playerId: string | null;
  playerDisplayName: string | null;
  scope: PositionUsageScope;
  mode: PositionUsageMode;
  title: string;
  calculationMethod: PositionCalculationMethod;
  verifiedCareerApps: number | null;
  linkedApps: number;
  positionKnownApps: number;
  minutesKnownApps: number;
  starts: number;
  benchApps: number;
  coverage: PositionCoverage;
  positions: PositionUsageRow[];
  appearanceRole: AppearanceRoleSummary;
  insight: string | null;
  statsHref: string | null;
};

/** @deprecated Prefer PositionUsageRow — overview transition helper. */
export type PositionHistoryRow = {
  position: string;
  appearances: number;
  starts: number;
  percentage: number;
  classification: PositionClass;
  jerseyNumbers: number[];
  scope: "career" | "international" | "club";
};

export type PositionAppearanceInput = {
  positionName: string | null;
  jerseyNumber: number | null;
  squadRole: string | null;
  scope: "international" | "club";
  /** Whole-match minutes when known (null = unknown — never treat as 0). */
  minutesPlayed?: number | null;
  /** 0–10 match rating when known. */
  matchRating?: number | null;
  kickoffAt?: string | null;
  /** Optional mid-match segment bounds. */
  startMinute?: number | null;
  endMinute?: number | null;
  /** Optional verified CMS position label (last-resort fallback only). */
  verifiedCmsPosition?: string | null;
};

const JERSEY_TO_POSITION: Record<number, string> = {
  1: "Loosehead Prop",
  2: "Hooker",
  3: "Tighthead Prop",
  4: "Lock",
  5: "Lock",
  6: "Blindside Flanker",
  7: "Openside Flanker",
  8: "Number Eight",
  9: "Scrum-Half",
  10: "Fly-Half",
  11: "Wing",
  12: "Inside Centre",
  13: "Outside Centre",
  14: "Wing",
  15: "Fullback",
};

const POSITION_RATING_MIN_SAMPLES = 5;

export function classifyPositionUsage(pct: number): PositionClass {
  if (pct >= POSITION_CLASS_THRESHOLDS.primary) return "PRIMARY";
  if (pct >= POSITION_CLASS_THRESHOLDS.secondary) return "SECONDARY";
  if (pct >= POSITION_CLASS_THRESHOLDS.utility) return "UTILITY";
  return "RARE";
}

function barToneFor(classification: PositionClass): PositionUsageBarTone {
  if (classification === "PRIMARY") return "primary";
  if (classification === "SECONDARY") return "secondary";
  if (classification === "UTILITY") return "utility";
  return "rare";
}

export function isBenchRole(
  positionName: string | null | undefined,
  squadRole: string | null | undefined,
  jerseyNumber?: number | null,
): boolean {
  const p = (positionName ?? "").trim().toLowerCase();
  const role = (squadRole ?? "").toLowerCase();
  if (p.includes("reserve") || p.includes("replacement") || p.includes("bench")) return true;
  if (role.includes("bench") || role.includes("reserve") || role.includes("replacement") || role.includes("sub")) {
    return true;
  }
  if (role === "starter" || role.includes("start") || role === "xv" || role === "starting") return false;
  if (jerseyNumber != null && jerseyNumber >= 16 && jerseyNumber <= 23) return true;
  return false;
}

export function positionSlug(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Resolve a field position label. Never returns Replacement/Bench.
 * Jersey is fallback only when name is missing/unusable.
 */
export function normalizeFieldPosition(
  raw: string | null | undefined,
  jersey: number | null,
  verifiedCms?: string | null,
): string | null {
  const p = (raw ?? "").trim().toLowerCase();
  if (p.includes("reserve") || p.includes("replacement") || p.includes("bench")) {
    // Replacement is an appearance role — never invent a field position from jersey alone.
    return null;
  }

  if (p.includes("fly") || p.includes("first five") || p === "fh" || p === "out-half" || p === "outhalf") {
    return "Fly-Half";
  }
  if (p.includes("inside centre") || p.includes("second five") || p === "ic") return "Inside Centre";
  if (p.includes("outside centre") || p === "oc") return "Outside Centre";
  if (p.includes("centre") || p.includes("center") || p.includes("midfield")) {
    if (jersey === 12) return "Inside Centre";
    if (jersey === 13) return "Outside Centre";
    return "Centre";
  }
  if (p.includes("full")) return "Fullback";
  if (p.includes("wing") || p.includes("winger")) return "Wing";
  if (p.includes("scrum")) return "Scrum-Half";
  if (p.includes("hooker")) return "Hooker";
  if (p.includes("loosehead")) return "Loosehead Prop";
  if (p.includes("tighthead")) return "Tighthead Prop";
  if (p.includes("prop")) return "Prop";
  if (p.includes("lock") || p.includes("second row")) return "Lock";
  if (p.includes("blindside")) return "Blindside Flanker";
  if (p.includes("openside")) return "Openside Flanker";
  if (p.includes("flanker") || p.includes("flank")) return "Flanker";
  if (p.includes("number eight") || p.includes("no. 8") || p.includes("no 8") || p === "8") {
    return "Number Eight";
  }

  if ((!p || p === "unknown" || p === "n/a") && jersey != null && JERSEY_TO_POSITION[jersey]) {
    return JERSEY_TO_POSITION[jersey]!;
  }

  if (!p && verifiedCms) {
    return normalizeFieldPosition(verifiedCms, jersey, null);
  }

  if (!p) return null;
  return raw!.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function typicalJersey(position: string): number | null {
  const invert = Object.entries(JERSEY_TO_POSITION).find(([, v]) => v === position);
  return invert ? Number(invert[0]) : null;
}

function roundWholePct(n: number): number {
  return Math.round(n);
}

function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function segmentMinutes(r: PositionAppearanceInput): number | null {
  if (
    r.startMinute != null &&
    r.endMinute != null &&
    Number.isFinite(r.startMinute) &&
    Number.isFinite(r.endMinute)
  ) {
    const m = Math.max(0, r.endMinute - r.startMinute);
    return m > 0 ? m : null;
  }
  if (r.minutesPlayed != null && Number.isFinite(r.minutesPlayed) && r.minutesPlayed > 0) {
    return r.minutesPlayed;
  }
  return null;
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return roundWholePct((part / whole) * 100);
}

export function resolvePositionUsageMode(input: {
  linkedApps: number;
  verifiedCareerApps: number | null;
  positionKnownApps: number;
  minutesKnownApps: number;
  /** Apps where a field position is known AND the appearance was a start. */
  startPositionKnownApps: number;
  /** Bench apps that still have a field-position label (entry position). */
  benchPositionKnownApps: number;
}): { mode: PositionUsageMode; title: string; scope: PositionUsageScope } {
  const {
    linkedApps,
    verifiedCareerApps,
    positionKnownApps,
    minutesKnownApps,
    startPositionKnownApps,
    benchPositionKnownApps,
  } = input;

  const careerCoveragePct =
    verifiedCareerApps != null && verifiedCareerApps > 0
      ? (linkedApps / verifiedCareerApps) * 100
      : null;
  const minuteCoveragePct = linkedApps > 0 ? (minutesKnownApps / linkedApps) * 100 : 0;
  const positionKnownPct = linkedApps > 0 ? (positionKnownApps / linkedApps) * 100 : 0;

  const careerReady =
    careerCoveragePct != null &&
    careerCoveragePct >= POSITION_MODE_THRESHOLDS.careerAppearanceCoveragePct;

  if (
    careerReady &&
    minutesKnownApps > 0 &&
    minuteCoveragePct >= POSITION_MODE_THRESHOLDS.careerMinuteCoveragePct
  ) {
    return {
      mode: "CAREER_TIME",
      title: "POSITION TIME (CAREER)",
      scope: "career",
    };
  }

  if (careerReady && positionKnownPct >= POSITION_MODE_THRESHOLDS.careerPositionKnownPct) {
    return {
      mode: "CAREER_USAGE",
      title: "POSITION USAGE (CAREER)",
      scope: "career",
    };
  }

  // Thin / incomplete career data — never claim career time/usage.
  // Start-only: every labelled field position is a start (no bench entry positions).
  // Minutes on those starts do not upgrade the label — coverage is still lineup/start based.
  const startOnly =
    positionKnownApps > 0 &&
    benchPositionKnownApps === 0 &&
    startPositionKnownApps === positionKnownApps;

  if (startOnly) {
    return {
      mode: "START_POSITION_ONLY",
      title: "STARTING POSITION — LINKED MATCHES",
      scope: "linked_matches",
    };
  }

  return {
    mode: "LINKED_USAGE",
    title: "POSITION USAGE (LINKED MATCHES)",
    scope: "linked_matches",
  };
}

export function buildFactualPositionInsight(input: {
  displayName: string | null;
  mode: PositionUsageMode;
  calculationMethod: PositionCalculationMethod;
  positions: PositionUsageRow[];
  appearanceRole: AppearanceRoleSummary;
  positionKnownApps: number;
}): string | null {
  const top = input.positions[0];
  const name = input.displayName?.trim() || "This player";

  if (!top) {
    if (input.appearanceRole.total > 0 && input.appearanceRole.benchPct >= 70) {
      return `${name} has linked match data but no field position labels yet — ${input.appearanceRole.bench} of ${input.appearanceRole.total} appearances were from the bench.`;
    }
    return null;
  }

  if (input.mode === "START_POSITION_ONLY") {
    if (input.positions.length === 1 && top.usagePercent >= 99) {
      return `All ${top.starts} known starts in the current Rugby365 dataset have been at ${top.positionName.toLowerCase()}.`;
    }
    return `${top.usagePercent}% of known starts in the current Rugby365 dataset have been at ${top.positionName.toLowerCase()}.`;
  }

  if (input.calculationMethod === "MINUTES" || input.mode === "CAREER_TIME") {
    if (input.positions.length >= 2 && top.usagePercent < 85) {
      const second = input.positions[1]!;
      return `Primarily a ${top.positionName.toLowerCase()}, with ${second.usagePercent}% of recorded minutes at ${second.positionName.toLowerCase()}.`;
    }
    return `${top.usagePercent}% of his recorded career minutes have been at ${top.positionName.toLowerCase()}.`;
  }

  const unit =
    input.mode === "CAREER_USAGE" ? "recorded career appearances" : "linked field appearances";
  const primaryLine = `${name} has played mainly as ${top.positionName} (${top.usagePercent}% of ${unit}).`;

  if (input.appearanceRole.total >= 5 && input.appearanceRole.benchPct >= 60) {
    return `${primaryLine} Appeared from the bench in ${Math.round(input.appearanceRole.benchPct)}% of linked matches.`;
  }
  if (input.positions.length >= 2 && top.usagePercent < 70) {
    const second = input.positions[1]!;
    return `${primaryLine} Also used at ${second.positionName} (${second.usagePercent}%).`;
  }
  return primaryLine;
}

function buildCoverageLabel(input: {
  mode: PositionUsageMode;
  linkedApps: number;
  careerCoveragePct: number | null;
  internationalLinked: number;
  clubLinked: number;
}): string {
  const { mode, linkedApps, careerCoveragePct, internationalLinked, clubLinked } = input;
  if (linkedApps === 0) return "No linked appearance data yet";

  if (mode === "START_POSITION_ONLY" || mode === "LINKED_USAGE") {
    const parts = [`Based on ${linkedApps} linked appearances`];
    if (clubLinked === 0 && internationalLinked > 0) {
      parts.push("International data only · club position history not yet linked");
    } else if (internationalLinked === 0 && clubLinked > 0) {
      parts.push("Club data only");
    }
    if (careerCoveragePct != null) {
      parts[0] = `Based on ${linkedApps} linked appearances · ${careerCoveragePct}% coverage`;
    }
    return parts.join(" · ");
  }

  if (careerCoveragePct != null) {
    return `Based on ${linkedApps} linked appearances · ${careerCoveragePct}% career coverage`;
  }
  return `Based on ${linkedApps} linked appearances`;
}

/**
 * Core aggregator. Minutes preferred when present; otherwise appearance / start-position based.
 * Mid-match segments supported via startMinute/endMinute when provided.
 */
export function computePlayerPositionUsage(input: {
  playerId?: string | null;
  displayName?: string | null;
  slug?: string | null;
  rows: PositionAppearanceInput[];
  /** Verified career appearance total (caps + verified club when available). */
  verifiedCareerApps?: number | null;
}): PlayerPositionUsageResult {
  const rows = input.rows;
  const verifiedCareerApps =
    input.verifiedCareerApps != null && input.verifiedCareerApps > 0
      ? input.verifiedCareerApps
      : null;

  let starts = 0;
  let bench = 0;
  let positionKnownApps = 0;
  let minutesKnownApps = 0;
  let startPositionKnownApps = 0;
  let benchPositionKnownApps = 0;

  type Agg = {
    appearances: number;
    starts: number;
    benchEntries: number;
    minutes: number;
    minutesKnown: boolean;
    ratings: number[];
    lastPlayed: string | null;
    jerseys: Set<number>;
  };
  const map = new Map<string, Agg>();

  let minutesWeightUsed = 0;
  let appearanceWeightUsed = 0;

  for (const r of rows) {
    const benchApp = isBenchRole(r.positionName, r.squadRole, r.jerseyNumber);
    if (benchApp) bench += 1;
    else starts += 1;

    const label = normalizeFieldPosition(r.positionName, r.jerseyNumber, r.verifiedCmsPosition);
    const mins = segmentMinutes(r);
    if (mins != null) minutesKnownApps += 1;

    if (!label) continue;
    positionKnownApps += 1;
    if (benchApp) benchPositionKnownApps += 1;
    else startPositionKnownApps += 1;

    if (mins != null) minutesWeightUsed += 1;
    else appearanceWeightUsed += 1;

    const cur =
      map.get(label) ??
      ({
        appearances: 0,
        starts: 0,
        benchEntries: 0,
        minutes: 0,
        minutesKnown: false,
        ratings: [],
        lastPlayed: null,
        jerseys: new Set<number>(),
      } satisfies Agg);

    cur.appearances += 1;
    if (benchApp) cur.benchEntries += 1;
    else cur.starts += 1;
    if (mins != null) {
      cur.minutes += mins;
      cur.minutesKnown = true;
    }
    if (r.matchRating != null && Number.isFinite(r.matchRating)) cur.ratings.push(r.matchRating);
    if (r.jerseyNumber != null) cur.jerseys.add(r.jerseyNumber);
    if (r.kickoffAt) {
      if (!cur.lastPlayed || r.kickoffAt > cur.lastPlayed) cur.lastPlayed = r.kickoffAt;
    }
    map.set(label, cur);
  }

  const linkedApps = rows.length;
  const { mode, title, scope } = resolvePositionUsageMode({
    linkedApps,
    verifiedCareerApps,
    positionKnownApps,
    minutesKnownApps,
    startPositionKnownApps,
    benchPositionKnownApps,
  });

  const calculationMethod: PositionCalculationMethod =
    mode === "START_POSITION_ONLY"
      ? "START_POSITION_ONLY"
      : minutesWeightUsed > 0 && appearanceWeightUsed === 0
        ? "MINUTES"
        : minutesWeightUsed > 0 && appearanceWeightUsed > 0
          ? "MIXED"
          : "APPEARANCE_BASED";

  const useMinutes =
    (calculationMethod === "MINUTES" || calculationMethod === "MIXED") &&
    [...map.values()].some((v) => v.minutesKnown && v.minutes > 0);

  const denomAppearances = [...map.values()].reduce((s, v) => {
    if (mode === "START_POSITION_ONLY") return s + v.starts;
    return s + v.appearances;
  }, 0);
  const denomMinutes = [...map.values()].reduce((s, v) => s + (v.minutesKnown ? v.minutes : 0), 0);

  const positions: PositionUsageRow[] = [...map.entries()]
    .map(([positionName, v]) => {
      let usagePercent = 0;
      if (useMinutes && denomMinutes > 0 && v.minutesKnown) {
        usagePercent = roundWholePct((v.minutes / denomMinutes) * 100);
      } else if (mode === "START_POSITION_ONLY" && denomAppearances > 0) {
        usagePercent = roundWholePct((v.starts / denomAppearances) * 100);
      } else if (denomAppearances > 0) {
        usagePercent = roundWholePct((v.appearances / denomAppearances) * 100);
      }
      const classification = classifyPositionUsage(usagePercent);
      const jerseys = [...v.jerseys].sort((a, b) => a - b);
      const avg = average(v.ratings);
      const positionRating =
        v.ratings.length >= POSITION_RATING_MIN_SAMPLES && avg != null
          ? Math.round(avg * 10)
          : null;
      return {
        positionId: positionSlug(positionName),
        positionName,
        positionSlug: positionSlug(positionName),
        number: jerseys[0] ?? typicalJersey(positionName),
        appearances: v.appearances,
        starts: v.starts,
        benchEntries: v.benchEntries,
        minutes: v.minutesKnown ? v.minutes : null,
        usagePercent,
        averageMatchRating: avg,
        positionRating,
        lastPlayed: v.lastPlayed,
        classification,
        barTone: barToneFor(classification),
        jerseyNumbers: jerseys,
      } satisfies PositionUsageRow;
    })
    .filter((p) => (mode === "START_POSITION_ONLY" ? p.starts > 0 : p.appearances > 0))
    .sort((a, b) => b.usagePercent - a.usagePercent || b.appearances - a.appearances);

  // Renormalise whole % to 100 (largest remainder on top row)
  if (positions.length > 0) {
    const sum = positions.reduce((s, p) => s + p.usagePercent, 0);
    if (sum !== 100 && sum > 0) {
      const diff = 100 - sum;
      const nextPct = Math.max(0, positions[0]!.usagePercent + diff);
      const classification = classifyPositionUsage(nextPct);
      positions[0] = {
        ...positions[0]!,
        usagePercent: nextPct,
        classification,
        barTone: barToneFor(classification),
      };
    }
  }

  const appearanceRole: AppearanceRoleSummary = {
    starts,
    bench,
    total: linkedApps,
    startsPct: linkedApps ? Math.round((starts / linkedApps) * 1000) / 10 : 0,
    benchPct: linkedApps ? Math.round((bench / linkedApps) * 1000) / 10 : 0,
  };

  const clubLinked = rows.filter((r) => r.scope === "club").length;
  const intlLinked = rows.filter((r) => r.scope === "international").length;
  const careerCoveragePct =
    verifiedCareerApps != null ? Math.min(100, pctOf(linkedApps, verifiedCareerApps)) : null;
  const positionKnownPct = pctOf(positionKnownApps, linkedApps);
  const minuteCoveragePct = pctOf(minutesKnownApps, linkedApps);

  const coverageLabel = buildCoverageLabel({
    mode,
    linkedApps,
    careerCoveragePct,
    internationalLinked: intlLinked,
    clubLinked,
  });

  const hoverBreakdown = [
    verifiedCareerApps != null ? `Verified career apps: ${verifiedCareerApps}` : null,
    `Linked: ${linkedApps}`,
    `Position known: ${positionKnownApps}`,
    `Minutes known: ${minutesKnownApps}`,
    `Starts: ${starts}`,
    `Bench: ${bench}`,
    `International linked: ${intlLinked}`,
    `Club linked: ${clubLinked}`,
    `Mode: ${mode}`,
    `Calculation: ${calculationMethod}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const insight = buildFactualPositionInsight({
    displayName: input.displayName ?? null,
    mode,
    calculationMethod,
    positions,
    appearanceRole,
    positionKnownApps,
  });

  const statsHref = input.slug
    ? `/players/${input.slug}/stats?view=positions`
    : null;

  return {
    playerId: input.playerId ?? null,
    playerDisplayName: input.displayName ?? null,
    scope,
    mode,
    title,
    calculationMethod,
    verifiedCareerApps,
    linkedApps,
    positionKnownApps,
    minutesKnownApps,
    starts,
    benchApps: bench,
    coverage: {
      verifiedCareerApps,
      linkedApps,
      positionKnownApps,
      minutesKnownApps,
      starts,
      benchApps: bench,
      internationalLinked: intlLinked,
      clubLinked,
      careerCoveragePct,
      positionKnownPct,
      minuteCoveragePct,
      label: coverageLabel,
      hoverBreakdown,
    },
    positions,
    appearanceRole,
    insight,
    statsHref,
  };
}

/**
 * Legacy wrapper used by overview V2 — maps to career/intl/club lists + usage result.
 */
export function buildPositionHistory(
  rows: PositionAppearanceInput[],
  options: {
    playerId?: string | null;
    displayName?: string | null;
    slug?: string | null;
    verifiedCareerApps?: number | null;
    /** @deprecated use verifiedCareerApps */
    verifiedCaps?: number | null;
  } = {},
): {
  career: PositionHistoryRow[];
  international: PositionHistoryRow[];
  club: PositionHistoryRow[];
  appearanceRole: AppearanceRoleSummary;
  coverageNote: string;
  title: string;
  usage: PlayerPositionUsageResult;
} {
  const verifiedCareerApps = options.verifiedCareerApps ?? options.verifiedCaps ?? null;
  const usage = computePlayerPositionUsage({
    playerId: options.playerId,
    displayName: options.displayName,
    slug: options.slug,
    rows,
    verifiedCareerApps,
  });

  const toLegacy = (
    list: PositionUsageRow[],
    legacyScope: "career" | "international" | "club",
  ): PositionHistoryRow[] =>
    list.map((p) => ({
      position: p.positionName,
      appearances: p.appearances,
      starts: p.starts,
      percentage: p.usagePercent,
      classification: p.classification,
      jerseyNumbers: p.jerseyNumbers,
      scope: legacyScope,
    }));

  const intlRows = rows.filter((r) => r.scope === "international");
  const clubRows = rows.filter((r) => r.scope === "club");
  const intlUsage = computePlayerPositionUsage({
    rows: intlRows,
    verifiedCareerApps,
  });
  const clubUsage = computePlayerPositionUsage({ rows: clubRows });

  return {
    career: toLegacy(usage.positions, "career"),
    international: toLegacy(intlUsage.positions, "international"),
    club: toLegacy(clubUsage.positions, "club"),
    appearanceRole: usage.appearanceRole,
    coverageNote: usage.coverage.label,
    title: usage.title,
    usage,
  };
}
