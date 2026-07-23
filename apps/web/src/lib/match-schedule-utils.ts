import { canonicalCompetitionDisplayName } from "./competition-list-utils";

export type ScheduleTeam = {
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
};

export type ScheduleFixture = {
  id: string;
  slug: string;
  competitionId: string | null;
  sdmsCompetitionId?: string | null;
  competitionName: string | null;
  /** Display calendar date (YYYY-MM-DD) in the viewer's timezone. */
  matchDate: string | null;
  seasonLabel: string | null;
  kickoffAt: string | null;
  status: string;
  round: string | null;
  /** Stadium / ground name when available from SDMS or CMS. */
  venue: string | null;
  homeScore: number;
  awayScore: number;
  homeTeam: ScheduleTeam | null;
  awayTeam: ScheduleTeam | null;
  externalMatchId?: string | null;
  planetRugbyUrl?: string | null;
  source?: "db" | "sdms";
};

export type ScheduleCompetition = {
  id: string;
  name: string;
  slug: string;
};

export function competitionDisplayName(
  fixture: Pick<ScheduleFixture, "competitionId" | "competitionName">,
  competitionById: Record<string, ScheduleCompetition>,
): string {
  if (fixture.competitionId && competitionById[fixture.competitionId]?.name) {
    return canonicalCompetitionDisplayName(competitionById[fixture.competitionId]!.name);
  }
  return canonicalCompetitionDisplayName(fixture.competitionName ?? "Other matches");
}

function normalizeCompetitionName(name: string): string {
  return canonicalCompetitionDisplayName(name).trim().toLowerCase();
}

export function competitionGroupKey(
  fixture: Pick<ScheduleFixture, "competitionId" | "competitionName" | "sdmsCompetitionId">,
  competitionById: Record<string, ScheduleCompetition>,
): string {
  const name = competitionDisplayName(fixture, competitionById);
  if (name !== "Other matches") return `name:${normalizeCompetitionName(name)}`;
  if (fixture.competitionId) return fixture.competitionId;
  if (fixture.sdmsCompetitionId) return `sdms:${fixture.sdmsCompetitionId}`;
  return "name:other matches";
}

export function pickCanonicalCompetitionSlug(
  displayName: string,
  competitionById: Record<string, ScheduleCompetition>,
): string | undefined {
  const normalized = normalizeCompetitionName(displayName);
  const candidates = Object.values(competitionById).filter(
    (row) => normalizeCompetitionName(row.name) === normalized,
  );
  if (!candidates.length) return undefined;
  return candidates
    .slice()
    .sort((a, b) => {
      const score = (slug: string) =>
        (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) &&
        !/-[a-f0-9]{6,}$/i.test(slug) &&
        !/-\d+$/.test(slug)
          ? 1
          : 0);
      const diff = score(b.slug) - score(a.slug);
      return diff !== 0 ? diff : a.slug.localeCompare(b.slug);
    })[0]?.slug;
}

