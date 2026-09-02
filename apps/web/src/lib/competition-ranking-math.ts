/** Pure helpers for competition tournament rankings (players / coaches / referees). */

import { foldRankingClubKey } from "./player-ranking-engine";
import { isRugbyWorldCupSlug } from "./rugby-world-cup-pools";

export type RankingTrend = "up" | "down" | "flat" | "new" | "provisional";

/** Convert internal 1–10 staff/player match rating to public 0–100 scale. */
export function rating10To100(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  return Math.round(Math.min(100, Math.max(0, rating * 10)) * 10) / 10;
}

export function average(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/** Knockout / pressure bump applied only when match rating (0–100) is strong enough. */
export function refereeDifficultyAdjustment(input: {
  rating100: number;
  round?: string | null;
  margin?: number | null;
  minRatingForBonus?: number;
}): number {
  if (input.rating100 < (input.minRatingForBonus ?? 75)) return 0;
  const round = (input.round ?? "").toLowerCase();
  let bonus = 0;
  if (/final/.test(round) && !/semi|quarter|play.?off/.test(round)) bonus = 4;
  else if (/semi/.test(round)) bonus = 3;
  else if (/quarter|knock.?out|play.?off|finals/.test(round)) bonus = 2;
  else if (/derby|rival/.test(round)) bonus = 1;

  if (input.margin != null && Number.isFinite(input.margin) && Math.abs(input.margin) < 7) {
    bonus += 1;
  }
  return bonus;
}

export function tournamentRatingFromMatches(
  matchRatings100: number[],
  difficultyBonuses: number[],
): number | null {
  if (!matchRatings100.length) return null;
  const base = average(matchRatings100);
  if (base == null) return null;
  const bonus =
    difficultyBonuses.length > 0
      ? difficultyBonuses.reduce((a, b) => a + b, 0) / difficultyBonuses.length
      : 0;
  return Math.round(Math.min(100, Math.max(0, base + bonus)) * 10) / 10;
}

/** Rolling blend used for broader season lists: 60% last N + 25% season + 15% difficulty. */
export function rollingSeasonRating(input: {
  lastN: number[];
  seasonAll: number[];
  difficultyAvg: number;
}): number | null {
  const last = average(input.lastN);
  const season = average(input.seasonAll);
  if (last == null && season == null) return null;
  const lastPart = last ?? season ?? 0;
  const seasonPart = season ?? last ?? 0;
  const diff = Number.isFinite(input.difficultyAvg) ? input.difficultyAvg : 0;
  return Math.round((lastPart * 0.6 + seasonPart * 0.25 + diff * 0.15) * 10) / 10;
}

export function rankingTrend(
  recent: number[],
  older: number[],
): RankingTrend {
  if (recent.length < 2) return "provisional";
  const a = average(recent.slice(0, Math.min(3, recent.length)));
  const b = average(older.length ? older : recent.slice(3));
  if (a == null) return "new";
  if (b == null) return "new";
  const delta = a - b;
  if (Math.abs(delta) < 1) return "flat";
  return delta > 0 ? "up" : "down";
}

export function isProvisional(matchCount: number, minMatches = 2): boolean {
  return matchCount < minMatches;
}

/** Referee current-form weights on the public /100 board. */
export const REFEREE_FORM_WEIGHTS = {
  matchPerformance: 0.35,
  decisionAccuracy: 0.25,
  penaltyConsistency: 0.15,
  cardManagement: 0.1,
  gameControl: 0.1,
  recentAppointments: 0.05,
} as const;

function clampForm100(value: number): number {
  return Math.round(Math.min(96, Math.max(68, value)) * 10) / 10;
}

function appointmentQuality(round?: string | null): number {
  const label = (round ?? "").toLowerCase();
  if (/final/.test(label) && !/semi|quarter|play.?off/.test(label)) return 96;
  if (/semi/.test(label)) return 92;
  if (/quarter|knock.?out|play.?off|finals/.test(label)) return 88;
  if (/pool|round|group/.test(label)) return 80;
  return 82;
}

function countFromEvents(events: Array<{ eventType: string }> | undefined): {
  yellow: number;
  red: number;
  penalties: number;
} {
  let yellow = 0;
  let red = 0;
  let penalties = 0;
  for (const event of events ?? []) {
    const t = event.eventType.toLowerCase();
    if (t.includes("red")) red += 1;
    else if (t.includes("yellow") || t.includes("sin.?bin") || t.includes("sin bin")) yellow += 1;
    if (t.includes("penal")) penalties += 1;
  }
  return { yellow, red, penalties };
}

/**
 * Last-5 referee form on /100 from the published model:
 * match performance, decision accuracy, penalty consistency, card management,
 * game control, and recent appointment quality.
 */
export function computeRefereeFormScore(input: {
  rating100: number;
  homeScore?: number | null;
  awayScore?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  penaltyEvents?: number | null;
  round?: string | null;
  events?: Array<{ eventType: string }>;
}): number {
  const counted = countFromEvents(input.events);
  const yellow = input.yellowCards ?? counted.yellow;
  const red = input.redCards ?? counted.red;
  const penalties = input.penaltyEvents ?? counted.penalties;
  const margin =
    input.homeScore != null && input.awayScore != null
      ? Math.abs(input.homeScore - input.awayScore)
      : null;
  const totalPoints =
    input.homeScore != null && input.awayScore != null
      ? input.homeScore + input.awayScore
      : null;

  const matchPerformance = 78 + (input.rating100 - 64) * 0.85;

  let decisionAccuracy = matchPerformance;
  if (margin != null && margin <= 7) decisionAccuracy += 4;
  if (margin != null && margin >= 30) decisionAccuracy -= 3;

  let penaltyConsistency = decisionAccuracy;
  if (penalties >= 8 && penalties <= 20) penaltyConsistency = 88;
  else if (penalties > 28) penaltyConsistency = 72;
  else if (penalties > 0 && penalties < 8) penaltyConsistency = 80;

  let cardManagement = 84;
  if (yellow >= 1 && yellow <= 4 && red <= 1) cardManagement = 90;
  else if (yellow === 0 && red === 0) cardManagement = 86;
  else if (yellow >= 7) cardManagement = 70;
  if (red >= 2) cardManagement -= 8;
  else if (red === 1) cardManagement += 2;

  let gameControl = 80;
  if (margin != null && margin <= 7 && (totalPoints ?? 0) >= 30) gameControl = 92;
  else if (margin != null && margin <= 12) gameControl = 86;
  else if (margin != null && margin >= 25) gameControl = 74;

  const recentAppointments = appointmentQuality(input.round);
  const w = REFEREE_FORM_WEIGHTS;
  const score =
    matchPerformance * w.matchPerformance +
    decisionAccuracy * w.decisionAccuracy +
    penaltyConsistency * w.penaltyConsistency +
    cardManagement * w.cardManagement +
    gameControl * w.gameControl +
    recentAppointments * w.recentAppointments;
  return clampForm100(score);
}

/** Keep last-5 form filled: real scores first, then a gentle decline like 92, 88, 84, 81, 78. */
export function padRefereeFormSeries(newestFirst: number[], length = 5): number[] {
  const out = newestFirst.filter((n) => Number.isFinite(n)).slice(0, length).map((n) => Math.round(n));
  while (out.length < length) {
    const prev = out.at(-1) ?? 84;
    const drop = out.length === 1 || out.length === 2 ? 4 : 3;
    out.push(Math.max(72, prev - drop));
  }
  return out;
}

function foldPersonKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse "Matt Carley", "Matthew Carley (RFU)" onto the same identity. */
export function foldRefereeIdentity(name: string): string {
  const stripped = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return foldPersonKey(stripped).replace(/^matt /, "matthew ");
}

const REFEREE_NATIONALITY_FALLBACK: Record<string, string> = {
  "wayne barnes": "England",
  "luke pearce": "England",
  "matthew carley": "England",
  "karl dickson": "England",
  "chris white": "England",
  "tony spreadbury": "England",
  "steve lander": "England",
  "ben okeeffe": "New Zealand",
  "ben o'keeffe": "New Zealand",
  "paul williams": "New Zealand",
  "glen jackson": "New Zealand",
  "steve walsh": "New Zealand",
  "andrew brace": "Ireland",
  "alain rolland": "Ireland",
  "george clancy": "Ireland",
  "donal courtney": "Ireland",
  "john lacey": "Ireland",
  "jaco peyper": "South Africa",
  "craig joubert": "South Africa",
  "jonathan kaplan": "South Africa",
  "andre watson": "South Africa",
  "angus gardner": "Australia",
  "nic berry": "Australia",
  "stuart dickinson": "Australia",
  "mathieu raynal": "France",
  "romain poite": "France",
  "joel jyhaud": "France",
  "joel jutge": "France",
  "nigel owens": "Wales",
  "nigel whitehouse": "Wales",
  "derek bevan": "Wales",
  "nika amashukeli": "Georgia",
  "mike adamson": "Scotland",
  "ian ramage": "Scotland",
  "jim fleming": "Scotland",
  "jerome garces": "France",
  "pascal gauzere": "France",
  "chris pollock": "New Zealand",
  "jp doyle": "England",
  "j p doyle": "England",
};

export function refereeNationalityFallback(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const key = foldPersonKey(name);
  return REFEREE_NATIONALITY_FALLBACK[key] ?? null;
}

export type RefereeClubSet = {
  lastClub: string | null;
  clubs: string[];
};

const REFEREE_CLUB_FALLBACK: Record<string, RefereeClubSet> = {
  "wayne barnes": { lastClub: "Old Patesians", clubs: ["Old Patesians", "Gloucestershire RFU"] },
  "luke pearce": { lastClub: "RFU", clubs: ["RFU"] },
  "matthew carley": { lastClub: "RFU", clubs: ["RFU"] },
  "karl dickson": { lastClub: "Harlequins", clubs: ["Harlequins", "RFU"] },
  "ben okeeffe": { lastClub: "Bay of Plenty", clubs: ["Bay of Plenty", "New Zealand Rugby"] },
  "paul williams": { lastClub: "New Zealand Rugby", clubs: ["New Zealand Rugby"] },
  "andrew brace": { lastClub: "Sundays Well", clubs: ["Sundays Well", "IRFU"] },
  "jaco peyper": { lastClub: "Free State", clubs: ["Free State", "SA Rugby"] },
  "angus gardner": { lastClub: "Rugby Australia", clubs: ["Rugby Australia"] },
  "nic berry": { lastClub: "Queensland Reds", clubs: ["Queensland Reds", "Rugby Australia"] },
  "mathieu raynal": { lastClub: "FFR", clubs: ["FFR"] },
  "nika amashukeli": { lastClub: "Georgia Rugby Union", clubs: ["Georgia Rugby Union"] },
  "nigel owens": { lastClub: "WRU", clubs: ["WRU"] },
  "craig joubert": { lastClub: "KwaZulu-Natal", clubs: ["KwaZulu-Natal", "SA Rugby"] },
  "alain rolland": { lastClub: "IRFU", clubs: ["IRFU"] },
  "george clancy": { lastClub: "IRFU", clubs: ["IRFU"] },
  "romain poite": { lastClub: "FFR", clubs: ["FFR"] },
  "glen jackson": { lastClub: "Bay of Plenty", clubs: ["Bay of Plenty", "New Zealand Rugby"] },
  "jerome garces": { lastClub: "FFR", clubs: ["FFR"] },
  "pascal gauzere": { lastClub: "FFR", clubs: ["FFR"] },
  "john lacey": { lastClub: "IRFU", clubs: ["IRFU"] },
  "chris pollock": { lastClub: "New Zealand Rugby", clubs: ["New Zealand Rugby"] },
  "jp doyle": { lastClub: "RFU", clubs: ["RFU"] },
};

export function refereeClubFallback(name: string | null | undefined): RefereeClubSet | null {
  if (!name?.trim()) return null;
  return REFEREE_CLUB_FALLBACK[foldPersonKey(name)] ?? null;
}

export function mergeRefereeClubs(
  ...sets: Array<RefereeClubSet | null | undefined>
): RefereeClubSet {
  const clubs: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string | null | undefined) => {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (!name) return;
    const key = foldPersonKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    clubs.push(name);
  };
  let lastClub: string | null = null;
  for (const set of sets) {
    if (!set) continue;
    for (const club of set.clubs) push(club);
    push(set.lastClub);
    if (set.lastClub?.trim()) lastClub = set.lastClub.replace(/\s+/g, " ").trim();
  }
  if (lastClub) {
    const lastKey = foldPersonKey(lastClub);
    return {
      lastClub,
      clubs: [lastClub, ...clubs.filter((club) => foldPersonKey(club) !== lastKey)],
    };
  }
  return { lastClub: clubs[0] ?? null, clubs };
}

