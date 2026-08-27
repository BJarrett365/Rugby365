/**
 * Pure Career V2 aggregation — no DB. UI must not recalculate beyond display formatting.
 */
import { isInternationalCompetitionType } from "./public-player-filters";
import { normalizeFieldPosition } from "./player-position-usage-service";
import { formatSeasonRangeLabel } from "./season-label-utils";
import type {
  CareerAward,
  CareerCompetitionPoints,
  CareerFooterFact,
  CareerHighStat,
  CareerMatchHigh,
  CareerMetaLine,
  CareerMilestone,
  CareerPositionSlice,
  CareerSeasonRow,
  CareerTimelinePoint,
  CareerTotalCell,
  PublicPlayerCareerV2Dto,
} from "./public-player-career-v2-types";

export type CareerMatchInput = {
  fixtureId: string;
  kickoffAt: Date | null;
  status: string;
  seasonStart: number | null;
  seasonLabel: string | null;
  competitionName: string | null;
  competitionType: string | null;
  teamId: string;
  teamName: string;
  opponentName: string | null;
  opponentCountryName: string | null;
  result: "W" | "D" | "L" | null;
  positionName: string | null;
  jerseyNumber: number | null;
  squadRole: string | null;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  points: number;
  minutes: number | null;
  assists: number | null;
  cleanBreaks: number | null;
  defendersBeaten: number | null;
  tacklesMade: number | null;
  passes: number | null;
  badPasses: number | null;
  conversionAttempts: number | null;
  penaltyAttempts: number | null;
  dropGoalAttempts: number | null;
  isInternational: boolean;
  hasPerf: boolean;
};

export type CareerStintInput = {
  careerType: string;
  yearsLabel: string;
  teamName: string;
  startYear: number | null;
  endYear: number | null;
};

export type CareerAchievementInput = {
  id: string;
  year: number | null;
  title: string;
  detail: string | null;
  verificationStatus: string;
};

const POSITION_COLORS = ["#22c55e", "#f59e0b", "#38bdf8", "#c084fc", "#e7bc63", "#ef4444"];

export function displayClubName(name: string): string {
  const cleaned = name
    .replace(/\s+(XXIII|XXII|XXI|XX|XIX|XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|IX|VIII|VII|VI|IV|V|III|II)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/^unknown\b/i.test(cleaned) || /^orphan-/i.test(cleaned)) return "Unknown club";
  return cleaned;
}

export function competitionBucketLabel(
  competitionName: string | null,
  competitionType: string | null,
  isInternational: boolean,
): string {
  const n = (competitionName ?? "").trim().toLowerCase();
  if (n.includes("world cup")) return "Rugby World Cup";
  if (isInternational || isInternationalCompetitionType(competitionType)) {
    return "Test Matches";
  }
  if (n.includes("united rugby") || /\burc\b/.test(n) || n.includes("pro14") || n.includes("rainbow cup")) {
    return "URC";
  }
  if (n.includes("challenge cup") || n.includes("challenge")) return "Challenge Cup";
  if (n.includes("champions cup") || n.includes("european rugby champions")) return "Champions Cup";
  if (n.includes("currie cup")) return "Currie Cup";
  if (n.includes("super rugby")) return "Super Rugby";
  return competitionName?.trim() || "Other";
}

function isCompleted(status: string): boolean {
  const s = status.toLowerCase();
  return s === "completed" || s === "result" || s === "finished" || s === "full_time" || s === "ft";
}

function sum(nums: Array<number | null | undefined>): number {
  let t = 0;
  for (const n of nums) {
    if (n != null && Number.isFinite(n)) t += n;
  }
  return t;
}

