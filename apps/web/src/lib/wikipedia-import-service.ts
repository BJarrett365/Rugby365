import { eq } from "drizzle-orm";
import { competitions, playerCareerStints, players, teams } from "@rugby365/db";
import {
  findWikipediaPlayerArticleTitles,
  parseNationalityFromBirthPlace,
  parseWikipediaArchive,
  prioritizePlayerArticleTitles,
  type WikipediaArchiveData,
  type WikipediaEntityType,
  type WikipediaPlayerArchive,
} from "@rugby365/import-sdk";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam } from "./entity-resolve-service";
import { normalizeSlug } from "./fixture-admin-service";
import { countryNameLooksLikeClubTeam } from "./player-profile-fields";
import { getWikimediaEnterpriseAccessToken } from "./wikimedia-enterprise-client";

export type PlayerArchiveEnrichResult = {
  enriched: boolean;
  playerId: string;
  wikipediaUrl?: string;
  careerStints?: number;
  reason?: string;
};

function namesLikelyMatch(playerName: string, archiveName: string): boolean {
  const a = playerName.trim().toLowerCase();
  const b = archiveName.trim().toLowerCase();
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  const aParts = a.split(/\s+/);
  const bParts = b.split(/\s+/);
  const aLast = aParts.at(-1);
  const bLast = bParts.at(-1);
  const aFirst = aParts[0];
  const bFirst = bParts[0];
  return Boolean(aLast && bLast && aLast === bLast && aFirst && bFirst && aFirst[0] === bFirst[0]);
}

function nationalityFromPlayerArchive(archive: WikipediaPlayerArchive): string | null {
  const intlTeams = archive.internationalCareer?.map((row) => row.teamName.trim()).filter(Boolean) ?? [];
  if (intlTeams.length > 0) {
    return intlTeams[intlTeams.length - 1] ?? null;
  }
  return parseNationalityFromBirthPlace(archive.birthPlace) ?? null;
}

async function resolveInternationalTeamId(countryName: string | null | undefined): Promise<string | null> {
  if (!countryName?.trim()) return null;
  const team = await resolveTeam({ name: countryName.trim(), createIfMissing: false });
  return team?.id ?? null;
}

export async function previewWikipediaArchive(input: {
  articleTitleOrUrl: string;
  entityType?: WikipediaEntityType;
}) {
  const accessToken = await getWikimediaEnterpriseAccessToken();
  return parseWikipediaArchive({
    articleTitleOrUrl: input.articleTitleOrUrl,
    entityType: input.entityType ?? "auto",
    accessToken,
  });
}

async function upsertPlayerCareerStints(
  playerId: string,
  archive: WikipediaPlayerArchive,
  sourceUrl: string,
) {
  const db = getDb();
  await db.delete(playerCareerStints).where(eq(playerCareerStints.playerId, playerId));

  const all = [
    ...(archive.clubCareer ?? []).map((row) => ({ ...row, careerType: "club" as const })),
    ...(archive.cupCareer ?? []).map((row) => ({ ...row, careerType: "cup" as const })),
    ...(archive.internationalCareer ?? []).map((row) => ({
      ...row,
      careerType: "international" as const,
    })),
  ];

  for (const row of all) {
    const team = await resolveTeam({ name: row.teamName, createIfMissing: true });
    await db.insert(playerCareerStints).values({
      playerId,
      careerType: row.careerType,
      startYear: row.startYear ?? null,
      endYear: row.endYear ?? null,
      yearsLabel: row.yearsLabel,
      teamName: row.teamName,
      teamId: team?.id ?? null,
      apps: row.apps ?? null,
      points: row.points ?? null,
      sortOrder: row.sortOrder ?? 0,
      sourceProvider: "wikipedia",
      sourceUrl,
    });
  }
}