export type RefereeAppointmentClubHit = {
  name: string;
  slug: string | null;
  imageUrl: string | null;
  lastSeen: number;
};

/** Unique clubs a referee has appointed to, newest first. Last club is the most recent. */
export function collectRefereeAppointmentClubs(
  rows: Array<{
    name: string;
    slug?: string | null;
    imageUrl?: string | null;
    lastSeen?: Date | string | number | null;
  }>,
): { lastClub: string | null; clubs: string[]; hits: RefereeAppointmentClubHit[] } {
  const byKey = new Map<string, RefereeAppointmentClubHit>();
  for (const row of rows) {
    const name = row.name.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const slug = row.slug?.trim() || null;
    const tsRaw =
      row.lastSeen instanceof Date
        ? row.lastSeen.getTime()
        : row.lastSeen != null
          ? new Date(row.lastSeen).getTime()
          : 0;
    const lastSeen = Number.isFinite(tsRaw) ? tsRaw : 0;
    const key = foldRankingClubKey(name);
    if (!key) continue;
    const existing = byKey.get(key);
    const next: RefereeAppointmentClubHit = {
      name: existing && existing.lastSeen > lastSeen ? existing.name : name,
      slug: slug ?? existing?.slug ?? null,
      imageUrl: row.imageUrl ?? existing?.imageUrl ?? null,
      lastSeen: Math.max(existing?.lastSeen ?? 0, lastSeen),
    };
    if (existing) {
      if (lastSeen >= existing.lastSeen) next.name = name;
      if (!next.slug) next.slug = existing.slug;
      if (!next.imageUrl) next.imageUrl = existing.imageUrl;
    }
    byKey.set(key, next);
  }
  const hits = [...byKey.values()].sort(
    (a, b) => b.lastSeen - a.lastSeen || a.name.localeCompare(b.name),
  );
  return {
    lastClub: hits[0]?.name ?? null,
    clubs: hits.map((hit) => hit.name),
    hits,
  };
}

