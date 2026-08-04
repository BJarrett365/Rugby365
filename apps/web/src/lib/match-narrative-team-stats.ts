/**
 * Team match-stat commentary lines (possession, territory, summary, defence, etc.).
 */

export type NarrativeTeamStatLine = {
  minute: number;
  second: number;
  outputType: string;
  segment: string;
  body: string;
};

export type NarrativeTeamSideStats = {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  carries: number;
  metres: number;
  tackles: number;
  turnoversWon: number;
  possessionOverallPct: number | null;
  possessionFirstHalfPct: number | null;
  possessionSecondHalfPct: number | null;
  territoryOverallPct: number | null;
  territoryFirstHalfPct: number | null;
  territorySecondHalfPct: number | null;
  missedTackles: number | null;
  tackleSuccessPct: number | null;
  kicksFromHand: number | null;
  kickingMetres: number | null;
  kickingSuccessPct: number | null;
  rucksWon: number | null;
  rucksLost: number | null;
  totalRucks: number | null;
  rucksSuccessPct: number | null;
  scrumSuccessPct: number | null;
  lineoutSuccessPct: number | null;
};

export type NarrativeMatchTeamStats = {
  home: NarrativeTeamSideStats;
  away: NarrativeTeamSideStats;
};

function sectionNum(
  sections: Record<string, Record<string, number>> | undefined,
  section: string,
  ...keys: string[]
): number | null {
  const bag = sections?.[section];
  if (!bag) return null;
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

/** Normalize 0–1 fractions or already-percent values to whole percent. */
export function asPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

export function normalizeTeamSideStats(input: {
  tries?: number;
  conversions?: number;
  penalties?: number;
  dropGoals?: number;
  carries?: number;
  metres?: number;
  tackles?: number;
  turnoversWon?: number;
  sections?: Record<string, Record<string, number>>;
}): NarrativeTeamSideStats {
  const sections = input.sections;
  return {
    tries: input.tries ?? 0,
    conversions: input.conversions ?? 0,
    penalties: input.penalties ?? 0,
    dropGoals: input.dropGoals ?? 0,
    carries: input.carries ?? 0,
    metres: input.metres ?? 0,
    tackles: input.tackles ?? 0,
    turnoversWon: input.turnoversWon ?? 0,
    possessionOverallPct: asPercent(
      sectionNum(sections, "possession", "overall_percentage", "percentage"),
    ),
    possessionFirstHalfPct: asPercent(
      sectionNum(sections, "possession", "first_half_percentage", "1st_half_percentage"),
    ),
    possessionSecondHalfPct: asPercent(
      sectionNum(sections, "possession", "second_half_percentage", "2nd_half_percentage"),
    ),
    territoryOverallPct: asPercent(
      sectionNum(sections, "territory", "overall_percentage", "percentage"),
    ),
    territoryFirstHalfPct: asPercent(
      sectionNum(sections, "territory", "first_half_percentage", "1st_half_percentage"),
    ),
    territorySecondHalfPct: asPercent(
      sectionNum(sections, "territory", "second_half_percentage", "2nd_half_percentage"),
    ),
    missedTackles: sectionNum(sections, "defence", "tackles_missed", "missed_tackles"),
    tackleSuccessPct: asPercent(
      sectionNum(sections, "defence", "tackles_success_percentage", "tackle_success_percentage"),
    ),
    kicksFromHand: sectionNum(sections, "kicking", "kicks_from_hand", "kicks"),
    kickingMetres: sectionNum(sections, "kicking", "kicking_metres", "metres"),
    kickingSuccessPct: asPercent(
      sectionNum(sections, "kicking", "kicking_success_percentage", "kick_success_percentage"),
    ),
    rucksWon: sectionNum(sections, "rucks", "rucks_won"),
    rucksLost: sectionNum(sections, "rucks", "rucks_lost"),
    totalRucks: sectionNum(sections, "rucks", "total_rucks"),
    rucksSuccessPct: asPercent(sectionNum(sections, "rucks", "rucks_success_percentage")),
    scrumSuccessPct: asPercent(
      sectionNum(sections, "set_piece", "scrums_success_percentage", "scrum_success_percentage"),
    ),
    lineoutSuccessPct: asPercent(
      sectionNum(sections, "set_piece", "lineouts_success_percentage", "lineout_success_percentage"),
    ),
  };
}

function line(
  minute: number,
  second: number,
  segment: string,
  body: string,
): NarrativeTeamStatLine {
  return {
    minute,
    second,
    outputType: "match_fact",
    segment,
    body,
  };
}

function pctPair(
  homeName: string,
  awayName: string,
  homePct: number | null,
  awayPct: number | null,
): string | null {
  if (homePct == null || awayPct == null) return null;
  return `${homeName} ${homePct}%, ${awayName} ${awayPct}%`;
}

function countPair(
  homeName: string,
  awayName: string,
  homeValue: number | null | undefined,
  awayValue: number | null | undefined,
  unit = "",
): string | null {
  if (homeValue == null || awayValue == null) return null;
  if (homeValue === 0 && awayValue === 0) return null;
  const suffix = unit ? unit : "";
  return `${homeName} ${homeValue}${suffix}, ${awayName} ${awayValue}${suffix}`;
}

export function hasNarrativeTeamStats(stats: NarrativeMatchTeamStats | null | undefined): boolean {
  if (!stats) return false;
  const sides = [stats.home, stats.away];
  return sides.some(
    (s) =>
      s.tries + s.conversions + s.penalties + s.carries + s.metres + s.tackles + s.turnoversWon > 0 ||
      s.possessionOverallPct != null ||
      s.territoryOverallPct != null ||
      s.possessionFirstHalfPct != null ||
      s.territoryFirstHalfPct != null,
  );
}

/** First-half possession + territory (emit around half-time). */
export function buildHalfTimeTeamStatLines(
  homeName: string,
  awayName: string,
  stats: NarrativeMatchTeamStats | null | undefined,
  minute = 40,
): NarrativeTeamStatLine[] {
  if (!hasNarrativeTeamStats(stats)) return [];
  const home = stats!.home;
  const away = stats!.away;
  const out: NarrativeTeamStatLine[] = [];
  let second = 12;

  const poss = pctPair(
    homeName,
    awayName,
    home.possessionFirstHalfPct,
    away.possessionFirstHalfPct,
  );
  if (poss) {
    out.push(line(minute, second, "possession_first_half", `${minute}' — First-half possession: ${poss}.`));
    second += 2;
  }

  const terr = pctPair(
    homeName,
    awayName,
    home.territoryFirstHalfPct,
    away.territoryFirstHalfPct,
  );
  if (terr) {
    out.push(
      line(minute, second, "territory_first_half", `${minute}' — Territory summary, first half: ${terr}.`),
    );
  }

  return out;
}

/** Full-match / late-game team stat updates. */
export function buildFullMatchTeamStatLines(
  homeName: string,
  awayName: string,
  stats: NarrativeMatchTeamStats | null | undefined,
  minute = 80,
  options?: { spreadAcrossMinutes?: boolean },
): NarrativeTeamStatLine[] {
  if (!hasNarrativeTeamStats(stats)) return [];
  const home = stats!.home;
  const away = stats!.away;
  const out: NarrativeTeamStatLine[] = [];
  let second = 12;
  let clockMinute = Math.min(79, Math.max(70, minute - 8));
  const spread = Boolean(options?.spreadAcrossMinutes);

  const push = (segment: string, bodyTemplate: string) => {
    const at = spread ? clockMinute : minute;
    const body = bodyTemplate.replace(/^\d+'/, `${at}'`);
    out.push(line(at, spread ? 0 : second, segment, body));
    if (spread) clockMinute = Math.min(79, clockMinute + 1);
    else second += 2;
  };

  const possOverall = pctPair(
    homeName,
    awayName,
    home.possessionOverallPct,
    away.possessionOverallPct,
  );
  if (possOverall) {
    push("possession_update", `${minute}' — Possession update: ${possOverall}.`);
  }

  const poss2h = pctPair(
    homeName,
    awayName,
    home.possessionSecondHalfPct,
    away.possessionSecondHalfPct,
  );
  if (poss2h) {
    push("possession_second_half", `${minute}' — Second-half possession: ${poss2h}.`);
  }

  const summaryBits = [
    `tries ${home.tries}–${away.tries}`,
    `conversions ${home.conversions}–${away.conversions}`,
    `penalties ${home.penalties}–${away.penalties}`,
  ];
  if (home.dropGoals + away.dropGoals > 0) {
    summaryBits.push(`drop goals ${home.dropGoals}–${away.dropGoals}`);
  }
  summaryBits.push(
    `carries ${home.carries}–${away.carries}`,
    `metres ${home.metres}–${away.metres}`,
    `tackles ${home.tackles}–${away.tackles}`,
    `turnovers won ${home.turnoversWon}–${away.turnoversWon}`,
  );
  if (home.tries + away.tries + home.carries + away.carries + home.metres + away.metres > 0) {
    push(
      "match_summary_stats",
      `${minute}' — Match summary: ${summaryBits.join(", ")}.`,
    );
  }

  const terr2h = pctPair(
    homeName,
    awayName,
    home.territorySecondHalfPct,
    away.territorySecondHalfPct,
  );
  if (terr2h) {
    push(
      "territory_second_half",
      `${minute}' — Territory summary, second half: ${terr2h}.`,
    );
  }

  const terrOverall = pctPair(
    homeName,
    awayName,
    home.territoryOverallPct,
    away.territoryOverallPct,
  );
  if (terrOverall) {
    push("territory_update", `${minute}' — Territory overall: ${terrOverall}.`);
  }

  if (home.tackles + away.tackles > 0 || home.missedTackles != null || away.missedTackles != null) {
    const homeMiss = home.missedTackles ?? 0;
    const awayMiss = away.missedTackles ?? 0;
    const homeSucc =
      home.tackleSuccessPct != null ? ` (${home.tackleSuccessPct}% success)` : "";
    const awaySucc =
      away.tackleSuccessPct != null ? ` (${away.tackleSuccessPct}% success)` : "";
    push(
      "defence_update",
      `${minute}' — Defence: ${homeName} ${home.tackles} tackles, ${homeMiss} missed${homeSucc}; ${awayName} ${away.tackles} tackles, ${awayMiss} missed${awaySucc}.`,
    );
  }

  const turnovers = countPair(homeName, awayName, home.turnoversWon, away.turnoversWon);
  if (turnovers) {
    push("turnovers_update", `${minute}' — Turnovers won: ${turnovers}.`);
  }

  const kickBits: string[] = [];
  if (home.kickingMetres != null || away.kickingMetres != null) {
    kickBits.push(
      `${homeName} ${home.kickingMetres ?? 0}m, ${awayName} ${away.kickingMetres ?? 0}m from hand`,
    );
  }
  if (home.kicksFromHand || away.kicksFromHand) {
    kickBits.push(
      `kicks ${home.kicksFromHand ?? 0}–${away.kicksFromHand ?? 0}`,
    );
  }
  if (home.kickingSuccessPct != null && away.kickingSuccessPct != null) {
    kickBits.push(
      `success ${home.kickingSuccessPct}%–${away.kickingSuccessPct}%`,
    );
  }
  if (kickBits.length) {
    push("kicking_update", `${minute}' — Kicking update: ${kickBits.join("; ")}.`);
  }

  if (
    home.rucksWon != null ||
    away.rucksWon != null ||
    home.totalRucks != null ||
    away.totalRucks != null
  ) {
    const homeTotal = home.totalRucks ?? (home.rucksWon ?? 0) + (home.rucksLost ?? 0);
    const awayTotal = away.totalRucks ?? (away.rucksWon ?? 0) + (away.rucksLost ?? 0);
    const homePct = home.rucksSuccessPct != null ? ` (${home.rucksSuccessPct}%)` : "";
    const awayPct = away.rucksSuccessPct != null ? ` (${away.rucksSuccessPct}%)` : "";
    push(
      "rucks_update",
      `${minute}' — Rucks update: ${homeName} won ${home.rucksWon ?? 0} of ${homeTotal}${homePct}; ${awayName} won ${away.rucksWon ?? 0} of ${awayTotal}${awayPct}.`,
    );
  }

  if (
    home.scrumSuccessPct != null ||
    away.scrumSuccessPct != null ||
    home.lineoutSuccessPct != null ||
    away.lineoutSuccessPct != null
  ) {
    const homeScrum = home.scrumSuccessPct != null ? `scrum ${home.scrumSuccessPct}%` : null;
    const awayScrum = away.scrumSuccessPct != null ? `scrum ${away.scrumSuccessPct}%` : null;
    const homeLo = home.lineoutSuccessPct != null ? `lineout ${home.lineoutSuccessPct}%` : null;
    const awayLo = away.lineoutSuccessPct != null ? `lineout ${away.lineoutSuccessPct}%` : null;
    const homeBit = [homeScrum, homeLo].filter(Boolean).join(" / ");
    const awayBit = [awayScrum, awayLo].filter(Boolean).join(" / ");
    if (homeBit || awayBit) {
      push(
        "set_piece_update",
        `${minute}' — Set-piece update: ${homeName} ${homeBit || "n/a"}; ${awayName} ${awayBit || "n/a"}.`,
      );
    }
  }

  return out;
}
