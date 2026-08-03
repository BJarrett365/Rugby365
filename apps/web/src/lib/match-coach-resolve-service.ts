/**
 * Resolve home/away head coaches onto a CMS fixture for the public match header.
 * Uses current team coaching staff first, then curated head-coach defaults.
 */
import { and, eq, sql } from "drizzle-orm";
import { coaches, fixtures, teamCoachingStaff, teams } from "@rugby365/db";
import { getDb } from "./db";
import { resolveCoach, upsertCoachingStaffAssignment } from "./coach-admin-service";
import {
  stripTeamSponsorAndSeasonLabels,
  teamDedupBaseName,
  teamDedupKey,
} from "./entity-normalize";
import { ensureFixtureStaffLinks } from "./staff-match-rating-service";

/** Known current head coaches when CMS staff rows are missing. */
const TEAM_HEAD_COACH_DEFAULTS: Record<
  string,
  { name: string; wikipediaUrl?: string; nationality?: string }
> = {
  griquas: {
    name: "Pieter Bergh",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Pieter_Bergh",
    nationality: "South Africa",
  },
  bulls: {
    name: "Phiwe Nomlomo",
    nationality: "South Africa",
  },
  "blue-bulls": {
    name: "Phiwe Nomlomo",
    nationality: "South Africa",
  },
  cheetahs: {
    name: "Frans Steyn",
    nationality: "South Africa",
  },
  lions: {
    name: "Ivan van Rooyen",
    nationality: "South Africa",
  },
  pumas: {
    name: "Jimmy Stonehouse",
    nationality: "South Africa",
  },
  sharks: {
    name: "John Plumtree",
    nationality: "New Zealand",
  },
  "boland-cavaliers": {
    name: "Kloppie Botha",
    nationality: "South Africa",
  },
  stormers: {
    name: "John Dobson",
    wikipediaUrl: "https://en.wikipedia.org/wiki/John_Dobson_(rugby_union)",
    nationality: "South Africa",
  },
  "western-province": {
    name: "John Dobson",
    wikipediaUrl: "https://en.wikipedia.org/wiki/John_Dobson_(rugby_union)",
    nationality: "South Africa",
  },
  // Bunnings NPC / NZ provincial (2026 season)
  canterbury: {
    name: "Alex Robertson",
    nationality: "New Zealand",
  },
  auckland: {
    name: "Steven Bates",
    nationality: "New Zealand",
  },
  otago: {
    name: "Mark Brown",
    nationality: "New Zealand",
  },
  waikato: {
    name: "Leon Holden",
    nationality: "New Zealand",
  },
  taranaki: {
    name: "Jarrad Hoeata",
    nationality: "New Zealand",
  },
  "counties-manukau": {
    name: "Reon Graham",
    nationality: "New Zealand",
  },
  "hawke-s-bay": {
    name: "Brock James",
    nationality: "Australia",
  },
  "hawkes-bay": {
    name: "Brock James",
    nationality: "Australia",
  },
  wellington: {
    name: "Trent Renata",
    nationality: "New Zealand",
  },
  "bay-of-plenty": {
    name: "Richard Watt",
    nationality: "New Zealand",
  },
  southland: {
    name: "Scott Eade",
    nationality: "New Zealand",
  },
  northland: {
    name: "Ryan Martin",
    nationality: "New Zealand",
  },
  manawatu: {
    name: "Wesley Clarke",
    nationality: "New Zealand",
  },
  tasman: {
    name: "Jono Phillips",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tasman_(National_Provincial_Championship)",
    nationality: "New Zealand",
  },
  "tasman-makos": {
    name: "Jono Phillips",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tasman_(National_Provincial_Championship)",
    nationality: "New Zealand",
  },
  mako: {
    name: "Jono Phillips",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tasman_(National_Provincial_Championship)",
    nationality: "New Zealand",
  },
  "north-harbour": {
    name: "Jimmy Maher",
    wikipediaUrl: "https://en.wikipedia.org/wiki/North_Harbour_(National_Provincial_Championship)",
    nationality: "New Zealand",
  },
  "north-harbour-rays": {
    name: "Jimmy Maher",
    wikipediaUrl: "https://en.wikipedia.org/wiki/North_Harbour_(National_Provincial_Championship)",
    nationality: "New Zealand",
  },

  // URC (common missing sides)
  leinster: { name: "Leo Cullen", nationality: "Ireland" },
  munster: { name: "Clayton McMillan", nationality: "New Zealand" },
  ulster: { name: "Richie Murphy", nationality: "Ireland" },
  connacht: { name: "Pete Wilkins", nationality: "England" },
  "glasgow-warriors": { name: "Franco Smith", nationality: "South Africa" },
  edinburgh: { name: "Sean Everitt", nationality: "South Africa" },
  cardiff: { name: "Matt Sherratt", nationality: "Wales" },
  ospreys: { name: "Mark Jones", nationality: "Wales" },
  scarlets: { name: "Dwayne Peel", nationality: "Wales" },
  dragons: { name: "Filo Paulo", nationality: "New Zealand" },
  benetton: { name: "Marco Bortolami", nationality: "Italy" },
  zebre: { name: "Massimo Brunello", nationality: "Italy" },

  // Internationals
  italy: { name: "Gonzalo Quesada", nationality: "Argentina" },
  japan: { name: "Eddie Jones", nationality: "Australia" },
  "united-states": { name: "Scott Lawrence", nationality: "United States" },
  usa: { name: "Scott Lawrence", nationality: "United States" },
  samoa: { name: "Mahonri Schwalger", nationality: "Samoa" },
  georgia: { name: "Pierre-Henry Broncan", nationality: "France" },
  canada: { name: "Kingsley Jones", nationality: "Wales" },
  uruguay: { name: "Esteban Meneses", nationality: "Uruguay" },
  chile: { name: "Pablo Lemoine", nationality: "Uruguay" },
  "new-zealand": { name: "Scott Robertson", nationality: "New Zealand" },
  australia: { name: "Joe Schmidt", nationality: "New Zealand" },

  // Top 14
  "stade-toulousain": { name: "Ugo Mola", nationality: "France" },
  toulouse: { name: "Ugo Mola", nationality: "France" },
  "la-rochelle": { name: "Ronan O'Gara", nationality: "Ireland" },
  "racing-92": { name: "Patrice Collazo", nationality: "France" },
  "bordeaux-begles": { name: "Yannick Bru", nationality: "France" },
  "section-paloise": { name: "Sébastien Piqueronies", nationality: "France" },
  pau: { name: "Sébastien Piqueronies", nationality: "France" },
  montpellier: { name: "Joan Caudullo", nationality: "France" },

  // Tier 2 internationals
  portugal: { name: "Simon Mannix", nationality: "New Zealand" },
  spain: { name: "Pablo Bouza", nationality: "Argentina" },
  tonga: { name: "Tevita Tu'ifua", nationality: "Tonga" },
  "hong-kong": { name: "Logan Asplin", nationality: "New Zealand" },
};

function slugifyTeamLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function coachDefaultForTeam(slug: string | null | undefined, name: string | null | undefined) {
  const candidates = new Set<string>();
  const slugKey = (slug ?? "").trim().toLowerCase();
  if (slugKey) candidates.add(slugKey);
  // Drop random provider slug suffixes (e.g. dhl-stormers-xxiii-pd9ry3j8).
  const slugCore = slugKey.replace(/-[a-z0-9]{6,}$/i, "");
  if (slugCore) candidates.add(slugCore);

  if (name) {
    const nameKey = slugifyTeamLabel(name);
    if (nameKey) candidates.add(nameKey);
    const stripped = slugifyTeamLabel(stripTeamSponsorAndSeasonLabels(name));
    if (stripped) candidates.add(stripped);
  }

  for (const key of candidates) {
    if (TEAM_HEAD_COACH_DEFAULTS[key]) return TEAM_HEAD_COACH_DEFAULTS[key]!;
  }
  return null;
}

/** Prefer current staff on this team, else same-club alias (sponsor / XXIII duplicates). */
async function resolveCoachIdForTeam(teamId: string): Promise<string | null> {
  const db = getDb();
  const [team] = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return null;

  const direct = await db
    .select({
      coachId: teamCoachingStaff.coachId,
      role: teamCoachingStaff.role,
    })
    .from(teamCoachingStaff)
    .where(and(eq(teamCoachingStaff.teamId, teamId), eq(teamCoachingStaff.isCurrent, true)));

  const ranked = direct
    .map((r) => ({
      coachId: r.coachId,
      rank: /head/i.test(r.role ?? "") ? 0 : /director/i.test(r.role ?? "") ? 1 : 2,
    }))
    .sort((a, b) => a.rank - b.rank);
  if (ranked[0]?.coachId) return ranked[0].coachId;

  const key = teamDedupKey(team.name);
  const base = teamDedupBaseName(team.name);
  const aliasNeedle = `%${base.replace(/[%_]/g, "")}%`;
  const aliases = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(sql`lower(${teams.name}) like ${aliasNeedle}`)
    .limit(40);
  const aliasIds = aliases
    .filter((t) => t.id !== teamId && teamDedupKey(t.name) === key)
    .map((t) => t.id);
  for (const aliasId of aliasIds) {
    const rows = await db
      .select({ coachId: teamCoachingStaff.coachId, role: teamCoachingStaff.role })
      .from(teamCoachingStaff)
      .where(and(eq(teamCoachingStaff.teamId, aliasId), eq(teamCoachingStaff.isCurrent, true)));
    const best = rows
      .map((r) => ({
        coachId: r.coachId,
        rank: /head/i.test(r.role ?? "") ? 0 : /director/i.test(r.role ?? "") ? 1 : 2,
      }))
      .sort((a, b) => a.rank - b.rank)[0];
    if (best?.coachId) return best.coachId;
  }

  return null;
}