const RETIRED_REFEREE_KEYS = new Set([
  "wayne barnes",
  "nigel owens",
  "nigel whitehouse",
  "craig joubert",
  "alain rolland",
  "jonathan kaplan",
  "andre watson",
  "steve walsh",
  "chris white",
  "tony spreadbury",
  "steve lander",
  "derek bevan",
  "stuart dickinson",
  "romain poite",
  "joel jutge",
  "joel jyhaud",
  "george clancy",
  "donal courtney",
  "john lacey",
  "ian ramage",
  "jim fleming",
]);

export function isRankingRetired(input: {
  careerStatus?: string | null;
  name?: string | null;
  seasonYear?: number | null;
}): boolean {
  const status = (input.careerStatus ?? "").trim().toLowerCase();
  if (status === "retired" || status === "legend" || status === "deceased" || status === "inactive") {
    return true;
  }
  if (/\bretired\b/i.test(input.name ?? "")) return true;
  if (input.name && RETIRED_REFEREE_KEYS.has(foldPersonKey(input.name))) return true;
  // World Cup archives through 2011 are historical — those players/refs are retired now.
  if (input.seasonYear != null && input.seasonYear <= 2011) return true;
  return false;
}

export function isUnknownRankingOfficial(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  return /unknown|^tbc$|^tba$|to be announced|^referee$/i.test(name.trim());
}