async function applyWikipediaPlayerArchive(
  playerId: string,
  archive: WikipediaPlayerArchive,
  options: { mergeLiveFields: boolean },
): Promise<{ entityId: string; slug: string }> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  const positions = archive.positions?.length ? archive.positions : undefined;
  const positionName = positions?.[0] ?? archive.positions?.join(", ");

  let clubTeamId: string | null = player.clubTeamId;
  if (archive.currentTeam && !player.clubTeamId) {
    const club = await resolveTeam({ name: archive.currentTeam, createIfMissing: true });
    clubTeamId = club?.id ?? null;
  }

  const archiveNationality = nationalityFromPlayerArchive(archive);
  const hasIntlCaps = (archive.internationalCareer?.length ?? 0) > 0;
  let internationalTeamId = player.internationalTeamId;
  if (hasIntlCaps && archiveNationality && !player.internationalTeamId) {
    internationalTeamId = await resolveInternationalTeamId(archiveNationality);
  }

  const archivePatch = {
    fullName: archive.fullName ?? null,
    birthDate: archive.birthDate ?? null,
    birthPlace: archive.birthPlace ?? null,
    heightCm: archive.heightCm ?? null,
    weightKg: archive.weightKg ?? null,
    school: archive.school ?? null,
    relatives: archive.relatives ?? null,
    positions: positions ?? null,
    imageUrl: archive.imageUrl ?? null,
    bioSummary: archive.bioSummary ?? null,
    wikipediaUrl: archive.wikipediaUrl,
    wikidataId: archive.wikidataId ?? null,
    archiveSyncedAt: new Date(),
  };

  const patch = options.mergeLiveFields
    ? {
        ...archivePatch,
        positionName: player.positionName ?? positionName ?? null,
        clubName: player.clubName ?? archive.currentTeam ?? null,
        clubTeamId,
        countryName:
          player.countryName ??
          (archiveNationality && !countryNameLooksLikeClubTeam(archiveNationality, player.clubName ?? archive.currentTeam)
            ? archiveNationality
            : null),
        internationalTeamId,
      }
    : {
        name: archive.name,
        ...archivePatch,
        positionName: positionName ?? null,
        clubName: archive.currentTeam ?? null,
        clubTeamId,
        countryName: archiveNationality,
        internationalTeamId,
        sourceProvider: "wikipedia" as const,
      };

  const [updated] = await db.update(players).set(patch).where(eq(players.id, playerId)).returning();
  await upsertPlayerCareerStints(updated.id, archive, archive.wikipediaUrl);
  const { repairPlayerProfileFromSquads } = await import("./player-profile-fields");
  await repairPlayerProfileFromSquads(playerId);
  return { entityId: updated.id, slug: updated.slug };
}

/** Look up Wikipedia by player name and merge archive bio + career into an existing player. */
export async function enrichPlayerFromWikipedia(
  playerId: string,
  playerName?: string,
): Promise<PlayerArchiveEnrichResult> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) {
    return { enriched: false, playerId, reason: "player_not_found" };
  }

  const name = (playerName ?? player.name).trim();
  if (!name || name.length < 3) {
    return { enriched: false, playerId, reason: "name_too_short" };
  }

  const accessToken = await getWikimediaEnterpriseAccessToken();
  const candidates = prioritizePlayerArticleTitles(
    await findWikipediaPlayerArticleTitles(name),
    name,
  );

  for (const title of candidates) {
    try {
      const parsed = await parseWikipediaArchive({
        articleTitleOrUrl: title,
        entityType: "player",
        accessToken,
      });

      if (parsed.entityType !== "player") continue;
      if (!namesLikelyMatch(name, parsed.name)) continue;

      await applyWikipediaPlayerArchive(playerId, parsed, { mergeLiveFields: true });
      const careerStints =
        (parsed.clubCareer?.length ?? 0) +
        (parsed.cupCareer?.length ?? 0) +
        (parsed.internationalCareer?.length ?? 0);

      return {
        enriched: true,
        playerId,
        wikipediaUrl: parsed.wikipediaUrl,
        careerStints,
      };
    } catch {
      continue;
    }
  }

  return { enriched: false, playerId, reason: "no_matching_wikipedia_article" };
}

async function importPlayerArchive(
  archive: WikipediaPlayerArchive,
  linkPlayerId?: string,
): Promise<{ entityId: string; slug: string; created: boolean }> {
  const db = getDb();

  let player =
    linkPlayerId != null
      ? (await db.select().from(players).where(eq(players.id, linkPlayerId)).limit(1))[0]
      : undefined;

  if (!player && archive.wikidataId) {
    const [byWikidata] = await db
      .select()
      .from(players)
      .where(eq(players.wikidataId, archive.wikidataId))
      .limit(1);
    player = byWikidata;
  }

  if (player) {
    const result = await applyWikipediaPlayerArchive(player.id, archive, { mergeLiveFields: false });
    return { ...result, created: false };
  }

  if (!player) {
    const resolved = await resolvePlayer({
      name: archive.name,
      createIfMissing: true,
      skipArchiveEnrich: true,
    });
    if (!resolved) {
      const positions = archive.positions?.length ? archive.positions : undefined;
      const positionName = positions?.[0] ?? archive.positions?.join(", ");
      let clubTeamId: string | null = null;
      if (archive.currentTeam) {
        const club = await resolveTeam({ name: archive.currentTeam, createIfMissing: true });
        clubTeamId = club?.id ?? null;
      }
      const slug = normalizeSlug(archive.name);
      const [created] = await db
        .insert(players)
        .values({
          slug,
          name: archive.name,
          fullName: archive.fullName ?? null,
          birthDate: archive.birthDate ?? null,
          birthPlace: archive.birthPlace ?? null,
          heightCm: archive.heightCm ?? null,
          weightKg: archive.weightKg ?? null,
          school: archive.school ?? null,
          relatives: archive.relatives ?? null,
          positions: positions ?? null,
          positionName: positionName ?? null,
          clubName: archive.currentTeam ?? null,
          clubTeamId,
          imageUrl: archive.imageUrl ?? null,
          bioSummary: archive.bioSummary ?? null,
          wikipediaUrl: archive.wikipediaUrl,
          wikidataId: archive.wikidataId ?? null,
          archiveSyncedAt: new Date(),
          sourceProvider: "wikipedia",
        })
        .returning();
      await upsertPlayerCareerStints(created.id, archive, archive.wikipediaUrl);
      return { entityId: created.id, slug: created.slug, created: true };
    }
    const result = await applyWikipediaPlayerArchive(resolved.id, archive, { mergeLiveFields: false });
    return { ...result, created: true };
  }

  throw new Error("Unable to import player archive");
}

