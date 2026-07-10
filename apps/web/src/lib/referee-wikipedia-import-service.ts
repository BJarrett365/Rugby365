import { eq } from "drizzle-orm";
import { referees } from "@rugby365/db";
import {
  fetchWikipediaCategoryMembers,
  isWikipediaCategoryUrl,
  parseWikipediaArchive,
  parseWikipediaCategoryUrl,
  type WikipediaRefereeArchive,
  type WikipediaRefereeStint,
} from "@rugby365/import-sdk";
import { getDb } from "./db";
import {
  getRefereeById,
  resolveReferee,
  updateReferee,
} from "./entity-admin-service";
import { getWikimediaEnterpriseAccessToken } from "./wikimedia-enterprise-client";

export type RefereeWikipediaImportResult = {
  refereeId: string;
  slug: string;
  created: boolean;
  wikipediaUrl: string;
  competitionCount: number;
};

export type RefereeCategoryPreview = {
  categoryTitle: string;
  members: Array<{ title: string; pageId: number }>;
};

export type RefereeCategoryImportResult = {
  categoryTitle: string;
  imported: RefereeWikipediaImportResult[];
  failed: Array<{ title: string; error: string }>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatRefereeCareerNotes(career?: WikipediaRefereeStint[]): string | null {
  if (!career?.length) return null;
  const lines = career.map((row) => {
    const years =
      row.yearsLabel && row.yearsLabel !== "-" && row.yearsLabel.trim()
        ? `${row.yearsLabel} · `
        : "";
    const apps = row.apps != null ? ` (${row.apps} apps)` : "";
    return `- ${years}${row.competitionName}${apps}`;
  });
  return `Wikipedia competitions officiated:\n${lines.join("\n")}`;
}

export async function previewRefereeWikipediaCategory(
  categoryTitleOrUrl: string,
): Promise<RefereeCategoryPreview> {
  const categoryTitle = isWikipediaCategoryUrl(categoryTitleOrUrl)
    ? parseWikipediaCategoryUrl(categoryTitleOrUrl).categoryTitle
    : categoryTitleOrUrl;
  const members = await fetchWikipediaCategoryMembers({ categoryTitleOrUrl: categoryTitle });
  return { categoryTitle, members };
}

async function parseRefereeArchive(articleTitleOrUrl: string): Promise<WikipediaRefereeArchive> {
  const accessToken = await getWikimediaEnterpriseAccessToken();
  const parsed = await parseWikipediaArchive({
    articleTitleOrUrl,
    entityType: "referee",
    accessToken,
  });
  if (parsed.entityType !== "referee") {
    throw new Error(`Article is not a referee biography: ${parsed.entityType}`);
  }
  return parsed;
}

async function upsertRefereeFromArchive(
  archive: WikipediaRefereeArchive,
  options?: { defaultCountryName?: string },
) {
  const externalProviderId = archive.wikidataId ?? archive.wikipediaUrl;
  const existingByWiki = archive.wikidataId
    ? (
        await getDb()
          .select()
          .from(referees)
          .where(eq(referees.wikidataId, archive.wikidataId))
          .limit(1)
      )[0]
    : undefined;

  const countryName = archive.nationality ?? options?.defaultCountryName ?? null;
  const existing =
    existingByWiki ??
    (await resolveReferee({
      name: archive.name,
      countryName: countryName ?? undefined,
      externalProviderId,
      createIfMissing: false,
    }));

  const resolved =
    existing ??
    (await resolveReferee({
      name: archive.name,
      countryName: countryName ?? undefined,
      externalProviderId,
      createIfMissing: true,
    }));

  if (!resolved) throw new Error("Failed to resolve referee");

  const careerNotes = formatRefereeCareerNotes(archive.refereeCareer);
  const notes = [
    archive.fullName && archive.fullName !== archive.name ? `Full name: ${archive.fullName}` : null,
    archive.occupation ? `Occupation: ${archive.occupation}` : null,
    careerNotes,
  ]
    .filter(Boolean)
    .join("\n\n");

  const referee = await updateReferee(resolved.id, {
    name: archive.name,
    countryName: countryName ?? resolved.countryName ?? undefined,
    nationality: countryName,
    birthDate: archive.birthDate ?? null,
    imageUrl: archive.imageUrl ?? null,
    bioSummary: archive.bioSummary ?? null,
    wikipediaUrl: archive.wikipediaUrl,
    wikidataId: archive.wikidataId ?? null,
    sourceUrl: archive.wikipediaUrl,
    notes: notes || null,
    externalProviderId,
  });

  return {
    referee,
    created: !existing,
    competitionCount: archive.refereeCareer?.length ?? 0,
  };
}

export async function importRefereeFromWikipedia(input: {
  articleTitleOrUrl: string;
  defaultCountryName?: string;
}): Promise<RefereeWikipediaImportResult> {
  const archive = await parseRefereeArchive(input.articleTitleOrUrl);
  const { referee, created, competitionCount } = await upsertRefereeFromArchive(archive, {
    defaultCountryName: input.defaultCountryName,
  });

  return {
    refereeId: referee.id,
    slug: referee.slug,
    created,
    wikipediaUrl: archive.wikipediaUrl,
    competitionCount,
  };
}

export async function importRefereesFromWikipediaCategory(input: {
  categoryTitleOrUrl: string;
  defaultCountryName?: string;
  delayMs?: number;
}): Promise<RefereeCategoryImportResult> {
  const preview = await previewRefereeWikipediaCategory(input.categoryTitleOrUrl);
  const imported: RefereeWikipediaImportResult[] = [];
  const failed: Array<{ title: string; error: string }> = [];
  const delayMs = input.delayMs ?? 1200;

  for (const member of preview.members) {
    try {
      const result = await importRefereeFromWikipedia({
        articleTitleOrUrl: member.title,
        defaultCountryName: input.defaultCountryName,
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
    imported,
    failed,
  };
}

export async function enrichRefereeFromWikipedia(refereeId: string): Promise<RefereeWikipediaImportResult> {
  const referee = await getRefereeById(refereeId);
  if (!referee) throw new Error("Referee not found");
  if (!referee.wikipediaUrl) throw new Error("Referee has no Wikipedia URL");

  return importRefereeFromWikipedia({ articleTitleOrUrl: referee.wikipediaUrl });
}