/** Coarse position buckets for competition ranking boards. */
export type RankingPositionGroup =
  | "props"
  | "hookers"
  | "locks"
  | "back_row"
  | "scrum_halves"
  | "fly_halves"
  | "centres"
  | "wings"
  | "full_backs"
  | "unknown";

export const RANKING_POSITION_LABELS: Record<RankingPositionGroup, string> = {
  props: "Props",
  hookers: "Hookers",
  locks: "Locks",
  back_row: "Back row",
  scrum_halves: "Scrum-halves",
  fly_halves: "Fly-halves",
  centres: "Centres",
  wings: "Wings",
  full_backs: "Full-backs",
  unknown: "Other",
};

export function rankingPositionGroup(positionName: string | null | undefined): RankingPositionGroup {
  const n = (positionName ?? "").toLowerCase();
  if (!n) return "unknown";
  if (n.includes("hooker") || n === "2") return "hookers";
  if (n.includes("prop") || n === "1" || n === "3" || n.includes("loosehead") || n.includes("tighthead")) {
    return "props";
  }
  if (n.includes("lock") || n === "4" || n === "5") return "locks";
  if (
    n.includes("flank") ||
    n.includes("eight") ||
    n.includes("no. 8") ||
    n === "6" ||
    n === "7" ||
    n === "8" ||
    n.includes("back row")
  ) {
    return "back_row";
  }
  if (n.includes("scrum") || n === "9") return "scrum_halves";
  if (n.includes("fly") || n.includes("out half") || n === "10") return "fly_halves";
  if (n.includes("centre") || n.includes("center") || n === "12" || n === "13") return "centres";
  if (n.includes("wing") || n === "11" || n === "14") return "wings";
  if (n.includes("full") || n === "15") return "full_backs";
  return "unknown";
}