async function importTeamArchive(
  archive: Extract<WikipediaArchiveData, { entityType: "team" }>,
  linkTeamId?: string,
): Promise<{ entityId: string; slug: string; created: boolean }> {
  const db = getDb();

  let team =
    linkTeamId != null
      ? (await db.select().from(teams).where(eq(teams.id, linkTeamId)).limit(1))[0]
      : undefined;

  if (!team && archive.wikidataId) {
    const [byWikidata] = await db
      .select()
      .from(teams)
      .where(eq(teams.wikidataId, archive.wikidataId))
      .limit(1);
    team = byWikidata;
  }

  if (!team) {
    team = (await resolveTeam({ name: archive.name, createIfMissing: true })) ?? undefined;
  }

  const patch = {
    name: archive.name,
    countryName: archive.countryName ?? null,
    foundedYear: archive.foundedYear ?? null,
    imageUrl: archive.imageUrl ?? null,
    bioSummary: archive.bioSummary ?? null,
    wikipediaUrl: archive.wikipediaUrl,
    wikidataId: archive.wikidataId ?? null,
    archiveSyncedAt: new Date(),
    sourceProvider: "wikipedia" as const,
  };

  if (team) {
    const [updated] = await db.update(teams).set(patch).where(eq(teams.id, team.id)).returning();
    return { entityId: updated.id, slug: updated.slug, created: false };
  }

  const slug = normalizeSlug(archive.name);
  const [created] = await db
    .insert(teams)
    .values({
      slug,
      shortName: archive.name.slice(0, 3).toUpperCase(),
      ...patch,
    })
    .returning();

  return { entityId: created.id, slug: created.slug, created: true };
}

async function importCompetitionArchive(
  archive: Extract<WikipediaArchiveData, { entityType: "competition" }>,
  linkCompetitionId?: string,
): Promise<{ entityId: string; slug: string; created: boolean }> {
  const db = getDb();

  let competition =
    linkCompetitionId != null
      ? (await db.select().from(competitions).where(eq(competitions.id, linkCompetitionId)).limit(1))[0]
      : undefined;

  if (!competition && archive.wikidataId) {
    const [byWikidata] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.wikidataId, archive.wikidataId))
      .limit(1);
    competition = byWikidata;
  }

  if (!competition) {
    const slug = normalizeSlug(archive.name);
    const [bySlug] = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
    competition = bySlug;
  }

  const patch = {
    name: archive.name,
    bioSummary: archive.bioSummary ?? null,
    wikipediaUrl: archive.wikipediaUrl,
    wikidataId: archive.wikidataId ?? null,
    archiveSyncedAt: new Date(),
    sourceProvider: "wikipedia" as const,
  };

  if (competition) {
    const [updated] = await db
      .update(competitions)
      .set(patch)
      .where(eq(competitions.id, competition.id))
      .returning();
    return { entityId: updated.id, slug: updated.slug, created: false };
  }

  const slug = normalizeSlug(archive.name);
  const [created] = await db
    .insert(competitions)
    .values({
      slug,
      competitionType: "domestic",
      ...patch,
    })
    .returning();

  return { entityId: created.id, slug: created.slug, created: true };
}

export async function importWikipediaArchive(input: {
  articleTitleOrUrl: string;
  entityType?: WikipediaEntityType;
  linkEntityId?: string;
}) {
  const archive = await previewWikipediaArchive({
    articleTitleOrUrl: input.articleTitleOrUrl,
    entityType: input.entityType,
  });

  if (archive.entityType === "player") {
    const result = await importPlayerArchive(archive, input.linkEntityId);
    return {
      ...result,
      entityType: "player" as const,
      archive,
      careerStints:
        (archive.clubCareer?.length ?? 0) +
        (archive.cupCareer?.length ?? 0) +
        (archive.internationalCareer?.length ?? 0),
    };
  }

  if (archive.entityType === "team") {
    const result = await importTeamArchive(archive, input.linkEntityId);
    return { ...result, entityType: "team" as const, archive };
  }

  const result = await importCompetitionArchive(archive, input.linkEntityId);
  return { ...result, entityType: "competition" as const, archive };
}