function avg(total: number, count: number): number | null {
  if (count <= 0) return null;
  return Math.round((total / count) * 10) / 10;
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function kickAccuracyPct(rows: CareerMatchInput[]): number | null {
  let made = 0;
  let attempts = 0;
  let hasAttemptData = false;
  for (const r of rows) {
    // Only use rows with real attempt counts — never treat made == attempts.
    if (r.conversionAttempts == null && r.penaltyAttempts == null && r.dropGoalAttempts == null) {
      continue;
    }
    hasAttemptData = true;
    const m = r.conversions + r.penalties + r.dropGoals;
    const a =
      (r.conversionAttempts ?? r.conversions) +
      (r.penaltyAttempts ?? r.penalties) +
      (r.dropGoalAttempts ?? r.dropGoals);
    if (a > 0) {
      made += m;
      attempts += a;
    }
  }
  if (!hasAttemptData || attempts <= 0) return null;
  return pct(made, attempts);
}

function passPct(rows: CareerMatchInput[]): number | null {
  let good = 0;
  let bad = 0;
  let sample = 0;
  for (const r of rows) {
    if (r.passes == null && r.badPasses == null) continue;
    sample += 1;
    good += r.passes ?? 0;
    bad += r.badPasses ?? 0;
  }
  if (sample === 0) return null;
  const total = good + bad;
  return total > 0 ? pct(good, total) : null;
}

function winPct(rows: CareerMatchInput[]): number | null {
  const decided = rows.filter((r) => r.result != null && isCompleted(r.status));
  if (!decided.length) return null;
  const wins = decided.filter((r) => r.result === "W").length;
  return pct(wins, decided.length);
}

function formatDateShort(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function seasonKey(row: CareerMatchInput): {
  label: string;
  sort: number;
  club: string;
  competition: string;
  isInternational: boolean;
} {
  const isIntl = row.isInternational;
  // International: always calendar year (avoid Jul–Jun domestic start splitting one year into two rows).
  const calendarYear = row.kickoffAt ? row.kickoffAt.getUTCFullYear() : null;
  const start = isIntl ? calendarYear : row.seasonStart;
  const label =
    row.seasonLabel ??
    (start != null ? (isIntl ? String(start) : formatSeasonRangeLabel(start)) : "Unknown");
  const sort = start ?? calendarYear ?? 0;
  return {
    label,
    sort,
    club: displayClubName(row.teamName),
    competition: row.competitionName?.trim() || (isIntl ? "Test Matches" : "Competition"),
    isInternational: isIntl,
  };
}

function aggregateSeasonRows(
  matches: CareerMatchInput[],
  opts: { internationalOnly?: boolean; clubOnly?: boolean },
): CareerSeasonRow[] {
  const filtered = matches.filter((m) => {
    if (opts.internationalOnly && !m.isInternational) return false;
    if (opts.clubOnly && m.isInternational) return false;
    return true;
  });

  type Acc = {
    key: string;
    seasonLabel: string;
    seasonSort: number;
    clubName: string;
    competitionName: string;
    isInternational: boolean;
    rows: CareerMatchInput[];
  };
  const map = new Map<string, Acc>();

  for (const m of filtered) {
    const sk = seasonKey(m);
    const key = `${sk.sort}|${sk.label}|${sk.club}|${sk.competition}|${sk.isInternational ? "i" : "c"}`;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        key,
        seasonLabel: sk.label,
        seasonSort: sk.sort,
        clubName: sk.club,
        competitionName: sk.competition,
        isInternational: sk.isInternational,
        rows: [],
      };
      map.set(key, acc);
    }
    acc.rows.push(m);
  }

  const out: CareerSeasonRow[] = [];
  for (const acc of map.values()) {
    const minsKnown = acc.rows.filter((r) => r.minutes != null);
    const tbKnown = acc.rows.filter((r) => r.defendersBeaten != null);
    const cbKnown = acc.rows.filter((r) => r.cleanBreaks != null);
    const asKnown = acc.rows.filter((r) => r.assists != null);
    out.push({
      id: acc.key,
      seasonLabel: acc.seasonLabel,
      seasonSort: acc.seasonSort,
      clubName: acc.clubName,
      competitionName: acc.competitionName,
      matches: acc.rows.length,
      minutes: minsKnown.length ? sum(minsKnown.map((r) => r.minutes)) : null,
      points: sum(acc.rows.map((r) => r.points)),
      tries: sum(acc.rows.map((r) => r.tries)),
      conversions: sum(acc.rows.map((r) => r.conversions)),
      penalties: sum(acc.rows.map((r) => r.penalties)),
      dropGoals: sum(acc.rows.map((r) => r.dropGoals)),
      tackleBreaks: tbKnown.length ? sum(tbKnown.map((r) => r.defendersBeaten)) : null,
      cleanBreaks: cbKnown.length ? sum(cbKnown.map((r) => r.cleanBreaks)) : null,
      assists: asKnown.length ? sum(asKnown.map((r) => r.assists)) : null,
      passPct: passPct(acc.rows),
      kickAccuracyPct: kickAccuracyPct(acc.rows),
      winPct: winPct(acc.rows),
      isInternational: acc.isInternational,
    });
  }

  out.sort((a, b) => b.seasonSort - a.seasonSort || a.competitionName.localeCompare(b.competitionName));
  return out;
}

