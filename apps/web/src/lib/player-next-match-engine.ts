/**
 * Pure next-match resolution for Player Profile V2.
 * Priority: confirmed squad → verified club → active intl window → none.
 * Calculations stay here — React only renders the result.
 */

export type NextMatchFixtureStatusKind =
  | "upcoming"
  | "live"
  | "full_time"
  | "cancelled"
  | "other";

export type NextMatchCandidate = {
  fixtureId: string;
  slug: string;
  kickoffAt: string | null;
  status: string | null;
  competitionName: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeTeamCrestUrl: string | null;
  awayTeamCrestUrl: string | null;
  venueName: string | null;
  href: string | null;
};

export type NextMatchResolutionSource =
  | "confirmed_squad"
  | "current_club"
  | "international_window"
  | "none";

export type NextMatchResolution = {
  match: NextMatchCandidate | null;
  source: NextMatchResolutionSource;
  reason: string;
  isLive: boolean;
};

export function classifyFixtureStatus(status: string | null | undefined): NextMatchFixtureStatusKind {
  const s = (status ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return "upcoming";
  if (
    s === "cancelled" ||
    s === "canceled" ||
    s === "abandoned" ||
    s.includes("cancel")
  ) {
    return "cancelled";
  }
  if (
    s === "full_time" ||
    s === "ft" ||
    s === "completed" ||
    s === "complete" ||
    s === "finished" ||
    s === "result" ||
    s.includes("full_time")
  ) {
    return "full_time";
  }
  if (s === "live" || s === "in_progress" || s === "playing" || s.includes("live")) {
    return "live";
  }
  if (
    s === "scheduled" ||
    s === "fixture" ||
    s === "upcoming" ||
    s === "not_started" ||
    s === "ns" ||
    s === "postponed"
  ) {
    return "upcoming";
  }
  return "other";
}

/** Eligible for Next Match card: upcoming, live, or unknown-but-not-finished. */
export function isEligibleNextMatchStatus(status: string | null | undefined): boolean {
  const kind = classifyFixtureStatus(status);
  return kind === "upcoming" || kind === "live" || kind === "other";
}

function kickoffMs(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function normalizeOpponentName(name: string | null | undefined): string {
  return (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same calendar day + home/away names — used to collapse duplicate source rows. */
export function sameDayMatchKey(fixture: NextMatchCandidate): string | null {
  const day = fixture.kickoffAt?.slice(0, 10) ?? null;
  const home = normalizeOpponentName(fixture.homeTeamName);
  const away = normalizeOpponentName(fixture.awayTeamName);
  if (!day || !home || !away) return null;
  return `${day}|${home}|${away}`;
}

/**
 * Collapse duplicate fixtures for the same opponents on the same day
 * (e.g. springboks.rugby import + Planet Rugby SDMS twin with different team ids).
 * Prefer a row that already has a Match Centre href, then sooner kickoff.
 */
export function collapseSameDayOpponentDuplicates(
  fixtures: NextMatchCandidate[],
): NextMatchCandidate[] {
  const byKey = new Map<string, NextMatchCandidate>();
  const unmatched: NextMatchCandidate[] = [];

  const prefer = (a: NextMatchCandidate, b: NextMatchCandidate): NextMatchCandidate => {
    const aHref = Boolean(a.href);
    const bHref = Boolean(b.href);
    if (aHref !== bHref) return aHref ? a : b;
    return kickoffMs(a.kickoffAt) <= kickoffMs(b.kickoffAt) ? a : b;
  };

  for (const fixture of fixtures) {
    const key = sameDayMatchKey(fixture);
    if (!key) {
      unmatched.push(fixture);
      continue;
    }
    const existing = byKey.get(key);
    byKey.set(key, existing ? prefer(existing, fixture) : fixture);
  }

  return [...byKey.values(), ...unmatched];
}

/** Prefer live (only if recent), then soonest kickoff. */
export function pickSoonestEligible(
  fixtures: NextMatchCandidate[],
  nowMs: number,
): NextMatchCandidate | null {
  const liveGraceMs = 6 * 60 * 60 * 1000;
  const upcomingGraceMs = 3 * 60 * 60 * 1000;

  const collapsed = collapseSameDayOpponentDuplicates(fixtures);
  const eligible = collapsed.filter((f) => {
    if (!isEligibleNextMatchStatus(f.status)) return false;
    const t = kickoffMs(f.kickoffAt);
    if (!Number.isFinite(t)) return classifyFixtureStatus(f.status) !== "live";
    // Stale "live" rows (kickoff far in the past) must not block real upcoming fixtures.
    if (classifyFixtureStatus(f.status) === "live" && t < nowMs - liveGraceMs) return false;
    return true;
  });
  if (!eligible.length) return null;

  const live = eligible.filter((f) => classifyFixtureStatus(f.status) === "live");
  if (live.length) {
    return [...live].sort((a, b) => kickoffMs(a.kickoffAt) - kickoffMs(b.kickoffAt))[0] ?? null;
  }

  const futureOrRecent = eligible
    .filter((f) => {
      const t = kickoffMs(f.kickoffAt);
      return t >= nowMs - upcomingGraceMs;
    })
    .sort((a, b) => kickoffMs(a.kickoffAt) - kickoffMs(b.kickoffAt));

  return futureOrRecent[0] ?? null;
}

export type ResolvePlayerNextMatchInput = {
  nowIso?: string;
  /** Player named in an upcoming/live squad (any team). */
  confirmedSquadFixtures: NextMatchCandidate[];
  /** Next fixtures for verified current club only. */
  clubFixtures: NextMatchCandidate[];
  clubMembershipVerified: boolean;
  /** Upcoming fixtures for international team during an active window. */
  internationalFixtures: NextMatchCandidate[];
  internationalWindowActive: boolean;
};

/**
 * Resolve which fixture (if any) to show on the Next Match card.
 * Does not invent fixtures — empty when nothing qualifies.
 */
export function resolvePlayerNextMatch(input: ResolvePlayerNextMatchInput): NextMatchResolution {
  const nowMs = Date.parse(input.nowIso ?? new Date().toISOString());
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();

  const squadPick = pickSoonestEligible(input.confirmedSquadFixtures, now);
  if (squadPick) {
    return {
      match: squadPick,
      source: "confirmed_squad",
      reason: "Player is named in a confirmed upcoming or live match squad.",
      isLive: classifyFixtureStatus(squadPick.status) === "live",
    };
  }

  if (input.clubMembershipVerified) {
    const clubPick = pickSoonestEligible(input.clubFixtures, now);
    if (clubPick) {
      return {
        match: clubPick,
        source: "current_club",
        reason: "Verified current club membership — showing club's next eligible fixture.",
        isLive: classifyFixtureStatus(clubPick.status) === "live",
      };
    }
  } else if (input.clubFixtures.length > 0) {
    // Explicit: unverified club must not surface a possibly wrong fixture.
  }

  if (input.internationalWindowActive) {
    const intlPick = pickSoonestEligible(input.internationalFixtures, now);
    if (intlPick) {
      return {
        match: intlPick,
        source: "international_window",
        reason: "Active international window — showing international team's next eligible fixture.",
        isLive: classifyFixtureStatus(intlPick.status) === "live",
      };
    }
  }

  let reason = "No upcoming eligible fixture found.";
  if (!input.clubMembershipVerified && input.clubFixtures.length > 0) {
    reason =
      "Club membership is unverified — club fixtures withheld. No confirmed squad or international window fixture.";
  } else if (!input.clubMembershipVerified) {
    reason = "No confirmed squad fixture, no verified club fixture, and no active international window.";
  }

  return {
    match: null,
    source: "none",
    reason,
    isLive: false,
  };
}

/** True when an international fixture falls inside the active window horizon. */
export function isInternationalWindowActive(input: {
  nowIso?: string;
  internationalFixtures: Array<{ kickoffAt: string | null; status: string | null }>;
  /** Days ahead (and small lookback for live) considered an active window. */
  horizonDays?: number;
}): boolean {
  const horizonDays = input.horizonDays ?? 28;
  const nowMs = Date.parse(input.nowIso ?? new Date().toISOString());
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const horizonMs = horizonDays * 24 * 60 * 60 * 1000;

  return input.internationalFixtures.some((f) => {
    if (!isEligibleNextMatchStatus(f.status)) return false;
    if (classifyFixtureStatus(f.status) === "live") return true;
    const t = kickoffMs(f.kickoffAt);
    if (!Number.isFinite(t)) return false;
    return t >= now - 3 * 60 * 60 * 1000 && t <= now + horizonMs;
  });
}
