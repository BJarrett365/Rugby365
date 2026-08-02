/**
 * `standing_rows.form` historically stored either a plain W/D/L sequence or a
 * JSON blob (`{"tbp":0,"lbp":0,"lf":"WWWWL"}`) from the SDMS sync. Readers must
 * handle both until every legacy row is migrated.
 */
export type StandingFormMeta = {
  lastFive: string | null;
  tryBonusPoints: number | null;
  losingBonusPoints: number | null;
};

const EMPTY: StandingFormMeta = {
  lastFive: null,
  tryBonusPoints: null,
  losingBonusPoints: null,
};

const MAX_FORM_LENGTH = 10;

/**
 * Normalize a feed form sequence.
 * Feeds often pad with "-" for unplayed slots (`--W`, `LLL--`); we keep interior
 * placeholders but strip leading/trailing padding so the UI shows real results.
 */
export function normalizeFormSequence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.toUpperCase().replace(/[\s,_/|]/g, "");
  if (!stripped || !/^[WDL-]+$/.test(stripped) || !/[WDL]/.test(stripped)) return null;
  const trimmed = stripped.replace(/^-+/, "").replace(/-+$/, "");
  if (!trimmed || !/[WDL]/.test(trimmed)) return null;
  return trimmed.slice(-MAX_FORM_LENGTH);
}

function toCount(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

export function parseStandingForm(form: string | null | undefined): StandingFormMeta {
  const trimmed = form?.trim();
  if (!trimmed) return EMPTY;

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { tbp?: unknown; lbp?: unknown; lf?: unknown };
      return {
        lastFive: normalizeFormSequence(parsed.lf),
        tryBonusPoints: toCount(parsed.tbp),
        losingBonusPoints: toCount(parsed.lbp),
      };
    } catch {
      return EMPTY;
    }
  }

  return { ...EMPTY, lastFive: normalizeFormSequence(trimmed) };
}

export type FixtureResultInput = {
  teamId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: Date | string | null;
};

/** Build oldest→newest W/D/L form (most recent on the right), last N results. */
export function computeFormSequenceFromFixtures(
  teamId: string,
  fixtures: FixtureResultInput[],
  limit = 5,
): string | null {
  const results: string[] = [];
  const ordered = [...fixtures].sort((a, b) => {
    const aMs = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const bMs = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    return aMs - bMs;
  });

  for (const fixture of ordered) {
    if (fixture.homeScore == null || fixture.awayScore == null) continue;
    // Placeholder / unplayed rows are often stored as 0-0 full_time in imports.
    if (fixture.homeScore === 0 && fixture.awayScore === 0) continue;
    const isHome = fixture.homeTeamId === teamId;
    const isAway = fixture.awayTeamId === teamId;
    if (!isHome && !isAway) continue;
    const forScore = isHome ? fixture.homeScore : fixture.awayScore;
    const againstScore = isHome ? fixture.awayScore : fixture.homeScore;
    if (forScore > againstScore) results.push("W");
    else if (forScore < againstScore) results.push("L");
    else results.push("D");
  }

  if (!results.length) return null;
  return results.slice(-limit).join("");
}

/** True when stored form is missing or only dash padding (should recompute). */
export function standingFormNeedsRecompute(form: string | null | undefined): boolean {
  const trimmed = form?.trim();
  if (!trimmed) return true;
  if (/^-+$/.test(trimmed)) return true;
  const parsed = parseStandingForm(trimmed).lastFive;
  if (!parsed) return true;
  // Mostly padding with a single letter (`--W`) is almost always a bad feed value.
  const letters = parsed.replace(/-/g, "");
  return letters.length > 0 && letters.length < 2 && /^-/.test(trimmed);
}
