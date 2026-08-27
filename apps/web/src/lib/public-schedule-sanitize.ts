import type { ScheduleFixture } from "./match-schedule-utils";
import {
  isUnknownStandingsTeamName,
  resolvePublicClubNamesFromFixtureSlug,
  scoreFixtureForStandingsDedupe,
} from "./table-lab/standings-fixture-dedupe";

function publicSideName(name: string): string {
  if (isUnknownStandingsTeamName(name)) return "TBC";
  return name;
}

const PAST_RESULT_MS = 90 * 60 * 1000;
const STALE_LIVE_RESULT_MS = 110 * 60 * 1000;

/** Promote stale scored rows so the board shows a result instead of "vs". */
export function publicFixtureStatus(
  status: string,
  kickoffAt: string | null,
  homeScore: number,
  awayScore: number,
  nowMs: number = Date.now(),
): string {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, "_");
  if (normalized === "full_time" || normalized === "result" || normalized === "finished" || normalized === "ft") {
    return "full_time";
  }
  const kickoffMs = kickoffAt ? new Date(kickoffAt).getTime() : NaN;
  const elapsed = Number.isFinite(kickoffMs) ? nowMs - kickoffMs : null;
  const scored = (homeScore ?? 0) + (awayScore ?? 0) > 0;
  if (normalized === "live" || normalized === "half_time") {
    if (elapsed != null && scored && elapsed > STALE_LIVE_RESULT_MS) return "full_time";
    return status;
  }
  if (normalized === "postponed") return status;
  if (elapsed != null) {
    if (scored && elapsed > PAST_RESULT_MS) return "full_time";
    if (elapsed > 2 * 60 * 1000 && elapsed <= PAST_RESULT_MS) return "live";
  }
  return status;
}

function publicMatchIdentity(fixture: ScheduleFixture): string | null {
  const home = (fixture.homeTeam?.name ?? "").trim().toLowerCase();
  const away = (fixture.awayTeam?.name ?? "").trim().toLowerCase();
  const date = fixture.matchDate ?? fixture.kickoffAt?.slice(0, 10) ?? "";
  if (!home || !away || !date) return null;
  if (home === "tbc" || away === "tbc") return null;
  return `${date}:${home}:${away}`;
}

function withResolvedClubNames(fixture: ScheduleFixture): ScheduleFixture {
  const resolved = resolvePublicClubNamesFromFixtureSlug(
    fixture.slug,
    fixture.homeTeam?.name ?? "",
    fixture.awayTeam?.name ?? "",
  );
  const homeName = publicSideName(resolved.homeName);
  const awayName = publicSideName(resolved.awayName);
  return {
    ...fixture,
    status: publicFixtureStatus(
      fixture.status,
      fixture.kickoffAt,
      fixture.homeScore,
      fixture.awayScore,
    ),
    homeTeam: fixture.homeTeam
      ? { ...fixture.homeTeam, name: homeName }
      : { name: homeName },
    awayTeam: fixture.awayTeam
      ? { ...fixture.awayTeam, name: awayName }
      : { name: awayName },
  };
}

/**
 * Public /matches board: recover club names from slugs, keep remaining
 * unknown sides as TBC, and collapse duplicate legacy clones to one row.
 */
export function sanitizePublicScheduleFixtures(fixtures: ScheduleFixture[]): ScheduleFixture[] {
  const named = fixtures.map((fixture) => withResolvedClubNames(fixture));

  const buckets = new Map<string, ScheduleFixture[]>();
  const passthrough: ScheduleFixture[] = [];
  for (const fixture of named) {
    const key = publicMatchIdentity(fixture);
    if (!key) {
      passthrough.push(fixture);
      continue;
    }
    const list = buckets.get(key) ?? [];
    list.push(fixture);
    buckets.set(key, list);
  }

  const picked: ScheduleFixture[] = [];
  for (const list of buckets.values()) {
    const winner = list.slice().sort((a, b) => {
      const diff =
        scoreFixtureForStandingsDedupe({
          id: b.id,
          slug: b.slug,
          status: b.status,
          homeScore: b.homeScore,
          awayScore: b.awayScore,
          homeName: b.homeTeam?.name ?? "",
          awayName: b.awayTeam?.name ?? "",
          kickoffAt: b.kickoffAt,
        }) -
        scoreFixtureForStandingsDedupe({
          id: a.id,
          slug: a.slug,
          status: a.status,
          homeScore: a.homeScore,
          awayScore: a.awayScore,
          homeName: a.homeTeam?.name ?? "",
          awayName: a.awayTeam?.name ?? "",
          kickoffAt: a.kickoffAt,
        });
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    })[0];
    if (winner) picked.push(winner);
  }

  return [...picked, ...passthrough].sort((a, b) => {
    const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    return ta - tb;
  });
}
