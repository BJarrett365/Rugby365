import { stripTeamSponsorAndSeasonLabels } from "./entity-normalize";
import { buildMatchDetailPath } from "./match-schedule-utils";
import { buildRecentMatchLabel } from "./player-recent-matches-utils";
import {
  isUnknownStandingsTeamName,
  pickCanonicalFixturesForStandings,
  resolveTeamNamesFromFixtureSlug,
  canonicalStandingsTeamName,
} from "./table-lab/standings-fixture-dedupe";

export type RefereeAppointmentInput = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamSlug: string | null;
  awayTeamSlug: string | null;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  competitionCode: string | null;
  competitionSlug: string | null;
};

export type PublicRefereeMatch = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  href: string | null;
};

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildRefereeMatchCentreHref(input: {
  id: string;
  slug: string;
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  competitionName: string | null;
  competitionCode: string | null;
  competitionSlug: string | null;
  homeTeamSlug: string | null;
  awayTeamSlug: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  kickoffAt: string | null;
}): string | null {
  if (input.planetRugbyUrl) {
    try {
      const path = new URL(input.planetRugbyUrl).pathname;
      const parts = path.split("/").filter(Boolean);
      const matchesIdx = parts.indexOf("matches");
      if (matchesIdx >= 0 && parts.length >= matchesIdx + 6) {
        return `/${parts.slice(matchesIdx).join("/")}`;
      }
    } catch {
      /* ignore */
    }
  }

  const matchId = input.externalMatchId?.trim() || input.id.trim() || null;
  const homeSlug = input.homeTeamSlug?.trim() || (input.homeTeamName ? slugifySegment(input.homeTeamName) : "");
  const awaySlug = input.awayTeamSlug?.trim() || (input.awayTeamName ? slugifySegment(input.awayTeamName) : "");
  const matchDate = input.kickoffAt ? input.kickoffAt.slice(0, 10) : null;
  const competitionName = input.competitionName?.trim() || input.competitionSlug?.trim() || null;
  const competitionId =
    input.competitionCode?.trim() || input.competitionSlug?.trim() || (competitionName ? slugifySegment(competitionName) : null);
  if (matchId && homeSlug && awaySlug && matchDate && competitionName && competitionId) {
    return buildMatchDetailPath({
      matchId,
      competitionName,
      competitionId,
      homeTeamSlug: homeSlug,
      awayTeamSlug: awaySlug,
      matchDate,
    });
  }
  return null;
}

export function refereeDisplayTeamName(name: string): string {
  return canonicalStandingsTeamName(stripTeamSponsorAndSeasonLabels(name));
}

export function isDisplayableRefereeMatch(homeName: string, awayName: string): boolean {
  return !isUnknownStandingsTeamName(homeName) && !isUnknownStandingsTeamName(awayName);
}

export function sanitizeRefereeAppointments(rows: RefereeAppointmentInput[]): PublicRefereeMatch[] {
  const named = rows
    .map((row) => {
      const resolved = resolveTeamNamesFromFixtureSlug(
        row.slug,
        row.homeTeamName ?? "",
        row.awayTeamName ?? "",
      );
      return {
        row,
        homeName: refereeDisplayTeamName(resolved.homeName),
        awayName: refereeDisplayTeamName(resolved.awayName),
      };
    })
    .filter(({ homeName, awayName }) => isDisplayableRefereeMatch(homeName, awayName));

  const deduped = pickCanonicalFixturesForStandings(named, ({ row, homeName, awayName }) => ({
    id: row.id,
    slug: row.slug,
    status: row.status,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homeName,
    awayName,
    kickoffAt: row.kickoffAt,
  }));

  const seenScoreline = new Set<string>();
  const unique: typeof deduped = [];
  for (const item of deduped) {
    const day = item.row.kickoffAt?.slice(0, 10) ?? "undated";
    const pair = [item.homeName.toLowerCase(), item.awayName.toLowerCase()].sort().join(":");
    const lo = Math.min(item.row.homeScore, item.row.awayScore);
    const hi = Math.max(item.row.homeScore, item.row.awayScore);
    const scoreKey = `${day}:${pair}:${lo}:${hi}`;
    if (seenScoreline.has(scoreKey)) continue;
    seenScoreline.add(scoreKey);
    unique.push(item);
  }

  return unique.map(({ row, homeName, awayName }) => ({
    id: row.id,
    slug: row.slug,
    kickoffAt: row.kickoffAt,
    status: row.status,
    competitionName: row.competitionName,
    homeTeamName: homeName,
    awayTeamName: awayName,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homeCrestUrl: row.homeCrestUrl,
    awayCrestUrl: row.awayCrestUrl,
    href: buildRefereeMatchCentreHref({
      id: row.id,
      slug: row.slug,
      planetRugbyUrl: row.planetRugbyUrl,
      externalMatchId: row.externalMatchId,
      competitionName: row.competitionName,
      competitionCode: row.competitionCode,
      competitionSlug: row.competitionSlug,
      homeTeamSlug: row.homeTeamSlug,
      awayTeamSlug: row.awayTeamSlug,
      homeTeamName: homeName,
      awayTeamName: awayName,
      kickoffAt: row.kickoffAt,
    }),
  }));
}

export function refereeMatchLabel(row: Pick<PublicRefereeMatch, "homeTeamName" | "awayTeamName" | "homeScore" | "awayScore">): string {
  return buildRecentMatchLabel({
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
  });
}
