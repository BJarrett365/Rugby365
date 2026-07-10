import { and, desc, eq } from "drizzle-orm";
import { coaches, people, referees } from "@rugby365/db";
import { getDb } from "./db";
import type { PersonRoleType } from "./person-intelligence-types";
import { calculatePlayerAge } from "./player-profile-utils";
import { normalizedEntityKey } from "./entity-normalize";

export async function getPersonByRole(roleType: PersonRoleType, roleEntityId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(people)
    .where(and(eq(people.roleType, roleType), eq(people.roleEntityId, roleEntityId)))
    .limit(1);
  return row ?? null;
}

export async function getPersonById(personId: string) {
  const db = getDb();
  const [row] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  return row ?? null;
}

export async function ensurePersonForCoach(coachId: string) {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.id, coachId)).limit(1);
  if (!coach) throw new Error("Coach not found");

  const existing = await getPersonByRole("coach", coachId);
  if (existing) return existing;

  const sourceUrls = [
    coach.wikipediaUrl ? { label: "Wikipedia", url: coach.wikipediaUrl } : null,
    coach.sourceUrl ? { label: "Source", url: coach.sourceUrl } : null,
  ].filter((row): row is { label: string; url: string } => Boolean(row));

  const [created] = await db
    .insert(people)
    .values({
      roleType: "coach",
      roleEntityId: coachId,
      name: coach.name,
      slug: coach.slug,
      birthDate: coach.birthDate,
      nationality: coach.nationality,
      imageUrl: coach.imageUrl,
      bioSummary: coach.bioSummary,
      socialAccounts: coach.socialAccounts ?? {},
      wikipediaUrl: coach.wikipediaUrl,
      wikidataId: coach.wikidataId,
      sourceUrls,
      verificationStatus: coach.bioSummary ? "partial" : "unverified",
    })
    .returning();

  return created;
}

export async function ensurePersonForReferee(refereeId: string) {
  const db = getDb();
  const [referee] = await db.select().from(referees).where(eq(referees.id, refereeId)).limit(1);
  if (!referee) throw new Error("Referee not found");

  const existing = await getPersonByRole("referee", refereeId);
  if (existing) return existing;

  const sourceUrls = [
    referee.wikipediaUrl ? { label: "Wikipedia", url: referee.wikipediaUrl } : null,
    referee.sourceUrl ? { label: "Source", url: referee.sourceUrl } : null,
  ].filter((row): row is { label: string; url: string } => Boolean(row));

  const [created] = await db
    .insert(people)
    .values({
      roleType: "referee",
      roleEntityId: refereeId,
      name: referee.name,
      slug: referee.slug,
      birthDate: referee.birthDate,
      nationality: referee.nationality ?? referee.countryName,
      imageUrl: referee.imageUrl,
      bioSummary: referee.bioSummary,
      socialAccounts: referee.socialAccounts ?? {},
      wikipediaUrl: referee.wikipediaUrl,
      wikidataId: referee.wikidataId,
      sourceUrls,
      verificationStatus: referee.bioSummary ? "partial" : "unverified",
    })
    .returning();

  return created;
}

export function personDuplicateKey(name: string, birthDate: string | null, nationality: string | null) {
  const nameKey = normalizedEntityKey(name, "player");
  const dobKey = birthDate ?? "";
  const natKey = (nationality ?? "").trim().toLowerCase();
  return `${nameKey}|${dobKey}|${natKey}`;
}

export async function findPotentialPersonDuplicates(input: {
  roleType: PersonRoleType;
  name: string;
  birthDate?: string | null;
  nationality?: string | null;
}) {
  const db = getDb();
  const key = personDuplicateKey(input.name, input.birthDate ?? null, input.nationality ?? null);
  const rows = await db.select().from(people).where(eq(people.roleType, input.roleType));
  return rows.filter(
    (row) =>
      personDuplicateKey(row.name, row.birthDate, row.nationality) === key &&
      row.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
  );
}

export function buildPersonMissingFields(
  roleType: PersonRoleType,
  fields: Record<string, unknown>,
): Array<{ field: string; label: string; importance: "high" | "medium" | "low" }> {
  const common = [
    { field: "bioSummary", label: "Bio", importance: "medium" as const },
    { field: "birthDate", label: "Date of birth", importance: "high" as const },
    { field: "nationality", label: "Nationality", importance: "medium" as const },
    { field: "imageUrl", label: "Photo", importance: "low" as const },
  ];
  const coachFields = [
    { field: "currentRole", label: "Current role", importance: "high" as const },
    { field: "currentOrganisation", label: "Current team", importance: "high" as const },
  ];
  const refereeFields = [
    { field: "currentRole", label: "Refereeing level", importance: "medium" as const },
  ];
  const list = roleType === "coach" ? [...common, ...coachFields] : [...common, ...refereeFields];
  return list.filter((item) => {
    const value = fields[item.field];
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.trim().length === 0;
    return false;
  });
}

export function personAgeFromBirthDate(birthDate: string | null | undefined) {
  return calculatePlayerAge(birthDate);
}