export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function kickoffDateKey(iso: string | null, timeZone?: string): string | null {
  if (!iso) return null;
  if (timeZone) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  }
  return dateKeyLocal(new Date(iso));
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** First and last calendar day (YYYY-MM-DD) for the month containing dateKey. */
export function monthBoundsFromDateKey(dateKey: string): { start: string; end: string } {
  const [y, m] = dateKey.split("-").map(Number);
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Month bounds from JS Date month index (0 = January). */
export function monthBoundsFromYearMonth(year: number, monthIndex: number): { start: string; end: string } {
  const m = monthIndex + 1;
  const mm = String(m).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Calendar day for a fixture — prefers SDMS matchDate over derived kickoff. */
export function fixtureCalendarDate(f: Pick<ScheduleFixture, "matchDate" | "kickoffAt">): string | null {
  if (f.matchDate) return f.matchDate;
  return kickoffDateKey(f.kickoffAt);
}

export function seasonFromDateKey(dateKey: string | null): string | null {
  if (!dateKey || dateKey.length < 4) return null;
  return dateKey.slice(0, 4);
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function pickInitialDateKey(_fixtures: ScheduleFixture[], today = new Date()): string {
  return dateKeyLocal(today);
}

export function formatDateHeader(key: string): string {
  const d = parseDateKey(key);
  return d
    .toLocaleDateString("en-GB", { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase();
}

/** Planet Rugby public list date, e.g. "Saturday 11th July 2026". */
export function formatPublicDateHeader(key: string): string {
  const d = parseDateKey(key);
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const rest = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return `${weekday} ${day}${suffix} ${rest}`;
}

export function teamInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

/** Center-left status for public fixtures rows. */
export function publicMatchStatusLabel(
  status: string,
  kickoffAt: string | null,
  matchDate?: string | null,
): string {
  if (status === "full_time") return "Result";
  if (status === "live") return "Live";
  if (status === "postponed") return "PP";
  return formatKickoffTime(kickoffAt, matchDate);
}

export function formatStripDay(key: string, todayKey: string): { top: string; bottom: string } {
  const d = parseDateKey(key);
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  const dayNum = d.getDate();
  if (key === todayKey) {
    return { top: "Today", bottom: `${month} ${dayNum}` };
  }
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  return { top: weekday, bottom: `${month} ${dayNum}` };
}

export function formatKickoffTime(iso: string | null, matchDate?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (matchDate && kickoffDateKey(iso) !== matchDate) {
    return `${matchDate.slice(8, 10)}/${matchDate.slice(5, 7)} ${time}`;
  }
  return time;
}

export function matchStatusShort(
  status: string,
  kickoffAt: string | null,
  matchDate?: string | null,
): string {
  if (status === "full_time") return "FT";
  if (status === "live") return "Live";
  if (status === "postponed") return "PP";
  return formatKickoffTime(kickoffAt, matchDate);
}

export function isFinished(status: string): boolean {
  return status === "full_time" || status === "live";
}

export function groupByCompetition(
  fixtures: ScheduleFixture[],
  competitionById: Record<string, ScheduleCompetition>,
) {
  const groups = new Map<
    string,
    { key: string; label: string; slug?: string; fixtures: ScheduleFixture[] }
  >();

  for (const f of fixtures) {
    const displayName = competitionDisplayName(f, competitionById);
    const key = competitionGroupKey(f, competitionById);
    const label = displayName.toUpperCase();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        slug: pickCanonicalCompetitionSlug(displayName, competitionById),
        fixtures: [],
      });
    }
    groups.get(key)!.fixtures.push(f);
  }

  return Array.from(groups.values())
    .sort((a, b) => {
      const ta = a.fixtures[0]?.kickoffAt ? new Date(a.fixtures[0].kickoffAt).getTime() : 0;
      const tb = b.fixtures[0]?.kickoffAt ? new Date(b.fixtures[0].kickoffAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return a.label.localeCompare(b.label);
    })
    .map((g) => ({
      ...g,
      fixtures: [...g.fixtures].sort((a, b) => {
        const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
        const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
        return ta - tb;
      }),
    }));
}

function slugifySegment(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Planet Rugby-style path: /matches/{id}/{comp}/{compId}/{home}-v-{away}/{date} */
export function buildMatchDetailPath(input: {
  matchId: string;
  competitionName: string;
  competitionId: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  matchDate: string;
}): string {
  const compSlug = slugifySegment(input.competitionName);
  return `/matches/${input.matchId}/${compSlug}/${input.competitionId}/${input.homeTeamSlug}-v-${input.awayTeamSlug}/${input.matchDate}`;
}

/** Prefer Planet Rugby Match Centre URL over commentary when a PR match URL is stored. */
export function matchDetailHref(fixture: ScheduleFixture): string | null {
  if (fixture.planetRugbyUrl) {
    try {
      const path = new URL(fixture.planetRugbyUrl).pathname;
      const parts = path.split("/").filter(Boolean);
      const matchesIdx = parts.indexOf("matches");
      if (matchesIdx >= 0 && parts[matchesIdx + 1] && parts.length >= matchesIdx + 6) {
        return `/${parts.slice(matchesIdx).join("/")}`;
      }
    } catch {
      /* ignore bad URLs */
    }
  }

  const matchId =
    fixture.externalMatchId ??
    (fixture.source === "sdms" ? fixture.id.replace(/^sdms:/, "") : null);
  const homeSlug = fixture.homeTeam?.slug || slugifySegment(fixture.homeTeam?.name ?? "");
  const awaySlug = fixture.awayTeam?.slug || slugifySegment(fixture.awayTeam?.name ?? "");
  const compId = fixture.sdmsCompetitionId ?? fixture.competitionId;
  if (!matchId || !homeSlug || !awaySlug || !compId || !fixture.competitionName || !fixture.matchDate) {
    return null;
  }
  return buildMatchDetailPath({
    matchId,
    competitionName: fixture.competitionName,
    competitionId: String(compId),
    homeTeamSlug: homeSlug,
    awayTeamSlug: awaySlug,
    matchDate: fixture.matchDate,
  });
}