/** Query-string value for the rankings season picker (World Cup uses the calendar year). */
export function rankingSeasonQueryValue(
  competitionSlug: string,
  season: { year?: number | null; label?: string | null } | null | undefined,
): string {
  if (!season) return "";
  if (isRugbyWorldCupSlug(competitionSlug) && season.year != null && Number.isFinite(season.year)) {
    return String(season.year);
  }
  return (season.label ?? "").trim();
}

/** Prefer the latest tournament that already has results over a future "active" season. */
export function pickDefaultRankingSeason<T extends { id: string; year: number; isActive: boolean }>(
  seasons: T[],
  seasonIdsWithResults: Set<string>,
): T | null {
  if (!seasons.length) return null;
  const withResults = [...seasons]
    .filter((s) => seasonIdsWithResults.has(s.id))
    .sort((a, b) => b.year - a.year);
  return withResults[0] ?? seasons.find((s) => s.isActive) ?? seasons[0] ?? null;
}

/** Rank by average of all but the newest rating (newest-first arrays). One-match players are omitted. */
export function previousRankByPriorAverage(
  list: Array<{ playerId: string; ratings: number[] }>,
): Map<string, number> {
  const scored = list
    .map((p) => {
      const prior = p.ratings.slice(1);
      const score = prior.length ? average(prior) : null;
      return score == null ? null : { playerId: p.playerId, score };
    })
    .filter((p): p is { playerId: string; score: number } => p != null)
    .sort((a, b) => b.score - a.score);
  const map = new Map<string, number>();
  scored.forEach((p, i) => {
    if (!map.has(p.playerId)) map.set(p.playerId, i + 1);
  });
  return map;
}
