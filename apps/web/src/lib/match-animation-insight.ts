/**
 * Rugby insight helpers for Match Animation — attack direction, intensity,
 * and HT/FT carousel cards driven by collected match data (hide empties).
 */

export type AttackDirection = "left" | "right";

/** Home attacks right in 1H, left in 2H (standard broadcast orientation). */
export function attackDirectionForSide(
  side: "home" | "away",
  period: string | null | undefined,
): AttackDirection {
  const p = (period ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const secondHalf =
    p.includes("second") ||
    p === "2h" ||
    p.includes("second_half") ||
    p.includes("extra") ||
    p.includes("et_");
  if (side === "home") return secondHalf ? "left" : "right";
  return secondHalf ? "right" : "left";
}

export type PitchIntensity = "possession" | "attack" | "dangerous";

/** Map field zone + possession into live intensity for pitch urgency styling. */
export function resolvePitchIntensity(input: {
  fieldZone: "own_22" | "midfield" | "opp_22" | "ingoal" | null;
  hasActiveSetPiece?: boolean;
}): PitchIntensity {
  if (input.fieldZone === "opp_22" || input.fieldZone === "ingoal") return "dangerous";
  if (input.fieldZone === "midfield") return "attack";
  return "possession";
}

export type AnimationTeamStatSide = {
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  carries: number;
  metres: number;
  tackles: number;
  turnoversWon: number;
  possessionPct: number | null;
  territoryPct: number | null;
  cleanBreaks: number | null;
  defendersBeaten: number | null;
  scrumsWon: number | null;
  scrumsLost: number | null;
  lineoutsWon: number | null;
  lineoutsLost: number | null;
  rucksWon: number | null;
  missedTackles: number | null;
};

export type AnimationTeamStatsBundle = {
  home: AnimationTeamStatSide | null;
  away: AnimationTeamStatSide | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function readNested(sections: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const direct = num(sections[key]);
    if (direct != null) return direct;
  }
  for (const value of Object.values(sections)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
    for (const key of keys) {
      const nested = num(obj[key]);
      if (nested != null) return nested;
      // cms_metrics / sdms bags
      const metrics = obj.cms_metrics ?? obj.metrics ?? obj.stats;
      if (metrics && typeof metrics === "object" && !Array.isArray(metrics)) {
        const fromMetrics = num((metrics as Record<string, unknown>)[key]);
        if (fromMetrics != null) return fromMetrics;
      }
    }
  }
  return null;
}

export function normalizeTeamStatSide(input: {
  tries?: number | null;
  conversions?: number | null;
  penalties?: number | null;
  dropGoals?: number | null;
  carries?: number | null;
  metres?: number | null;
  tackles?: number | null;
  turnoversWon?: number | null;
  sections?: unknown;
}): AnimationTeamStatSide {
  const sections =
    input.sections && typeof input.sections === "object" && !Array.isArray(input.sections)
      ? (input.sections as Record<string, unknown>)
      : {};

  return {
    tries: Number(input.tries ?? 0) || 0,
    conversions: Number(input.conversions ?? 0) || 0,
    penalties: Number(input.penalties ?? 0) || 0,
    dropGoals: Number(input.dropGoals ?? 0) || 0,
    carries: Number(input.carries ?? 0) || 0,
    metres: Number(input.metres ?? 0) || 0,
    tackles: Number(input.tackles ?? 0) || 0,
    turnoversWon: Number(input.turnoversWon ?? 0) || 0,
    possessionPct: readNested(sections, [
      "possession",
      "possession_pct",
      "possessionPercent",
      "ball_possession",
    ]),
    territoryPct: readNested(sections, ["territory", "territory_pct", "territoryPercent"]),
    cleanBreaks: readNested(sections, ["clean_breaks", "cleanBreaks", "line_breaks"]),
    defendersBeaten: readNested(sections, ["defenders_beaten", "defendersBeaten"]),
    scrumsWon: readNested(sections, ["scrums_won", "scrumsWon"]),
    scrumsLost: readNested(sections, ["scrums_lost", "scrumsLost"]),
    lineoutsWon: readNested(sections, ["lineouts_won", "lineoutsWon"]),
    lineoutsLost: readNested(sections, ["lineouts_lost", "lineoutsLost"]),
    rucksWon: readNested(sections, ["rucks_won", "rucksWon"]),
    missedTackles: readNested(sections, ["missed_tackles", "missedTackles"]),
  };
}

export type InsightStatRow = {
  label: string;
  home: string;
  away: string;
};

function fmtPct(n: number | null): string | null {
  if (n == null) return null;
  return `${Math.round(n)}%`;
}

function fmtPair(
  home: number | null | undefined,
  away: number | null | undefined,
  opts?: { hideZeros?: boolean },
): { home: string; away: string } | null {
  if (home == null && away == null) return null;
  const h = home ?? 0;
  const a = away ?? 0;
  if (opts?.hideZeros && h === 0 && a === 0) return null;
  return { home: String(h), away: String(a) };
}

/** Build match-control rows; omit measures with no data on either side. */
export function buildMatchControlRows(
  home: AnimationTeamStatSide | null,
  away: AnimationTeamStatSide | null,
): InsightStatRow[] {
  if (!home && !away) return [];
  const rows: InsightStatRow[] = [];
  const poss = fmtPair(
    home?.possessionPct != null ? Math.round(home.possessionPct) : null,
    away?.possessionPct != null ? Math.round(away.possessionPct) : null,
  );
  if (poss && (home?.possessionPct != null || away?.possessionPct != null)) {
    rows.push({
      label: "Possession",
      home: home?.possessionPct != null ? fmtPct(home.possessionPct)! : "—",
      away: away?.possessionPct != null ? fmtPct(away.possessionPct)! : "—",
    });
  }
  if (home?.territoryPct != null || away?.territoryPct != null) {
    rows.push({
      label: "Territory",
      home: home?.territoryPct != null ? fmtPct(home.territoryPct)! : "—",
      away: away?.territoryPct != null ? fmtPct(away.territoryPct)! : "—",
    });
  }
  const carries = fmtPair(home?.carries, away?.carries, { hideZeros: true });
  if (carries) rows.push({ label: "Carries", ...carries });
  const metres = fmtPair(home?.metres, away?.metres, { hideZeros: true });
  if (metres) rows.push({ label: "Metres carried", ...metres });
  if (home?.defendersBeaten != null || away?.defendersBeaten != null) {
    rows.push({
      label: "Defenders beaten",
      home: home?.defendersBeaten != null ? String(home.defendersBeaten) : "—",
      away: away?.defendersBeaten != null ? String(away.defendersBeaten) : "—",
    });
  }
  if (home?.cleanBreaks != null || away?.cleanBreaks != null) {
    rows.push({
      label: "Clean breaks",
      home: home?.cleanBreaks != null ? String(home.cleanBreaks) : "—",
      away: away?.cleanBreaks != null ? String(away.cleanBreaks) : "—",
    });
  }
  return rows;
}

export function buildSetPieceDefenceRows(
  home: AnimationTeamStatSide | null,
  away: AnimationTeamStatSide | null,
  cards?: { homeYellow: number; awayYellow: number; homeRed: number; awayRed: number },
): InsightStatRow[] {
  if (!home && !away && !cards) return [];
  const rows: InsightStatRow[] = [];

  if (home?.scrumsWon != null || away?.scrumsWon != null || home?.scrumsLost != null) {
    const hw = home?.scrumsWon ?? 0;
    const hl = home?.scrumsLost;
    const aw = away?.scrumsWon ?? 0;
    const al = away?.scrumsLost;
    rows.push({
      label: "Scrums",
      home: hl != null ? `${hw}/${hl}` : String(hw),
      away: al != null ? `${aw}/${al}` : String(aw),
    });
  }
  if (home?.lineoutsWon != null || away?.lineoutsWon != null) {
    const hw = home?.lineoutsWon ?? 0;
    const hl = home?.lineoutsLost;
    const aw = away?.lineoutsWon ?? 0;
    const al = away?.lineoutsLost;
    rows.push({
      label: "Lineouts",
      home: hl != null ? `${hw}/${hl}` : String(hw),
      away: al != null ? `${aw}/${al}` : String(aw),
    });
  }
  if (home?.rucksWon != null || away?.rucksWon != null) {
    rows.push({
      label: "Rucks won",
      home: home?.rucksWon != null ? String(home.rucksWon) : "—",
      away: away?.rucksWon != null ? String(away.rucksWon) : "—",
    });
  }
  const tackles = fmtPair(home?.tackles, away?.tackles, { hideZeros: true });
  if (tackles) rows.push({ label: "Tackles", ...tackles });
  if (home?.missedTackles != null || away?.missedTackles != null) {
    rows.push({
      label: "Missed tackles",
      home: home?.missedTackles != null ? String(home.missedTackles) : "—",
      away: away?.missedTackles != null ? String(away.missedTackles) : "—",
    });
  }
  const turnovers = fmtPair(home?.turnoversWon, away?.turnoversWon, { hideZeros: true });
  if (turnovers) rows.push({ label: "Turnovers won", ...turnovers });
  const pens = fmtPair(home?.penalties, away?.penalties, { hideZeros: true });
  if (pens) rows.push({ label: "Penalties", ...pens });

  if (cards && (cards.homeYellow || cards.awayYellow || cards.homeRed || cards.awayRed)) {
    if (cards.homeYellow || cards.awayYellow) {
      rows.push({
        label: "Yellow cards",
        home: String(cards.homeYellow),
        away: String(cards.awayYellow),
      });
    }
    if (cards.homeRed || cards.awayRed) {
      rows.push({
        label: "Red cards",
        home: String(cards.homeRed),
        away: String(cards.awayRed),
      });
    }
  }
  return rows;
}

export type InsightCarouselCardId =
  | "result"
  | "motm"
  | "control"
  | "set_piece"
  | "venue"
  | "scorers";

export type InsightCarouselCard = {
  id: InsightCarouselCardId;
  title: string;
  rows?: InsightStatRow[];
  body?: string | null;
  motm?: {
    name: string;
    imageUrl: string | null;
    teamName: string | null;
    rating: number | null;
    stats: InsightStatRow[];
  } | null;
  venue?: {
    name: string;
    city: string | null;
    country: string | null;
    capacity: number | null;
    homeCoach: string | null;
    awayCoach: string | null;
    attendance: number | null;
    weather?: {
      temperatureC: number | null;
      humidityPct: number | null;
      precipitationMm: number | null;
      windSpeedKmh: number | null;
      windDirectionDeg: number | null;
      windCompass: string | null;
      observedAt: string | null;
      source: "forecast" | "archive";
    } | null;
  } | null;
  scoreline?: { home: number; away: number; label: string } | null;
};
