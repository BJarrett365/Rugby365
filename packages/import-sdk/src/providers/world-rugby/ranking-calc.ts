/**
 * World Rugby points-exchange ranking calculator (deterministic).
 * Based on the published World Rugby / IRB exchange rules.
 */

export const WORLD_RUGBY_HOME_ADVANTAGE = 3;
export const WORLD_RUGBY_OUTSIDER_GAP = 10;

export type RankingMatchOutcome = "home_win" | "away_win" | "draw";

export type RankingPointsExchangeInput = {
  homeRating: number;
  awayRating: number;
  /** When true, no home advantage is applied. */
  neutralVenue?: boolean;
  homeScore: number;
  awayScore: number;
  /** Rugby World Cup finals matches use double weighting. */
  isWorldCup?: boolean;
};

export type RankingPointsExchangeResult = {
  homeDelta: number;
  awayDelta: number;
  homeModified: number;
  awayModified: number;
  ratingDiff: number;
  outcome: RankingMatchOutcome;
  margin: number;
  /** Favourite beat outsider by 10+ modified points — no exchange. */
  noExchange: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function cap(value: number, max: number): number {
  if (value > max) return max;
  if (value < -max) return -max;
  return value;
}

/**
 * Compute points exchanged between two sides for one full international.
 * Winner gains `exchange`; loser loses the same amount (zero-sum).
 */
export function calculateWorldRugbyPointsExchange(
  input: RankingPointsExchangeInput,
): RankingPointsExchangeResult {
  const homeAdv = input.neutralVenue ? 0 : WORLD_RUGBY_HOME_ADVANTAGE;
  const homeModified = input.homeRating + homeAdv;
  const awayModified = input.awayRating;
  const ratingDiff = homeModified - awayModified;

  const margin = Math.abs(input.homeScore - input.awayScore);
  let outcome: RankingMatchOutcome;
  if (input.homeScore > input.awayScore) outcome = "home_win";
  else if (input.awayScore > input.homeScore) outcome = "away_win";
  else outcome = "draw";

  const wc = Boolean(input.isWorldCup);
  const winMultNarrow = wc ? 0.2 : 0.1;
  const winMultWide = wc ? 0.3 : 0.15;
  const drawMult = wc ? 0.2 : 0.1;
  const winCapNarrow = wc ? 4 : 2;
  const winCapWide = wc ? 6 : 3;
  const drawCap = wc ? 2 : 1;

  // Favourite / underdog by modified rating
  const homeIsFavourite = homeModified >= awayModified;
  const gap = Math.abs(ratingDiff);
  const favouriteIsOutsiderWin =
    gap >= WORLD_RUGBY_OUTSIDER_GAP &&
    ((homeIsFavourite && outcome === "home_win") || (!homeIsFavourite && outcome === "away_win"));

  if (favouriteIsOutsiderWin) {
    return {
      homeDelta: 0,
      awayDelta: 0,
      homeModified,
      awayModified,
      ratingDiff,
      outcome,
      margin,
      noExchange: true,
    };
  }

  let homeDelta = 0;

  if (outcome === "draw") {
    // Transfer from favourite to underdog: D * mult (D = favourite - underdog)
    const transfer = cap(gap * drawMult, drawCap);
    homeDelta = homeIsFavourite ? -transfer : transfer;
  } else if (outcome === "home_win") {
    // Team Y = home, Team Z = away → (10 + B - A) * mult where A=homeMod, B=awayMod
    const raw = (10 + awayModified - homeModified) * (margin >= 16 ? winMultWide : winMultNarrow);
    const exchange = cap(raw, margin >= 16 ? winCapWide : winCapNarrow);
    homeDelta = Math.max(0, exchange);
  } else {
    // Away win: Team Y = away → (10 + A - B) * mult
    const raw = (10 + homeModified - awayModified) * (margin >= 16 ? winMultWide : winMultNarrow);
    const exchange = cap(raw, margin >= 16 ? winCapWide : winCapNarrow);
    homeDelta = -Math.max(0, exchange);
  }

  homeDelta = round2(homeDelta);
  const awayDelta = round2(-homeDelta);

  return {
    homeDelta,
    awayDelta,
    homeModified,
    awayModified,
    ratingDiff,
    outcome,
    margin,
    noExchange: false,
  };
}

export type TeamRating = {
  teamKey: string;
  teamName: string;
  points: number;
  previousPoints?: number;
  previousPosition?: number | null;
  position?: number;
};

/**
 * Apply a match exchange and re-rank by points (desc), then name.
 */
export function applyMatchToTeamRatings(
  ratings: TeamRating[],
  match: {
    homeKey: string;
    awayKey: string;
    homeScore: number;
    awayScore: number;
    neutralVenue?: boolean;
    isWorldCup?: boolean;
  },
): { ratings: TeamRating[]; exchange: RankingPointsExchangeResult } {
  const home = ratings.find((r) => r.teamKey === match.homeKey);
  const away = ratings.find((r) => r.teamKey === match.awayKey);
  if (!home || !away) {
    throw new Error("Both teams must exist in the rating table before applying a match");
  }

  const exchange = calculateWorldRugbyPointsExchange({
    homeRating: home.points,
    awayRating: away.points,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    neutralVenue: match.neutralVenue,
    isWorldCup: match.isWorldCup,
  });

  const next = ratings.map((r) => {
    if (r.teamKey === match.homeKey) {
      return {
        ...r,
        previousPoints: r.points,
        previousPosition: r.position ?? null,
        points: round2(r.points + exchange.homeDelta),
      };
    }
    if (r.teamKey === match.awayKey) {
      return {
        ...r,
        previousPoints: r.points,
        previousPosition: r.position ?? null,
        points: round2(r.points + exchange.awayDelta),
      };
    }
    return {
      ...r,
      previousPoints: r.points,
      previousPosition: r.position ?? null,
    };
  });

  next.sort((a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName));
  next.forEach((r, i) => {
    r.position = i + 1;
  });

  return { ratings: next, exchange };
}
