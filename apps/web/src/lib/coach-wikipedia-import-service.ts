import { eq } from "drizzle-orm";
import { coachHonours, coachPlayingStints, coaches, teams } from "@rugby365/db";
import {
  fetchWikipediaCategoryMembers,
  fetchWikipediaCategorySubcategories,
  isWikipediaCategoryUrl,
  parseWikipediaArchive,
  parseWikipediaCategoryUrl,
  type WikipediaCoachArchive,
  type WikipediaCoachingStint,
} from "@rugby365/import-sdk";
import {
  createCoach,
  getCoachById,
  resolveCoach,
  updateCoach,
  upsertCoachingStaffAssignment,
} from "./coach-admin-service";
import {
  parseWikipediaHonourLines,
  compareProposedHonours,
  type ProposedCoachHonour,
} from "./coach-wikipedia-honours-parse";
import {
  findCoachCategoryByUrl,
  IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES,
  parseCountryFromCoachCategory,
  type InternationalCoachCategory,
} from "./coach-wikipedia-category-catalog";
import { getDb } from "./db";
import {
  buildCoachTeamResolver,
  loadCmsTeamsForCoachAssignment,
} from "./coach-team-resolve-service";
import { namesLikelyMatch } from "./player-profile-enrichment-service";

type CoachTeamResolver = ReturnType<typeof buildCoachTeamResolver>;
import { getWikimediaEnterpriseAccessToken } from "./wikimedia-enterprise-client";

export type CoachWikipediaImportResult = {
  coachId: string;
  slug: string;
  created: boolean;
  wikipediaUrl: string;
  assignmentsCreated: number;
  assignmentsUpdated: number;
};

export type CoachCategoryPreview = {
  categoryTitle: string;
  members: Array<{ title: string; pageId: number }>;
};

export type CoachCategoryImportResult = {
  categoryTitle: string;
  country: string | null;
  imported: CoachWikipediaImportResult[];
  failed: Array<{ title: string; error: string }>;
};