function buildTimeline(matches: CareerMatchInput[]): CareerTimelinePoint[] {
  const byYear = new Map<number, { matches: number; points: number }>();
  for (const m of matches) {
    if (!m.kickoffAt) continue;
    const y = m.kickoffAt.getUTCFullYear();
    const prev = byYear.get(y) ?? { matches: 0, points: 0 };
    prev.matches += 1;
    prev.points += m.points;
    byYear.set(y, prev);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => ({ year, matches: v.matches, points: v.points }));
}

function buildTotals(matches: CareerMatchInput[]): CareerTotalCell[] {
  const withPerf = matches.filter((m) => m.hasPerf);
  const tb = withPerf.filter((m) => m.defendersBeaten != null);
  const cb = withPerf.filter((m) => m.cleanBreaks != null);
  const as = withPerf.filter((m) => m.assists != null);
  return [
    { key: "played", label: "Played", value: matches.length, highlight: true },
    { key: "points", label: "Points", value: sum(matches.map((m) => m.points)), highlight: true },
    { key: "tries", label: "Tries", value: sum(matches.map((m) => m.tries)), highlight: true },
    { key: "conversions", label: "Conversions", value: sum(matches.map((m) => m.conversions)) },
    { key: "penalties", label: "Penalties", value: sum(matches.map((m) => m.penalties)) },
    { key: "dropGoals", label: "Drop Goals", value: sum(matches.map((m) => m.dropGoals)) },
    { key: "assists", label: "Assists", value: as.length ? sum(as.map((m) => m.assists)) : null },
    {
      key: "tackleBreaks",
      label: "Tackle Breaks",
      value: tb.length ? sum(tb.map((m) => m.defendersBeaten)) : null,
    },
    {
      key: "cleanBreaks",
      label: "Clean Breaks",
      value: cb.length ? sum(cb.map((m) => m.cleanBreaks)) : null,
    },
  ];
}

function buildMeta(
  matches: CareerMatchInput[],
  input: {
    verifiedCaps: number | null;
    internationalTeamName: string | null;
    stints?: CareerStintInput[];
  },
): CareerMetaLine {
  const years = matches
    .map((m) => (m.kickoffAt ? m.kickoffAt.getUTCFullYear() : null))
    .filter((y): y is number => y != null);
  const minY = years.length ? Math.min(...years) : null;
  const maxY = years.length ? Math.max(...years) : null;
  const seasonStarts = new Set(
    matches.map((m) => m.seasonStart).filter((y): y is number => y != null),
  );
  const stintClubNames = (input.stints ?? [])
    .filter((s) => s.careerType === "club" && s.teamName?.trim())
    .map((s) => displayClubName(s.teamName));
  const clubs = [
    ...new Set([
      ...matches.filter((m) => !m.isInternational).map((m) => displayClubName(m.teamName)),
      ...stintClubNames,
    ]),
  ].filter(Boolean);
  const intlApps = matches.filter((m) => m.isInternational).length;
  const caps = input.verifiedCaps ?? (intlApps > 0 ? intlApps : null);

  let careerSpanLabel: string | null = null;
  if (minY != null && maxY != null) {
    const present = maxY >= new Date().getUTCFullYear() - 1;
    careerSpanLabel = present ? `${minY}–Present` : `${minY}–${maxY}`;
  }

  return {
    careerSpanLabel,
    seasonCount: seasonStarts.size || null,
    clubCount: clubs.length || null,
    clubNames: clubs,
    internationalCaps: caps,
    internationalTeamName: input.internationalTeamName,
  };
}

