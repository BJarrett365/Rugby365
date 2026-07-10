import { teams } from "@rugby365/db";
import { findCoachCategoryByCountry } from "./coach-wikipedia-category-catalog";
import { getDb } from "./db";
import { normalizedEntityKey } from "./entity-normalize";
import { listTeamPickerData } from "./team-picker-service";
import { rugbyHemisphereForTeam } from "./team-picker-groups";

export type TeamClassificationContext = {
  internationalTeamIds: Set<string>;
  clubTeamIds: Set<string>;
  internationalNameKeys: Set<string>;
  clubNameKeys: Set<string>;
  teamNameById: Map<string, string>;
};

let cachedContext: TeamClassificationContext | null = null;

function nameKey(name: string): string {
  return normalizedEntityKey(name, "team");
}

export async function loadTeamClassificationContext(
  refresh = false,
): Promise<TeamClassificationContext> {
  if (cachedContext && !refresh) return cachedContext;

  const db = getDb();
  const [{ teams: teamRows, groups }, teamTypes] = await Promise.all([
    listTeamPickerData(),
    db.select({ id: teams.id, name: teams.name, teamType: teams.teamType }).from(teams),
  ]);

  const internationalTeamIds = new Set<string>();
  const clubTeamIds = new Set<string>();

  for (const group of groups) {
    const isIntl = group.label.startsWith("Internationals");
    for (const team of group.teams) {
      if (isIntl) internationalTeamIds.add(team.id);
      else if (group.id.startsWith("club:")) clubTeamIds.add(team.id);
    }
  }

  for (const row of teamTypes) {
    if (row.teamType === "international") {
      internationalTeamIds.add(row.id);
      clubTeamIds.delete(row.id);
    }
  }

  for (const team of teamRows) {
    if (isKnownInternationalCountryName(team.name)) {
      internationalTeamIds.add(team.id);
      clubTeamIds.delete(team.id);
    }
  }

  const internationalNameKeys = new Set<string>();
  const clubNameKeys = new Set<string>();
  const teamNameById = new Map<string, string>();

  for (const team of teamRows) {
    teamNameById.set(team.id, team.name);
    const key = nameKey(team.name);
    if (internationalTeamIds.has(team.id)) {
      internationalNameKeys.add(key);
    } else if (clubTeamIds.has(team.id)) {
      clubNameKeys.add(key);
    }
  }

  cachedContext = {
    internationalTeamIds,
    clubTeamIds,
    internationalNameKeys,
    clubNameKeys,
    teamNameById,
  };
  return cachedContext;
}

export function clearTeamClassificationCache() {
  cachedContext = null;
}

export function isInternationalTeamId(
  ctx: TeamClassificationContext,
  teamId: string | null | undefined,
): boolean {
  if (!teamId) return false;
  return ctx.internationalTeamIds.has(teamId);
}

export function isClubTeamId(ctx: TeamClassificationContext, teamId: string | null | undefined): boolean {
  if (!teamId) return false;
  return ctx.clubTeamIds.has(teamId);
}

export function isAgeGradeInternationalTeamName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return /\b(u18|u20|u21|under[- ]?18|under[- ]?20|england a|england 'a')\b/i.test(name);
}

export function isKnownInternationalCountryName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  if (isAgeGradeInternationalTeamName(name)) return false;
  if (rugbyHemisphereForTeam(name)) return true;
  if (findCoachCategoryByCountry(name)) return true;
  return false;
}

export function isClubTeamName(
  ctx: TeamClassificationContext,
  name: string | null | undefined,
): boolean {
  if (!name?.trim()) return false;
  const key = nameKey(name);
  if (ctx.internationalNameKeys.has(key)) return false;
  if (isKnownInternationalCountryName(name)) return false;
  if (ctx.clubNameKeys.has(key)) return true;

  const lower = name.trim().toLowerCase();
  return (
    lower.includes(" rugby") ||
    /\b(saints|bears|sharks|tigers|warriors|ulster|connacht|ospreys|scarlets|leinster|munster|chiefs|gloucester|harlequins|saracens|bath|sale|exeter|bristol|newcastle|northampton|leicester|cardiff|dragons|bayonne|toulon|racing|stade|lyon|montpellier|bordeaux|clermont|castres|pau|perpignan|biarritz|section|usap|vannes|rouen|soyaux)\b/.test(
      lower,
    )
  );
}

export function isValidInternationalCountryName(
  ctx: TeamClassificationContext,
  name: string | null | undefined,
  playerClubName?: string | null,
): boolean {
  if (!name?.trim()) return false;
  if (playerClubName && name.trim().toLowerCase() === playerClubName.trim().toLowerCase()) {
    return false;
  }
  if (isClubTeamName(ctx, name)) return false;
  return isKnownInternationalCountryName(name) || ctx.internationalNameKeys.has(nameKey(name));
}

export function playerInternationalAssignmentInvalid(
  ctx: TeamClassificationContext,
  player: {
    countryName: string | null;
    clubName: string | null;
    internationalTeamId: string | null;
  },
): { invalid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (
    player.internationalTeamId &&
    !isInternationalTeamId(ctx, player.internationalTeamId)
  ) {
    const teamName = ctx.teamNameById.get(player.internationalTeamId) ?? player.internationalTeamId;
    reasons.push(`international team is a club side (${teamName})`);
  }

  const intlTeamName = player.internationalTeamId
    ? ctx.teamNameById.get(player.internationalTeamId)
    : null;
  if (intlTeamName && isAgeGradeInternationalTeamName(intlTeamName)) {
    reasons.push(`international team is age-grade, not senior (${intlTeamName})`);
  }

  if (player.countryName && isAgeGradeInternationalTeamName(player.countryName)) {
    reasons.push(`country name is age-grade, not senior (${player.countryName})`);
  } else if (player.countryName && !isValidInternationalCountryName(ctx, player.countryName, player.clubName)) {
    reasons.push(`country name is not a valid international team (${player.countryName})`);
  }

  return { invalid: reasons.length > 0, reasons };
}

export function resolveDisplayNation(
  ctx: TeamClassificationContext,
  player: {
    nationCode: string | null;
    countryName: string | null;
    clubName: string | null;
    internationalTeamId: string | null;
    internationalTeamName?: string | null;
  },
): string | null {
  if (player.nationCode?.trim()) return player.nationCode.trim().toUpperCase();

  if (
    player.internationalTeamId &&
    isInternationalTeamId(ctx, player.internationalTeamId) &&
    player.internationalTeamName
  ) {
    return player.internationalTeamName;
  }

  if (isValidInternationalCountryName(ctx, player.countryName, player.clubName)) {
    return player.countryName;
  }

  return null;
}
