import type { SdmsKeyEvent, SdmsMatchDetail, SdmsMatchStatsBundle } from "@rugby365/import-sdk";

export type HeaderCardChip = {
  type: "yellow" | "red";
  minute: number;
  playerName: string | null;
  side: "home" | "away";
};

export type HalfTimeScore = {
  home: number;
  away: number;
  minute: number;
};

function isHalfTimeEvent(type: string, period?: string | null): boolean {
  const t = `${type} ${period ?? ""}`.toLowerCase();
  return (
    t.includes("half time") ||
    t.includes("half-time") ||
    t.includes("half end") ||
    t.includes("end of first") ||
    (t.includes("period") && t.includes("1") && t.includes("end"))
  );
}

/** HT score from key events when SDMS does not expose a dedicated HT field. */
export function resolveHalfTimeScore(
  events: SdmsKeyEvent[],
  fallbackHome = 0,
  fallbackAway = 0,
): HalfTimeScore | null {
  const htEvent = [...events]
    .filter((e) => isHalfTimeEvent(e.type, e.period))
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0))
    .at(-1);

  if (
    htEvent &&
    typeof htEvent.home_score === "number" &&
    typeof htEvent.away_score === "number"
  ) {
    return {
      home: htEvent.home_score,
      away: htEvent.away_score,
      minute: htEvent.minute || 40,
    };
  }

  // Last scoring event at or before 40' with running score
  const beforeHt = [...events]
    .filter((e) => (e.minute ?? 0) <= 40)
    .filter((e) => typeof e.home_score === "number" && typeof e.away_score === "number")
    .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const last = beforeHt.at(-1);
  if (last && typeof last.home_score === "number" && typeof last.away_score === "number") {
    return { home: last.home_score, away: last.away_score, minute: 40 };
  }

  if (fallbackHome === 0 && fallbackAway === 0 && events.length === 0) return null;
  return null;
}

export function collectHeaderCards(
  detail: SdmsMatchDetail,
  homeTeamId?: string | null,
): HeaderCardChip[] {
  const chips: HeaderCardChip[] = [];
  const events = detail.key_events ?? [];

  for (const event of events) {
    const t = event.type.toLowerCase();
    const isRed = t.includes("red");
    const isYellow = t.includes("yellow") || t.includes("sin bin") || t.includes("sinbin");
    if (!isRed && !isYellow) continue;
    const side: "home" | "away" =
      homeTeamId && event.team_id ? (event.team_id === homeTeamId ? "home" : "away") : "home";
    chips.push({
      type: isRed ? "red" : "yellow",
      minute: event.minute || 0,
      playerName: event.player_name ?? null,
      side,
    });
  }

  if (chips.length > 0) return chips;

  // Fallback: scoring detail card lists (no minutes)
  const block = detail.detail as Record<string, unknown> | undefined;
  if (!block) return chips;
  for (const [key, side] of [
    ["home_cards", "home"],
    ["away_cards", "away"],
  ] as const) {
    const rows = block[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const cardType = String(r.card_type ?? r.type ?? "yellow").toLowerCase();
      chips.push({
        type: cardType.includes("red") ? "red" : "yellow",
        minute: Number(r.minute ?? 0) || 0,
        playerName: typeof r.player_name === "string" ? r.player_name : typeof r.name === "string" ? r.name : null,
        side,
      });
    }
  }
  return chips;
}

export type PossessionHalves = {
  homeOverall: number;
  awayOverall: number;
  homeFirst: number;
  awayFirst: number;
  homeSecond: number;
  awaySecond: number;
};

function pct(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  // SDMS often sends 0–1 fractions
  return value > 1 ? value / 100 : value;
}

/** Normalised 0–1 possession shares for momentum bars. */
export function possessionHalvesFromStats(
  matchStats: SdmsMatchStatsBundle | null | undefined,
): PossessionHalves {
  const possession = (matchStats?.possession ?? {}) as Record<string, number>;
  const homeOverall = pct(possession.home_overall_percentage ?? possession.home_percentage, 0.5);
  const awayOverall = pct(
    possession.away_overall_percentage ?? possession.away_percentage,
    1 - homeOverall,
  );
  const homeFirst = pct(
    possession.home_first_half_percentage ?? possession.home_1st_half_percentage,
    homeOverall,
  );
  const awayFirst = pct(
    possession.away_first_half_percentage ?? possession.away_1st_half_percentage,
    1 - homeFirst,
  );
  const homeSecond = pct(
    possession.home_second_half_percentage ?? possession.home_2nd_half_percentage,
    homeOverall,
  );
  const awaySecond = pct(
    possession.away_second_half_percentage ?? possession.away_2nd_half_percentage,
    1 - homeSecond,
  );
  return { homeOverall, awayOverall, homeFirst, awayFirst, homeSecond, awaySecond };
}
