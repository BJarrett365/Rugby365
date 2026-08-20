/**
 * Collapse dual-import match events before narrative scoreboards accumulate.
 * rugby_data + SDMS often emit the same try/conversion twice with reversed
 * names ("Ito Ryunosuke" / "Ryunosuke Ito") and different seconds.
 */

import type { NarrativeEventInput } from "./match-narrative-commentary";
import { canonicalPlayerDisplayName } from "./entity-normalize";

export function normalizeNarrativeScoringType(eventType: string): string | null {
  const t = eventType.toLowerCase().replace(/[\s-]+/g, "_");
  if (t.includes("penalty_try")) return "penalty_try";
  if (t.includes("missed_conversion") || (t.includes("conversion") && t.includes("miss"))) {
    return "missed_conversion";
  }
  if (t.includes("conversion")) return "conversion";
  if (t === "try" || (t.includes("try") && !t.includes("conversion"))) return "try";
  if (t.includes("penalty_goal")) return "penalty_goal";
  if (t.includes("drop_goal")) return "drop_goal";
  return null;
}

export function normalizeNarrativeCardType(eventType: string): "yellow" | "red" | null {
  const t = eventType.toLowerCase().replace(/[\s-]+/g, "_");
  if (t.includes("red")) return "red";
  if (t.includes("yellow")) return "yellow";
  return null;
}

function playerNameTokens(name: string | null | undefined): Set<string> {
  return new Set(
    (name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

/** Sorted tokens so "Harry Potter" and "Potter Harry" share a key. */
export function narrativePlayerNameKey(name: string | null | undefined): string {
  return [...playerNameTokens(name)].sort().join(" ");
}

function playerNamesOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  const ta = playerNameTokens(a);
  const tb = playerNameTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) if (tb.has(t)) return true;
  return false;
}

function hasScorePair(e: NarrativeEventInput): boolean {
  return typeof e.homeScore === "number" && typeof e.awayScore === "number";
}

function richness(e: NarrativeEventInput): number {
  let score = 0;
  if (e.playerName?.trim()) score += 4;
  if (hasScorePair(e)) score += 3;
  if (e.playerOn?.trim() || e.playerOff?.trim()) score += 2;
  // Prefer First Last display form over Last First when both present.
  const raw = e.playerName?.trim() ?? "";
  if (raw && canonicalPlayerDisplayName(raw) === raw) score += 1;
  return score;
}

function preferLowerScore(a: NarrativeEventInput, b: NarrativeEventInput): NarrativeEventInput {
  if (!hasScorePair(a) || !hasScorePair(b)) {
    return richness(b) > richness(a) ? b : a;
  }
  const totalA = (a.homeScore ?? 0) + (a.awayScore ?? 0);
  const totalB = (b.homeScore ?? 0) + (b.awayScore ?? 0);
  // Dual imports sometimes stamp a double-counted scoreline on the twin — keep the lower.
  if (totalA !== totalB) return totalA < totalB ? a : b;
  return richness(b) > richness(a) ? b : a;
}

function preferPlayerDisplayName(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  const left = a?.trim() || "";
  const right = b?.trim() || "";
  if (!left) return right ? canonicalPlayerDisplayName(right) : null;
  if (!right) return canonicalPlayerDisplayName(left);

  const canonLeft = canonicalPlayerDisplayName(left);
  const canonRight = canonicalPlayerDisplayName(right);
  // Prefer a form that the canonicaliser rewrote into First Last.
  if (canonLeft !== left && canonRight === right) return canonLeft;
  if (canonRight !== right && canonLeft === left) return canonRight;
  if (canonLeft !== left) return canonLeft;
  if (canonRight !== right) return canonRight;

  // Prefer the later twin when both look equally raw (SDMS usually ships First Last).
  return canonRight;
}

function mergeNarrativePair(a: NarrativeEventInput, b: NarrativeEventInput): NarrativeEventInput {
  const primary = preferLowerScore(a, b);
  const secondary = primary === a ? b : a;
  return {
    ...secondary,
    ...primary,
    playerName: preferPlayerDisplayName(a.playerName, b.playerName),
    playerOn: primary.playerOn?.trim() || secondary.playerOn || null,
    playerOff: primary.playerOff?.trim() || secondary.playerOff || null,
    teamName: primary.teamName?.trim() || secondary.teamName || null,
    label: primary.label?.trim() || secondary.label || null,
    homeScore: primary.homeScore ?? secondary.homeScore,
    awayScore: primary.awayScore ?? secondary.awayScore,
    // Keep the earlier clock stamp for stable ordering.
    second: Math.min(primary.second ?? 0, secondary.second ?? 0),
  };
}

function sameTeam(a?: string | null, b?: string | null): boolean {
  const left = (a ?? "").trim().toLowerCase();
  const right = (b ?? "").trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}

function isNarrativeDuplicate(
  kept: NarrativeEventInput,
  candidate: NarrativeEventInput,
  scoringType: string | null,
  cardType: string | null,
): boolean {
  if (kept.minute !== candidate.minute) return false;

  if (scoringType) {
    const keptType = normalizeNarrativeScoringType(kept.eventType);
    if (keptType !== scoringType) return false;
    const namesOverlap = playerNamesOverlap(kept.playerName, candidate.playerName);
    const sameSide = sameTeam(kept.teamName, candidate.teamName);
    // Distinct scorers in the same minute must both survive.
    if (
      kept.playerName?.trim() &&
      candidate.playerName?.trim() &&
      !namesOverlap &&
      narrativePlayerNameKey(kept.playerName) !== narrativePlayerNameKey(candidate.playerName)
    ) {
      return false;
    }
    if (sameSide || namesOverlap || !kept.playerName?.trim() || !candidate.playerName?.trim()) {
      return true;
    }
    return false;
  }

  if (cardType) {
    const keptCard = normalizeNarrativeCardType(kept.eventType);
    if (keptCard !== cardType) return false;
    return (
      playerNamesOverlap(kept.playerName, candidate.playerName) ||
      narrativePlayerNameKey(kept.playerName) === narrativePlayerNameKey(candidate.playerName)
    );
  }

  return false;
}

/**
 * Collapse duplicate CMS rows from dual providers before narrative scoring.
 */
export function dedupeNarrativeEvents(events: NarrativeEventInput[]): NarrativeEventInput[] {
  const exactSeen = new Set<string>();
  const exactFiltered: NarrativeEventInput[] = [];
  for (const event of events) {
    const key = [
      event.minute,
      event.second ?? 0,
      event.eventType,
      event.playerName ?? "",
      event.playerOn ?? "",
      event.playerOff ?? "",
      event.teamName ?? "",
      event.homeScore ?? "",
      event.awayScore ?? "",
    ].join("|");
    if (exactSeen.has(key)) continue;
    exactSeen.add(key);
    exactFiltered.push(event);
  }

  const out: NarrativeEventInput[] = [];
  for (const event of exactFiltered) {
    const scoringType = normalizeNarrativeScoringType(event.eventType);
    const cardType = scoringType ? null : normalizeNarrativeCardType(event.eventType);

    if (!scoringType && !cardType) {
      out.push(event);
      continue;
    }

    const dupIndex = out.findIndex((kept) =>
      isNarrativeDuplicate(kept, event, scoringType, cardType),
    );
    if (dupIndex >= 0) {
      out[dupIndex] = mergeNarrativePair(out[dupIndex]!, event);
      continue;
    }
    out.push(event);
  }

  return out.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return (a.second ?? 0) - (b.second ?? 0);
  });
}
