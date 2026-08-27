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

/** Persist / display at most five genuine results (oldest → newest). */
export const FORM_DISPLAY_SLOTS = 5;
const MAX_FORM_LENGTH = FORM_DISPLAY_SLOTS;

/**
 * Normalize a feed form sequence to W/D/L only.
 * Feeds often pad with "-" (`--W`, `L-LL`, `LLL--`); dashes are never results.
 */
export function normalizeFormSequence(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  // Must be only result letters + separators / padding — reject free text.
  if (!/^[WDL\s,_\-/|.]+$/.test(upper) || !/[WDL]/.test(upper)) return null;
  const letters = upper.replace(/[^WDL]/g, "");
  if (!letters) return null;
  return letters.slice(-MAX_FORM_LENGTH);
}

/** Left-pad with "-" so the UI always renders a fixed number of form slots. */
export function padFormForDisplay(form: string | null | undefined, slots = FORM_DISPLAY_SLOTS): string {
  const letters = normalizeFormSequence(form) ?? "";
  if (slots <= 0) return letters;
  if (letters.length >= slots) return letters.slice(-slots);
  return `${"-".repeat(slots - letters.length)}${letters}`;
}

function toCount(value: unknown): number | null {
  const parsed = typeof value !== "string" ? value : Number(value);
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
  limit = FORM_DISPLAY_SLOTS,
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

/**
 * True when a W/D/L sequence is almost certainly from 0–0 placeholder fixtures
 * (entire window is draws). Real rugby seasons almost never finish a last-N
 * window as all draws of length ≥ 4.
 */
export function isPlaceholderAllDrawForm(form: string | null | undefined): boolean {
  const letters = normalizeFormSequence(form);
  return Boolean(letters && letters.length >= 4 && /^D+$/.test(letters));
}

/** True when stored form is missing, dash-padded, or contains non-result placeholders. */
export function standingFormNeedsRecompute(form: string | null | undefined): boolean {
  const trimmed = form?.trim();
  if (!trimmed) return true;
  if (/^-+$/.test(trimmed)) return true;
  if (/-/.test(trimmed) && !trimmed.startsWith("{")) return true;
  const parsed = parseStandingForm(trimmed).lastFive;
  if (!parsed) return true;
  // Long all-draw sequences are almost always 0–0 placeholder imports, not real form.
  if (isPlaceholderAllDrawForm(parsed)) return true;
  return false;
}
