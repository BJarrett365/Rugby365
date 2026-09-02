import { rankingCountryFlagUrl } from "./player-ranking-engine";
import type { PublicRefereeProfile } from "./public-referee-profile-service";
import { REFEREE_DASHBOARD_ANALYTICS_TEMPLATE } from "./referee-dashboard-mock";
import { refereeMatchLabel } from "./referee-matches-utils";
import {
  emptyRefereeBio,
  ratingToHundred,
  refereeNationFor,
  refereeUnionFor,
} from "./referee-identity-utils";
import type { RefereeDashboardModel, RefereeMatchRow } from "./referee-dashboard-types";

function ageFromIso(iso: string | null): number | null {
  if (!iso) return null;
  const born = new Date(iso);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const month = now.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

function formatBirth(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const age = ageFromIso(iso);
  return age != null ? `${label} (${age})` : label;
}

function formatMatchDate(iso: string | null): string {
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function mergeRefereeDashboard(
  profile: PublicRefereeProfile,
  mock: RefereeDashboardModel = REFEREE_DASHBOARD_ANALYTICS_TEMPLATE,
): RefereeDashboardModel {
  const liveRows: RefereeMatchRow[] = profile.recentMatches.map((row, index) => {
    const mockRow = mock.recentMatches[index];
    return {
      id: row.id,
      dateLabel: formatMatchDate(row.kickoffAt),
      fixtureLabel: refereeMatchLabel(row),
      href: row.href,
      competition: row.competitionName ?? "Match",
      rating: mockRow?.rating ?? null,
      yellowCards: mockRow?.yellowCards ?? null,
      redCards: mockRow?.redCards ?? null,
      isMock: true,
      kickoffAtIso: row.kickoffAt,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      homeCrestUrl: row.homeCrestUrl,
      awayCrestUrl: row.awayCrestUrl,
    };
  });

  const country = refereeNationFor(profile.name, profile.countryName, profile.nationality);
  const now = Date.now();
  const upcoming = profile.recentMatches.find((row) => {
    if (!row.kickoffAt) return false;
    const t = new Date(row.kickoffAt).getTime();
    return Number.isFinite(t) && t > now;
  });
  const blanks = emptyRefereeBio();
  const liveRating = ratingToHundred(profile.avgRating);
  const matches = profile.matchCount;
  const internationals = profile.internationalMatchCount;
  const tests = profile.testMatchCount;
  const tournaments = profile.tournamentCount;

  return {
    ...mock,
    slug: profile.slug,
    name: profile.name,
    countryName: country ?? "",
    flagUrl: rankingCountryFlagUrl(country) ?? null,
    portraitUrl: profile.imageUrl?.trim() || null,
    bio: {
      ...blanks,
      nationality: country ?? blanks.nationality,
      dateOfBirth: formatBirth(profile.birthDate),
      worldRugbyDebut: profile.debutYear ?? blanks.worldRugbyDebut,
      union: refereeUnionFor(profile.name, country) ?? blanks.union,
      profession: profile.occupation ?? blanks.profession,
    },
    overallRating: liveRating ?? 0,
    worldRank: 0,
    totalMatches: matches,
    internationalMatches: internationals,
    careerStats: mock.careerStats.map((row) => {
      if (row.key === "matches") return { ...row, value: String(matches) };
      if (row.key === "internationals") return { ...row, value: String(internationals) };
      if (row.key === "tests") return { ...row, value: String(tests) };
      if (row.key === "tournaments") return { ...row, value: String(tournaments) };
      return row;
    }),
    about: profile.bioSummary?.trim() || `${profile.name} is a rugby union referee.`,
    recentMatches: liveRows,
    sectionStatus: {
      ...mock.sectionStatus,
      matches: liveRows.length ? "ready" : "empty",
      next: upcoming ? "ready" : "empty",
    },
    nextAppointment: upcoming
      ? {
          competition: upcoming.competitionName ?? "Appointment",
          kickoffLabel: formatMatchDate(upcoming.kickoffAt),
          venue: "Venue TBC",
          homeTeam: upcoming.homeTeamName ?? "TBC",
          awayTeam: upcoming.awayTeamName ?? "TBC",
          homeCrestUrl: upcoming.homeCrestUrl,
          awayCrestUrl: upcoming.awayCrestUrl,
          kickoffAtIso: upcoming.kickoffAt,
        }
      : null,
  };
}