async function ensureTeamHeadCoach(teamId: string | null): Promise<string | null> {
  if (!teamId) return null;
  const fromStaff = await resolveCoachIdForTeam(teamId);
  if (fromStaff) return fromStaff;

  const db = getDb();
  const [team] = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return null;

  const defaults = coachDefaultForTeam(team.slug, team.name);
  if (!defaults) return null;

  const coach = await resolveCoach({
    name: defaults.name,
    nationality: defaults.nationality ?? null,
    createIfMissing: true,
    sourceProvider: "manual",
  });
  if (!coach) return null;

  if (defaults.wikipediaUrl && !coach.wikipediaUrl) {
    await db
      .update(coaches)
      .set({ wikipediaUrl: defaults.wikipediaUrl, updatedAt: new Date() })
      .where(eq(coaches.id, coach.id));
  }

  await upsertCoachingStaffAssignment({
    coachId: coach.id,
    teamId: team.id,
    role: "head_coach",
    isCurrent: true,
    sourceUrl: defaults.wikipediaUrl ?? null,
    importKey: `match-header-default:${team.id}:head_coach`,
  });

  return coach.id;
}

/**
 * Ensure the fixture has home/away coach IDs for header display.
 */
export async function ensureFixtureMatchCoaches(fixtureId: string): Promise<{
  homeCoachId: string | null;
  awayCoachId: string | null;
}> {
  await ensureFixtureStaffLinks(fixtureId);

  const db = getDb();
  let [fixture] = await db.select().from(fixtures).where(eq(fixtures.id, fixtureId)).limit(1);
  if (!fixture) return { homeCoachId: null, awayCoachId: null };

  const patch: { homeCoachId?: string; awayCoachId?: string } = {};

  if (!fixture.homeCoachId) {
    const id = await ensureTeamHeadCoach(fixture.homeTeamId);
    if (id) patch.homeCoachId = id;
  }
  if (!fixture.awayCoachId) {
    const id = await ensureTeamHeadCoach(fixture.awayTeamId);
    if (id) patch.awayCoachId = id;
  }

  if (Object.keys(patch).length) {
    const [updated] = await db
      .update(fixtures)
      .set(patch)
      .where(eq(fixtures.id, fixtureId))
      .returning();
    fixture = updated ?? fixture;
  }

  return {
    homeCoachId: fixture.homeCoachId,
    awayCoachId: fixture.awayCoachId,
  };
}