export type CoachBulkCategoryImportResult = {
  categoriesProcessed: number;
  imported: number;
  failed: number;
  results: CoachCategoryImportResult[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function teamNamesMatch(candidate: string, target: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/\brugby union\b/g, "")
      .replace(/\bnational\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const a = normalize(candidate);
  const b = normalize(target);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aFirst = a.split(" ")[0];
  const bFirst = b.split(" ")[0];
  return aFirst.length >= 4 && aFirst === bFirst;
}

function stintIsCurrent(yearsLabel: string, endYear?: number | null): boolean {
  if (endYear != null) return false;
  return /[–—-]\s*$/.test(yearsLabel.trim());
}

function yearToStartDate(year?: number | null): string | null {
  return year != null ? `${year}-01-01` : null;
}

function yearToEndDate(year?: number | null): string | null {
  return year != null ? `${year}-12-31` : null;
}

export async function previewCoachWikipediaCategory(
  categoryTitleOrUrl: string,
): Promise<CoachCategoryPreview & { country: string | null; subcategories: Array<{ title: string; pageId: number }> }> {
  const categoryTitle = isWikipediaCategoryUrl(categoryTitleOrUrl)
    ? parseWikipediaCategoryUrl(categoryTitleOrUrl).categoryTitle
    : categoryTitleOrUrl;
  const [members, subcategories] = await Promise.all([
    fetchWikipediaCategoryMembers({ categoryTitleOrUrl: categoryTitle }),
    fetchWikipediaCategorySubcategories({ categoryTitleOrUrl: categoryTitle, limit: 100 }),
  ]);
  const catalogEntry = findCoachCategoryByUrl(categoryTitleOrUrl);
  const country =
    catalogEntry?.country && !catalogEntry.isHub
      ? catalogEntry.country
      : parseCountryFromCoachCategory(categoryTitle);
  return { categoryTitle, members, country, subcategories };
}

export async function resolveCoachCategoryTeamId(
  input: {
    categoryTitleOrUrl: string;
    linkTeamId?: string;
    countryName?: string | null;
  },
): Promise<{ teamId?: string; teamName?: string; country: string | null }> {
  const catalogEntry = findCoachCategoryByUrl(input.categoryTitleOrUrl);
  const country =
    input.countryName ??
    (catalogEntry && !catalogEntry.isHub ? catalogEntry.country : null) ??
    parseCountryFromCoachCategory(input.categoryTitleOrUrl);

  if (input.linkTeamId) {
    const [team] = await getDb().select().from(teams).where(eq(teams.id, input.linkTeamId)).limit(1);
    return { teamId: team?.id, teamName: team?.name, country };
  }

  if (!country) return { country: null };

  const db = getDb();
  const teamRows = await db.select({ id: teams.id, name: teams.name, slug: teams.slug }).from(teams);
  const hints = catalogEntry ?? { teamSlugs: [], teamNames: [country] };
  const slugHints = new Set((hints.teamSlugs ?? []).map((slug) => slug.toLowerCase()));
  const nameHints = new Set((hints.teamNames ?? [country]).map((name) => name.toLowerCase()));

  const matched =
    teamRows.find((team) => slugHints.has(team.slug.toLowerCase())) ??
    teamRows.find((team) => nameHints.has(team.name.toLowerCase())) ??
    teamRows.find((team) => teamNamesMatch(team.name, country));

  if (matched) {
    return { teamId: matched.id, teamName: matched.name, country };
  }

  return { country };
}

async function parseCoachArchive(articleTitleOrUrl: string): Promise<WikipediaCoachArchive> {
  const accessToken = await getWikimediaEnterpriseAccessToken();
  const parsed = await parseWikipediaArchive({
    articleTitleOrUrl,
    entityType: "coach",
    accessToken,
  });
  if (parsed.entityType !== "coach") {
    throw new Error(`Article is not a coach biography: ${parsed.entityType}`);
  }
  return parsed;
}

async function upsertCoachFromArchive(
  archive: WikipediaCoachArchive,
  options?: { countryName?: string | null },
) {
  const externalProviderId = archive.wikidataId ?? archive.wikipediaUrl;
  const existingByWiki = archive.wikidataId
    ? (
        await getDb()
          .select()
          .from(coaches)
          .where(eq(coaches.wikidataId, archive.wikidataId))
          .limit(1)
      )[0]
    : undefined;

  const existing =
    existingByWiki ??
    (await resolveCoach({
      name: archive.name,
      birthDate: archive.birthDate ?? null,
      nationality: archive.nationality ?? null,
      externalProviderId,
      createIfMissing: false,
    }));

  const notes = [
    archive.fullName && archive.fullName !== archive.name ? `Full name: ${archive.fullName}` : null,
    options?.countryName ? `Coached country: ${options.countryName}` : null,
    archive.nationality ? `Nationality: ${archive.nationality}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const coach = await createCoach({
    name: archive.name,
    birthDate: archive.birthDate ?? null,
    nationality: archive.nationality ?? null,
    imageUrl: archive.imageUrl ?? null,
    bioSummary: archive.bioSummary ?? null,
    wikipediaUrl: archive.wikipediaUrl,
    wikidataId: archive.wikidataId ?? null,
    sourceUrl: archive.wikipediaUrl,
    externalProviderId,
    notes: notes || null,
  });

  await updateCoach(coach.id, {
    fullName: archive.fullName ?? null,
    placeOfBirth: archive.birthPlace ?? null,
    heightCm: archive.heightCm ?? null,
  });

  // Playing career stints — structured, unverified until CMS review
  if (archive.playingCareer?.length) {
    const db = getDb();
    const existing = await db
      .select()
      .from(coachPlayingStints)
      .where(eq(coachPlayingStints.coachId, coach.id));
    const keys = new Set(existing.map((e) => `${e.teamType}|${e.yearsLabel}|${e.teamName}`));
    let sort = existing.length;
    for (const stint of archive.playingCareer) {
      const teamType =
        stint.careerType === "international"
          ? "international"
          : stint.careerType === "cup"
            ? "franchise"
            : "club";
      const key = `${teamType}|${stint.yearsLabel}|${stint.teamName}`;
      if (keys.has(key)) continue;
      await db.insert(coachPlayingStints).values({
        coachId: coach.id,
        teamType,
        yearsLabel: stint.yearsLabel,
        startYear: stint.startYear ?? null,
        endYear: stint.endYear ?? null,
        teamName: stint.teamName,
        apps: stint.apps ?? null,
        points: stint.points ?? null,
        sortOrder: stint.sortOrder ?? sort++,
        sourceProvider: "wikipedia",
        sourceUrl: archive.wikipediaUrl,
        showOnOverview: teamType === "international",
      });
      keys.add(key);
    }
  }

  return { coach, created: !existing };
}

export async function previewCoachWikipediaHonours(coachId: string): Promise<{
  proposed: ProposedCoachHonour[];
  review: ReturnType<typeof compareProposedHonours>;
}> {
  const coach = await getCoachById(coachId);
  if (!coach?.wikipediaUrl) throw new Error("Coach has no Wikipedia URL");
  const archive = await parseCoachArchive(coach.wikipediaUrl);
  const proposed = parseWikipediaHonourLines(archive.honourLines ?? [], "coach");
  const existing = await getDb()
    .select({
      competitionName: coachHonours.competitionName,
      year: coachHonours.year,
      achievementType: coachHonours.achievementType,
    })
    .from(coachHonours)
    .where(eq(coachHonours.coachId, coachId));
  return { proposed, review: compareProposedHonours(proposed, existing) };
}

async function ensureCategoryNationalTeamAssignment(
  coachId: string,
  archive: WikipediaCoachArchive,
  options: { teamId: string; teamName: string; categoryTitle: string; countryName: string | null },
) {
  const career = archive.coachingCareer ?? [];
  const hasStint = career.some((stint) => teamNamesMatch(stint.teamName, options.teamName));
  if (hasStint) return { assignmentsCreated: 0, assignmentsUpdated: 0 };

  const result = await upsertCoachingStaffAssignment({
    coachId,
    teamId: options.teamId,
    role: "head_coach",
    bioSummary: `Listed in ${options.categoryTitle}`,
    notes: [
      options.countryName ? `Country: ${options.countryName}` : null,
      archive.nationality ? `Nationality: ${archive.nationality}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    sourceUrl: archive.wikipediaUrl,
    importKey: `wikipedia-category:${coachId}:${options.teamId}`,
  });

  return {
    assignmentsCreated: result.created ? 1 : 0,
    assignmentsUpdated: result.created ? 0 : 1,
  };
}

async function upsertAssignmentsFromArchive(
  coachId: string,
  archive: WikipediaCoachArchive,
  options?: {
    linkTeamId?: string;
    linkTeamName?: string;
    categoryTitle?: string;
    countryName?: string | null;
    teamResolver?: CoachTeamResolver;
  },
) {
  let assignmentsCreated = 0;
  let assignmentsUpdated = 0;
  const career = archive.coachingCareer ?? [];
  const teamResolver = options?.teamResolver ?? buildCoachTeamResolver(await loadCmsTeamsForCoachAssignment());

  for (const stint of career) {
    const team = teamResolver.resolveWikipediaTeamLabel(stint.teamName);
    if (!team) continue;

    const isLinkedTeam = options?.linkTeamId
      ? team.id === options.linkTeamId || teamNamesMatch(stint.teamName, options.linkTeamName ?? "")
      : false;
    const isCurrent = stintIsCurrent(stint.yearsLabel, stint.endYear);

    const result = await upsertCoachingStaffAssignment({
      coachId,
      teamId: team.id,
      role: stint.teamName.toLowerCase().includes("national") ? "head_coach" : "head_coach",
      startDate: yearToStartDate(stint.startYear),
      endDate: yearToEndDate(stint.endYear),
      isCurrent: isLinkedTeam ? isCurrent : isCurrent && !options?.linkTeamId,
      bioSummary: `${stint.yearsLabel} · ${stint.teamName}`,
      sourceUrl: archive.wikipediaUrl,
      importKey: `wikipedia:${coachId}:${team.id}:${stint.sortOrder ?? stint.yearsLabel}`,
    });

    if (result.created) assignmentsCreated += 1;
    else assignmentsUpdated += 1;
  }

  if (options?.linkTeamId && options.linkTeamName) {
    const ensured = await ensureCategoryNationalTeamAssignment(coachId, archive, {
      teamId: options.linkTeamId,
      teamName: options.linkTeamName,
      categoryTitle: options.categoryTitle ?? "Wikipedia coach category",
      countryName: options.countryName ?? null,
    });
    assignmentsCreated += ensured.assignmentsCreated;
    assignmentsUpdated += ensured.assignmentsUpdated;
  }

  return { assignmentsCreated, assignmentsUpdated };
}

export async function importCoachFromWikipedia(input: {
  articleTitleOrUrl: string;
  linkTeamId?: string;
  linkTeamName?: string;
  categoryTitle?: string;
  countryName?: string | null;
  teamResolver?: CoachTeamResolver;
}): Promise<CoachWikipediaImportResult> {
  const archive = await parseCoachArchive(input.articleTitleOrUrl);
  const teamResolver = input.teamResolver ?? buildCoachTeamResolver(await loadCmsTeamsForCoachAssignment());
  const { coach, created } = await upsertCoachFromArchive(archive, {
    countryName: input.countryName,
  });

  let linkTeamId = input.linkTeamId;
  let linkTeamName = input.linkTeamName;
  if (linkTeamId && !linkTeamName) {
    const team = teamResolver.byId.get(linkTeamId);
    linkTeamName = team?.name;
  }
  if (!linkTeamId && input.countryName) {
    const team = teamResolver.resolveCountry(input.countryName);
    linkTeamId = team?.id;
    linkTeamName = team?.name;
  }

  const { assignmentsCreated, assignmentsUpdated } = await upsertAssignmentsFromArchive(
    coach.id,
    archive,
    {
      linkTeamId,
      linkTeamName,
      categoryTitle: input.categoryTitle,
      countryName: input.countryName,
      teamResolver,
    },
  );

  return {
    coachId: coach.id,
    slug: coach.slug,
    created,
    wikipediaUrl: archive.wikipediaUrl,
    assignmentsCreated,
    assignmentsUpdated,
  };
}

export async function importCoachesFromWikipediaCategory(input: {
  categoryTitleOrUrl: string;
  linkTeamId?: string;
  countryName?: string | null;
  delayMs?: number;
}): Promise<CoachCategoryImportResult> {
  const preview = await previewCoachWikipediaCategory(input.categoryTitleOrUrl);
  const resolvedTeam = await resolveCoachCategoryTeamId({
    categoryTitleOrUrl: input.categoryTitleOrUrl,
    linkTeamId: input.linkTeamId,
    countryName: input.countryName,
  });
  const teamResolver = buildCoachTeamResolver(await loadCmsTeamsForCoachAssignment());

  const imported: CoachWikipediaImportResult[] = [];
  const failed: Array<{ title: string; error: string }> = [];
  const delayMs = input.delayMs ?? 1200;

  for (const member of preview.members) {
    try {
      const result = await importCoachFromWikipedia({
        articleTitleOrUrl: member.title,
        linkTeamId: resolvedTeam.teamId,
        linkTeamName: resolvedTeam.teamName,
        categoryTitle: preview.categoryTitle,
        countryName: resolvedTeam.country,
        teamResolver,
      });
      imported.push(result);
    } catch (error) {
      failed.push({
        title: member.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(delayMs);
  }

  return {
    categoryTitle: preview.categoryTitle,
    country: resolvedTeam.country,
    imported,
    failed,
  };
}

export async function importInternationalCoachCategories(input?: {
  categories?: InternationalCoachCategory[];
  delayMs?: number;
  categoryDelayMs?: number;
}): Promise<CoachBulkCategoryImportResult> {
  const categories = input?.categories ?? IMPORTABLE_INTERNATIONAL_COACH_CATEGORIES;
  const results: CoachCategoryImportResult[] = [];
  let imported = 0;
  let failed = 0;

  for (const category of categories) {
    const result = await importCoachesFromWikipediaCategory({
      categoryTitleOrUrl: category.url,
      countryName: category.country,
      delayMs: input?.delayMs ?? 1200,
    });
    results.push(result);
    imported += result.imported.length;
    failed += result.failed.length;
    await sleep(input?.categoryDelayMs ?? 3000);
  }

  return {
    categoriesProcessed: categories.length,
    imported,
    failed,
    results,
  };
}

export async function enrichCoachFromWikipedia(
  coachId: string,
  options?: { sourceUrl?: string },
): Promise<
  CoachWikipediaImportResult & {
    enriched: boolean;
    fieldsUpdated: string[];
    reason?: string;
  }
> {
  const coach = await getCoachById(coachId);
  if (!coach) throw new Error("Coach not found");

  const articleUrl = options?.sourceUrl?.trim() || coach.wikipediaUrl?.trim() || null;
  if (!articleUrl) {
    return {
      coachId,
      slug: coach.slug,
      created: false,
      wikipediaUrl: "",
      assignmentsCreated: 0,
      assignmentsUpdated: 0,
      enriched: false,
      fieldsUpdated: [],
      reason: "missing_wikipedia_url",
    };
  }

  // Persist URL even if parse fails later (mirrors player enrich behaviour).
  if (options?.sourceUrl?.trim() && options.sourceUrl.trim() !== coach.wikipediaUrl) {
    await updateCoach(coachId, { wikipediaUrl: options.sourceUrl.trim() });
  }

  const archive = await parseCoachArchive(articleUrl);
  if (!namesLikelyMatch(coach.name, archive.name)) {
    await updateCoach(coachId, { wikipediaUrl: archive.wikipediaUrl });
    return {
      coachId,
      slug: coach.slug,
      created: false,
      wikipediaUrl: archive.wikipediaUrl,
      assignmentsCreated: 0,
      assignmentsUpdated: 0,
      enriched: false,
      fieldsUpdated: ["wikipediaUrl"],
      reason: "name_mismatch",
    };
  }

  const fieldsUpdated: string[] = [];
  const pick = (existing: string | null | undefined, incoming: string | null | undefined) => {
    if (existing?.trim()) return undefined;
    return incoming?.trim() || undefined;
  };

  const patch: Parameters<typeof updateCoach>[1] = {
    wikipediaUrl: archive.wikipediaUrl,
  };
  fieldsUpdated.push("wikipediaUrl");

  if (archive.wikidataId && !coach.wikidataId) {
    patch.wikidataId = archive.wikidataId;
    fieldsUpdated.push("wikidataId");
  }
  const fullName = pick(coach.fullName, archive.fullName);
  if (fullName) {
    patch.fullName = fullName;
    fieldsUpdated.push("fullName");
  }
  if (!coach.birthDate && archive.birthDate) {
    patch.birthDate = archive.birthDate;
    fieldsUpdated.push("birthDate");
  }
  const placeOfBirth = pick(coach.placeOfBirth, archive.birthPlace);
  if (placeOfBirth) {
    patch.placeOfBirth = placeOfBirth;
    fieldsUpdated.push("placeOfBirth");
  }
  const nationality = pick(coach.nationality, archive.nationality);
  if (nationality) {
    patch.nationality = nationality;
    fieldsUpdated.push("nationality");
  }
  if (coach.heightCm == null && archive.heightCm != null && archive.heightCm > 0) {
    patch.heightCm = archive.heightCm;
    fieldsUpdated.push("heightCm");
  }
  const bio = pick(coach.bioSummary, archive.bioSummary);
  if (bio) {
    patch.bioSummary = bio;
    fieldsUpdated.push("bioSummary");
  }
  if (!coach.imageUrl?.trim() && archive.imageUrl) {
    patch.imageUrl = archive.imageUrl;
    fieldsUpdated.push("imageUrl");
  }

  await updateCoach(coachId, patch);

  // Playing career + coaching assignments (additive)
  if (archive.playingCareer?.length) {
    const db = getDb();
    const existingStints = await db
      .select()
      .from(coachPlayingStints)
      .where(eq(coachPlayingStints.coachId, coachId));
    const keys = new Set(
      existingStints.map((e) => `${e.teamType}|${e.yearsLabel}|${e.teamName}`),
    );
    let sort = existingStints.length;
    for (const stint of archive.playingCareer) {
      const teamType =
        stint.careerType === "international"
          ? "international"
          : stint.careerType === "cup"
            ? "franchise"
            : "club";
      const key = `${teamType}|${stint.yearsLabel}|${stint.teamName}`;
      if (keys.has(key)) continue;
      await db.insert(coachPlayingStints).values({
        coachId,
        teamType,
        yearsLabel: stint.yearsLabel,
        startYear: stint.startYear ?? null,
        endYear: stint.endYear ?? null,
        teamName: stint.teamName,
        apps: stint.apps ?? null,
        points: stint.points ?? null,
        sortOrder: stint.sortOrder ?? sort++,
        sourceProvider: "wikipedia",
        sourceUrl: archive.wikipediaUrl,
        showOnOverview: teamType === "international",
      });
      keys.add(key);
      fieldsUpdated.push("playingStint");
    }
  }

  const { assignmentsCreated, assignmentsUpdated } = await upsertAssignmentsFromArchive(
    coachId,
    archive,
  );

  return {
    coachId,
    slug: coach.slug,
    created: false,
    wikipediaUrl: archive.wikipediaUrl,
    assignmentsCreated,
    assignmentsUpdated,
    enriched: true,
    fieldsUpdated,
  };
}

export function filterCoachingCareerForTeam(
  career: WikipediaCoachingStint[],
  teamName: string,
): WikipediaCoachingStint[] {
  return career.filter((stint) => teamNamesMatch(stint.teamName, teamName));
}