function buildHighs(matches: CareerMatchInput[]): PublicPlayerCareerV2Dto["highs"] {
  const minsKnown = matches.filter((m) => m.minutes != null);
  const minutes = minsKnown.length ? sum(minsKnown.map((m) => m.minutes)) : null;
  const points = sum(matches.map((m) => m.points));
  const summary: CareerHighStat[] = [
    { key: "matches", label: "Matches", value: String(matches.length) },
    { key: "points", label: "Points", value: String(points) },
    {
      key: "avgPoints",
      label: "Avg Points/Match",
      value: avg(points, matches.length)?.toFixed(2) ?? "—",
    },
    {
      key: "winRate",
      label: "Win Rate",
      value: (() => {
        const w = winPct(matches);
        return w != null ? `${w}%` : "—";
      })(),
    },
    {
      key: "minutes",
      label: "Minutes",
      value: minutes != null ? minutes.toLocaleString("en-GB") : "—",
    },
    {
      key: "avgMins",
      label: "Avg Mins/Match",
      value: minutes != null && matches.length ? String(avg(minutes, matches.length)) : "—",
    },
  ];

  const matchHighs: CareerMatchHigh[] = [];
  const bestPoints = [...matches].sort((a, b) => b.points - a.points)[0];
  if (bestPoints && bestPoints.points > 0) {
    matchHighs.push({
      key: "points",
      label: "Most Points in a Match",
      value: bestPoints.points,
      detail: `vs ${bestPoints.opponentName ?? "Unknown"}${bestPoints.kickoffAt ? ` · ${formatDateShort(bestPoints.kickoffAt)}` : ""}`,
    });
  }
  const bestTackles = [...matches]
    .filter((m) => m.tacklesMade != null)
    .sort((a, b) => (b.tacklesMade ?? 0) - (a.tacklesMade ?? 0))[0];
  if (bestTackles && (bestTackles.tacklesMade ?? 0) > 0) {
    matchHighs.push({
      key: "tackles",
      label: "Most Tackles in a Match",
      value: bestTackles.tacklesMade!,
      detail: `vs ${bestTackles.opponentName ?? "Unknown"}`,
    });
  }
  const bestTries = [...matches].sort((a, b) => b.tries - a.tries)[0];
  if (bestTries && bestTries.tries > 0) {
    matchHighs.push({
      key: "tries",
      label: "Most Tries in a Match",
      value: bestTries.tries,
      detail: `vs ${bestTries.opponentName ?? "Unknown"}`,
    });
  }

  // Longest streak of consecutive matches with ≥1 point (chronological).
  const chrono = [...matches]
    .filter((m) => m.kickoffAt)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  let streak = 0;
  let bestStreak = 0;
  for (const m of chrono) {
    if (m.points > 0) {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }

  return {
    summary,
    matchHighs,
    longestPointsStreak: bestStreak > 0 ? bestStreak : null,
  };
}

function buildPointsByCompetition(matches: CareerMatchInput[]): CareerCompetitionPoints[] {
  const map = new Map<string, number>();
  for (const m of matches) {
    const label = competitionBucketLabel(m.competitionName, m.competitionType, m.isInternational);
    map.set(label, (map.get(label) ?? 0) + m.points);
  }
  const total = sum([...map.values()]);
  return [...map.entries()]
    .map(([label, points]) => ({
      key: label.toLowerCase().replace(/\s+/g, "-"),
      label,
      points,
      percent: total > 0 ? Math.round((points / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.points - a.points);
}

function buildPositions(matches: CareerMatchInput[]): {
  total: number;
  slices: CareerPositionSlice[];
} {
  const counts = new Map<string, number>();
  for (const m of matches) {
    const pos = normalizeFieldPosition(m.positionName, m.jerseyNumber);
    if (!pos) continue;
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }
  const total = sum([...counts.values()]);
  const slices = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([positionName, appearances], i) => ({
      positionName,
      appearances,
      percent: total > 0 ? Math.round((appearances / total) * 1000) / 10 : 0,
      color: POSITION_COLORS[i % POSITION_COLORS.length]!,
    }));
  return { total, slices };
}

export function buildCareerMilestones(
  matches: CareerMatchInput[],
  stints: CareerStintInput[],
): CareerMilestone[] {
  const chrono = [...matches]
    .filter((m) => m.kickoffAt)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  const out: CareerMilestone[] = [];

  const firstClub = chrono.find((m) => !m.isInternational);
  if (firstClub) {
    out.push({
      id: "pro-debut",
      year: firstClub.kickoffAt!.getUTCFullYear(),
      dateIso: firstClub.kickoffAt!.toISOString(),
      title: "Professional Debut",
      detail: `vs ${firstClub.opponentName ?? "Unknown"}${firstClub.competitionName ? ` (${firstClub.competitionName})` : ""}`,
    });
  }

  const firstIntl = chrono.find((m) => m.isInternational);
  if (firstIntl) {
    out.push({
      id: "intl-debut",
      year: firstIntl.kickoffAt!.getUTCFullYear(),
      dateIso: firstIntl.kickoffAt!.toISOString(),
      title: "International Debut",
      detail: `vs ${firstIntl.opponentName ?? "Unknown"}${firstIntl.competitionName ? ` (${firstIntl.competitionName})` : ""}`,
    });
  }

  const firstTry = chrono.find((m) => m.tries > 0);
  if (firstTry) {
    out.push({
      id: "first-try",
      year: firstTry.kickoffAt!.getUTCFullYear(),
      dateIso: firstTry.kickoffAt!.toISOString(),
      title: "First Try",
      detail: `vs ${firstTry.opponentName ?? "Unknown"}`,
    });
  }

  for (const n of [10, 25, 50, 75, 100]) {
    if (chrono.length >= n) {
      const m = chrono[n - 1]!;
      out.push({
        id: `apps-${n}`,
        year: m.kickoffAt!.getUTCFullYear(),
        dateIso: m.kickoffAt!.toISOString(),
        title: `${n}th Appearance`,
        detail: `vs ${m.opponentName ?? "Unknown"}`,
      });
    }
  }

  // Stint-based club joins (when no fixture yet for that era).
  const seenStintKeys = new Set<string>();
  for (const s of stints) {
    if (s.careerType !== "club" || !s.startYear) continue;
    const club = displayClubName(s.teamName);
    const stintKey = `${club.toLowerCase()}|${s.startYear}`;
    if (seenStintKeys.has(stintKey)) continue;
    seenStintKeys.add(stintKey);
    const already = out.some(
      (m) =>
        m.year === s.startYear &&
        (m.title.toLowerCase().includes(club.toLowerCase()) ||
          m.detail?.toLowerCase().includes(club.toLowerCase())),
    );
    if (already) continue;
    const hasMatchForClub = chrono.some(
      (m) =>
        !m.isInternational &&
        displayClubName(m.teamName).toLowerCase() === club.toLowerCase() &&
        m.kickoffAt!.getUTCFullYear() === s.startYear,
    );
    if (hasMatchForClub) continue;
    out.push({
      id: `stint-${stintKey}`,
      year: s.startYear,
      dateIso: null,
      title: `Joined ${club}`,
      detail: s.yearsLabel,
    });
  }

  out.sort((a, b) => {
    const ay = a.year ?? 0;
    const by = b.year ?? 0;
    if (ay !== by) return ay - by;
    const at = a.dateIso ? Date.parse(a.dateIso) : 0;
    const bt = b.dateIso ? Date.parse(b.dateIso) : 0;
    return at - bt;
  });
  return out;
}

function buildFooter(
  matches: CareerMatchInput[],
  meta: CareerMetaLine,
): CareerFooterFact[] {
  const chrono = [...matches]
    .filter((m) => m.kickoffAt)
    .sort((a, b) => a.kickoffAt!.getTime() - b.kickoffAt!.getTime());
  const firstClub = chrono.find((m) => !m.isInternational);
  const firstIntl = chrono.find((m) => m.isInternational);
  const comps = new Set(
    matches
      .map((m) => competitionBucketLabel(m.competitionName, m.competitionType, m.isInternational))
      .filter(Boolean),
  );
  const countries = new Set(
    matches
      .map((m) => m.opponentCountryName?.trim())
      .filter((c): c is string => Boolean(c)),
  );
  // Fall back to unique opponents when country unknown
  const opponents = new Set(
    matches.map((m) => m.opponentName?.trim()).filter((c): c is string => Boolean(c)),
  );
  const win = winPct(matches);

  return [
    {
      key: "proDebut",
      label: "Professional Debut",
      value: firstClub
        ? `${formatDateShort(firstClub.kickoffAt) ?? "—"} vs ${firstClub.opponentName ?? "—"}${firstClub.competitionName ? ` (${competitionBucketLabel(firstClub.competitionName, firstClub.competitionType, false)})` : ""}`
        : "—",
    },
    {
      key: "intlDebut",
      label: "International Debut",
      value: firstIntl
        ? `${formatDateShort(firstIntl.kickoffAt) ?? "—"} vs ${firstIntl.opponentName ?? "—"}`
        : "—",
    },
    {
      key: "clubs",
      label: "Total Clubs",
      value: meta.clubCount != null ? String(meta.clubCount) : "—",
    },
    {
      key: "competitions",
      label: "Total Competitions",
      value: comps.size ? String(comps.size) : "—",
    },
    {
      key: "countries",
      label: "Countries Played Against",
      value: countries.size
        ? String(countries.size)
        : opponents.size
          ? String(opponents.size)
          : "—",
    },
    {
      key: "winRate",
      label: "Career Win Rate",
      value: win != null ? `${win}%` : "—",
    },
  ];
}

export function buildPublicPlayerCareerV2(input: {
  playerId: string;
  matches: CareerMatchInput[];
  stints: CareerStintInput[];
  achievements: CareerAchievementInput[];
  verifiedCaps: number | null;
  internationalTeamName: string | null;
  dataAsOfIso: string | null;
}): PublicPlayerCareerV2Dto {
  const matches = input.matches.filter((m) => isCompleted(m.status) || m.hasPerf || m.points > 0 || (m.minutes ?? 0) > 0);
  // Prefer completed + appeared; if filter empties, keep all linked.
  const usable = matches.length ? matches : input.matches;

  const totals = buildTotals(usable);
  const meta = buildMeta(usable, {
    verifiedCaps: input.verifiedCaps,
    internationalTeamName: input.internationalTeamName,
    stints: input.stints,
  });
  const clubSeasonRows = aggregateSeasonRows(usable, { clubOnly: true });
  const internationalSeasonRows = aggregateSeasonRows(usable, { internationalOnly: true });
  const allSeasonRows = aggregateSeasonRows(usable, {});
  const awards: CareerAward[] = input.achievements.map((a) => ({
    id: a.id,
    year: a.year,
    title: a.title,
    detail: a.detail,
    verificationStatus: a.verificationStatus,
  }));

  return {
    playerId: input.playerId,
    totals,
    meta,
    timeline: buildTimeline(usable),
    highs: buildHighs(usable),
    clubSeasonRows,
    internationalSeasonRows,
    allSeasonRows,
    pointsByCompetition: buildPointsByCompetition(usable),
    milestones: buildCareerMilestones(usable, input.stints),
    awards,
    positions: buildPositions(usable),
    footer: buildFooter(usable, meta),
    dataAsOfIso: input.dataAsOfIso,
    coverage: {
      linkedFixtures: input.matches.length,
      withPerformance: input.matches.filter((m) => m.hasPerf).length,
      notes: [],
    },
  };
}
