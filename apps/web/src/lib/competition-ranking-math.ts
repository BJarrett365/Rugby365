/** Pure helpers for competition tournament rankings (players / coaches / referees). */

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
