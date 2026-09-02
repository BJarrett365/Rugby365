import { eq } from "drizzle-orm";
import { competitions, playerCareerStints, players, teams } from "@rugby365/db";
import {
  fetchWikidataPlayerProfile,
  findWikipediaPlayerArticleTitles,
  parseNationalityFromBirthPlace,
  parseWikipediaArchive,
  prioritizePlayerArticleTitles,
  teamCodeFromName,
  type WikipediaArchiveData,
  type WikipediaEntityType,
  type WikipediaPlayerArchive,
} from "@rugby365/import-sdk";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam } from "./entity-resolve-service";
import { normalizeSlug } from "./fixture-admin-service";
import {
  resolveWikidataRequestOptions,
  resolveWikipediaRequestOptions,
} from "./mediawiki-settings";
import { countryNameLooksLikeClubTeam } from "./player-profile-fields";
import { isAgeGradeInternationalTeamName } from "./international-team-classify";
import { isPlaceholderNationCode, isPlaceholderNationLabel } from "./nation-code-utils";
import { normalizeSocialAccounts, type PlayerSocialAccounts } from "./player-profile-utils";
import { getWikimediaEnterpriseAccessToken } from "./wikimedia-enterprise-client";

export type PlayerArchiveEnrichResult = {
  enriched: boolean;
  playerId: string;
  wikipediaUrl?: string;
  careerStints?: number;
  fieldsUpdated?: string[];
  reason?: string;
};

export type ApplyWikipediaPlayerOptions = {
  /**
   * When true, keep existing CMS club/nation/position when set.
   * With fillMissingOnly, bio fields also only fill blanks.
   */
  mergeLiveFields: boolean;
  /**
   * Only write empty fields. Never overwrite DOB/place/height/weight/socials/bio.
   * Does not replace career stints. Does not create players.
   */
  fillMissingOnly?: boolean;
  /** Replace career stints table (default true unless fillMissingOnly). */
  upsertCareer?: boolean;
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
  const intlTeams =
    archive.internationalCareer?.map((row) => row.teamName.trim()).filter(Boolean) ?? [];
  const senior = intlTeams.filter((name) => !isAgeGradeInternationalTeamName(name));
  if (senior.length > 0) {
    return senior[senior.length - 1] ?? null;
  }
  return parseNationalityFromBirthPlace(archive.birthPlace) ?? null;
}

async function resolveInternationalTeamId(countryName: string | null | undefined): Promise<string | null> {
  if (!countryName?.trim()) return null;
  const team = await resolveTeam({ name: countryName.trim(), createIfMissing: false });
  return team?.id ?? null;
}

function pickString(existing: string | null | undefined, incoming: string | null | undefined): string | undefined {
  const current = existing?.trim();
  if (current) return undefined;
  const next = incoming?.trim();
  return next || undefined;
}

function pickNumber(existing: number | null | undefined, incoming: number | null | undefined): number | undefined {
  if (existing != null && existing > 0) return undefined;
  if (incoming != null && incoming > 0) return incoming;
  return undefined;
}

function mergeSocialAccountsMissingOnly(
  existingRaw: unknown,
  incoming: PlayerSocialAccounts,
): { next: PlayerSocialAccounts; updatedKeys: string[] } | null {
  const existing = normalizeSocialAccounts(existingRaw);
  const updatedKeys: string[] = [];
  const next: PlayerSocialAccounts = { ...existing };

  for (const key of ["twitter", "instagram", "facebook", "tiktok", "website"] as const) {
    if (existing[key]?.trim()) continue;
    const value = incoming[key]?.trim();
    if (!value) continue;
    next[key] = value;
    updatedKeys.push(key);
  }

  if (updatedKeys.length === 0) return null;
  return { next, updatedKeys };
}

async function attachWikidataProfile(archive: WikipediaPlayerArchive): Promise<WikipediaPlayerArchive> {
  if (!archive.wikidataId) return archive;
  const needsBio =
    !archive.birthDate ||
    !archive.birthPlace ||
    archive.heightCm == null ||
    archive.weightKg == null;
  const needsSocial = !archive.twitter || !archive.instagram || !archive.facebook || !archive.website;
  if (!needsBio && !needsSocial) return archive;

  const profile = await fetchWikidataPlayerProfile(
    archive.wikidataId,
    await resolveWikidataRequestOptions(),
  );
  return {
    ...archive,
    birthDate: archive.birthDate ?? profile.birthDate,
    birthPlace: archive.birthPlace ?? profile.birthPlace,
    heightCm: archive.heightCm ?? profile.heightCm,
    weightKg: archive.weightKg ?? profile.weightKg,
    twitter: archive.twitter ?? profile.twitter,
    instagram: archive.instagram ?? profile.instagram,
    facebook: archive.facebook ?? profile.facebook,
    website: archive.website ?? profile.website,
  };
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
    if (!row.teamName?.trim()) continue;
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

  const { syncTransfersFromClubCareerStints } = await import("./career-transfer-sync-service");
  await syncTransfersFromClubCareerStints(playerId);
}

async function applyWikipediaPlayerArchive(
  playerId: string,
  archive: WikipediaPlayerArchive,
  options: ApplyWikipediaPlayerOptions,
): Promise<{ entityId: string; slug: string; fieldsUpdated: string[] }> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  const fillMissingOnly = Boolean(options.fillMissingOnly);
  const upsertCareer = options.upsertCareer ?? !fillMissingOnly;
  const positions = archive.positions?.length ? archive.positions : undefined;
  const positionName = positions?.[0] ?? archive.positions?.join(", ");
  const fieldsUpdated: string[] = [];

  let clubTeamId: string | null = player.clubTeamId;
  const inferredCurrentClub =
    archive.currentTeam?.trim() ||
    archive.clubCareer?.filter((row) => row.teamName?.trim()).at(-1)?.teamName?.trim() ||
    null;
  if (inferredCurrentClub && (!player.clubTeamId || !player.clubName || /^unknown team\b/i.test(player.clubName))) {
    const club = await resolveTeam({ name: inferredCurrentClub, createIfMissing: !fillMissingOnly });
    clubTeamId = club?.id ?? clubTeamId;
    if (clubTeamId && clubTeamId !== player.clubTeamId) fieldsUpdated.push("clubTeamId");
  }

  const archiveNationality = nationalityFromPlayerArchive(archive);
  const existingCountry = isPlaceholderNationLabel(player.countryName) ? null : player.countryName;
  const hasIntlCaps = (archive.internationalCareer?.length ?? 0) > 0;
  let internationalTeamId = player.internationalTeamId;
  if (hasIntlCaps && archiveNationality && !player.internationalTeamId) {
    internationalTeamId = await resolveInternationalTeamId(archiveNationality);
    if (internationalTeamId) fieldsUpdated.push("internationalTeamId");
  }

  const socialMerge = mergeSocialAccountsMissingOnly(player.socialAccounts, {
    twitter: archive.twitter ?? null,
    instagram: archive.instagram ?? null,
    facebook: archive.facebook ?? null,
    website: archive.website ?? null,
  });

  let patch: Record<string, unknown>;

  if (fillMissingOnly || options.mergeLiveFields) {
    patch = {
      wikipediaUrl: player.wikipediaUrl ?? archive.wikipediaUrl,
      wikidataId: player.wikidataId ?? archive.wikidataId ?? null,
      archiveSyncedAt: new Date(),
      positionName: player.positionName ?? positionName ?? null,
      clubName: player.clubName && !/^unknown team\b/i.test(player.clubName)
        ? player.clubName
        : inferredCurrentClub ?? player.clubName ?? null,
      clubTeamId,
      countryName:
        existingCountry ??
        (archiveNationality &&
        !countryNameLooksLikeClubTeam(archiveNationality, player.clubName ?? archive.currentTeam)
          ? archiveNationality
          : null),
      internationalTeamId,
    };

    const fullName = pickString(player.fullName, archive.fullName);
    if (fullName) {
      patch.fullName = fullName;
      fieldsUpdated.push("fullName");
    }

    const birthDate = pickString(
      player.birthDate ? String(player.birthDate) : null,
      archive.birthDate,
    );
    if (birthDate) {
      patch.birthDate = birthDate;
      fieldsUpdated.push("birthDate");
    }

    const birthPlace = pickString(player.birthPlace, archive.birthPlace);
    if (birthPlace) {
      patch.birthPlace = birthPlace;
      fieldsUpdated.push("birthPlace");
    }

    const heightCm = pickNumber(player.heightCm, archive.heightCm);
    if (heightCm != null) {
      patch.heightCm = heightCm;
      fieldsUpdated.push("heightCm");
    }

    const weightKg = pickNumber(player.weightKg, archive.weightKg);
    if (weightKg != null) {
      patch.weightKg = weightKg;
      fieldsUpdated.push("weightKg");
    }

    if (fillMissingOnly) {
      const school = pickString(player.school, archive.school);
      if (school) {
        patch.school = school;
        fieldsUpdated.push("school");
      }
      const university = pickString(player.university, archive.university);
      if (university) {
        patch.university = university;
        fieldsUpdated.push("university");
      }
      const relatives = pickString(player.relatives, archive.relatives);
      if (relatives) {
        patch.relatives = relatives;
        fieldsUpdated.push("relatives");
      }
      const imageUrl = pickString(player.imageUrl, archive.imageUrl);
      if (imageUrl) {
        patch.imageUrl = imageUrl;
        fieldsUpdated.push("imageUrl");
      }
      const bioSummary = pickString(player.bioSummary, archive.bioSummary);
      if (bioSummary) {
        patch.bioSummary = bioSummary;
        fieldsUpdated.push("bioSummary");
      }
      if (!player.positions?.length && positions?.length) {
        patch.positions = positions;
        fieldsUpdated.push("positions");
      }
    } else {
      // Legacy enrich merge: still refresh archive-ish fields when incoming exists,
      // but only fill blanks for the bio fields the operator asked to protect.
      patch.fullName = player.fullName ?? archive.fullName ?? null;
      patch.birthDate = player.birthDate ?? archive.birthDate ?? null;
      patch.birthPlace = player.birthPlace ?? archive.birthPlace ?? null;
      patch.heightCm = player.heightCm ?? archive.heightCm ?? null;
      patch.weightKg = player.weightKg ?? archive.weightKg ?? null;
      patch.school = player.school ?? archive.school ?? null;
      patch.university = player.university ?? archive.university ?? null;
      patch.relatives = player.relatives ?? archive.relatives ?? null;
      patch.positions = player.positions?.length ? player.positions : (positions ?? null);
      patch.imageUrl = player.imageUrl ?? archive.imageUrl ?? null;
      patch.bioSummary = player.bioSummary ?? archive.bioSummary ?? null;
    }

    if (!player.wikipediaUrl && archive.wikipediaUrl) fieldsUpdated.push("wikipediaUrl");
    if (!player.wikidataId && archive.wikidataId) fieldsUpdated.push("wikidataId");
    if (!player.positionName && positionName) fieldsUpdated.push("positionName");
    if (!player.clubName && archive.currentTeam) fieldsUpdated.push("clubName");
    if (
      !existingCountry &&
      archiveNationality &&
      !countryNameLooksLikeClubTeam(archiveNationality, player.clubName ?? archive.currentTeam)
    ) {
      fieldsUpdated.push("countryName");
    }
  } else {
    patch = {
      name: archive.name,
      fullName: archive.fullName ?? null,
      birthDate: archive.birthDate ?? null,
      birthPlace: archive.birthPlace ?? null,
      heightCm: archive.heightCm ?? null,
      weightKg: archive.weightKg ?? null,
      school: archive.school ?? null,
      university: archive.university ?? null,
      relatives: archive.relatives ?? null,
      positions: positions ?? null,
      imageUrl: archive.imageUrl ?? null,
      bioSummary: archive.bioSummary ?? null,
      wikipediaUrl: archive.wikipediaUrl,
      wikidataId: archive.wikidataId ?? null,
      archiveSyncedAt: new Date(),
      positionName: positionName ?? null,
      clubName: inferredCurrentClub ?? archive.currentTeam ?? null,
      clubTeamId,
      countryName: archiveNationality,
      internationalTeamId,
      sourceProvider: "wikipedia" as const,
    };
    fieldsUpdated.push(
      "fullName",
      "birthDate",
      "birthPlace",
      "heightCm",
      "weightKg",
      "wikipediaUrl",
      "wikidataId",
    );
  }

  const resolvedCountry =
    typeof patch.countryName === "string" && patch.countryName.trim()
      ? patch.countryName.trim()
      : null;
  if (isPlaceholderNationCode(player.nationCode) || !player.nationCode?.trim()) {
    const nextCode = resolvedCountry ? teamCodeFromName(resolvedCountry) : null;
    if (nextCode !== (player.nationCode ?? null)) {
      patch.nationCode = nextCode;
      fieldsUpdated.push("nationCode");
    }
  }

  if (socialMerge) {
    patch.socialAccounts = socialMerge.next;
    fieldsUpdated.push(...socialMerge.updatedKeys.map((k) => `social.${k}`));
  }

  const [updated] = await db.update(players).set(patch).where(eq(players.id, playerId)).returning();
  if (upsertCareer) {
    await upsertPlayerCareerStints(updated.id, archive, archive.wikipediaUrl);
  }
  if ((archive.honours?.length ?? 0) > 0 && !fillMissingOnly) {
    const { importWikipediaPlayerHonours } = await import("./player-wikipedia-honours-import");
    const honoursResult = await importWikipediaPlayerHonours(updated.id, archive);
    if (honoursResult.upserted > 0) fieldsUpdated.push(`honours:${honoursResult.upserted}`);
  }
  const { repairPlayerProfileFromSquads } = await import("./player-profile-fields");
  await repairPlayerProfileFromSquads(playerId);
  return { entityId: updated.id, slug: updated.slug, fieldsUpdated: [...new Set(fieldsUpdated)] };
}

function normalizeWikipediaPlayerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (!/(^|\.)wikipedia\.org$/i.test(url.hostname)) return null;
    if (!url.pathname.includes("/wiki/")) return null;
    return url.toString();
  } catch {
    // Allow bare article titles (e.g. Antoine_Dupont) as lookup candidates.
    if (/^[A-Za-z0-9][\w .%'()-]{1,200}$/.test(trimmed)) return trimmed;
    return null;
  }
}

/** Look up Wikipedia by pasted/stored URL (preferred) or name and merge into an existing player only. */
export async function enrichPlayerFromWikipedia(
  playerId: string,
  playerName?: string,
  options?: { fillMissingOnly?: boolean; sourceUrl?: string },
): Promise<PlayerArchiveEnrichResult> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) {
    return { enriched: false, playerId, reason: "player_not_found" };
  }

  const fillMissingOnly = Boolean(options?.fillMissingOnly);
  const name = (playerName ?? player.name).trim();
  if (!name || name.length < 3) {
    return { enriched: false, playerId, reason: "name_too_short" };
  }

  const explicitSource =
    options?.sourceUrl != null ? normalizeWikipediaPlayerUrl(options.sourceUrl) : null;
  if (options?.sourceUrl?.trim() && !explicitSource) {
    return { enriched: false, playerId, reason: "invalid_wikipedia_url" };
  }

  // Persist pasted URL even before a successful archive pull — lets editors verify identity
  // against RugbyPass and re-test players with missing/broken wiki pages.
  if (explicitSource && explicitSource.includes("wikipedia.org") && explicitSource !== player.wikipediaUrl) {
    await db
      .update(players)
      .set({ wikipediaUrl: explicitSource })
      .where(eq(players.id, playerId));
  }

  const accessToken = await getWikimediaEnterpriseAccessToken();
  const candidates: string[] = [];
  if (explicitSource) candidates.push(explicitSource);
  if (player.wikipediaUrl?.trim() && !candidates.includes(player.wikipediaUrl.trim())) {
    candidates.push(player.wikipediaUrl.trim());
  }
  // When an editor pasted a specific article URL, only try that page (identity check).
  if (!explicitSource) {
    candidates.push(
      ...prioritizePlayerArticleTitles(
        await findWikipediaPlayerArticleTitles(name, await resolveWikipediaRequestOptions()),
        name,
      ).filter((title) => !candidates.includes(title)),
    );
  }

  let nameMismatchUrl: string | undefined;
  let nameMismatchArchiveName: string | undefined;

  for (const title of candidates) {
    try {
      const parsedRaw = await parseWikipediaArchive({
        articleTitleOrUrl: title,
        entityType: "player",
        accessToken,
      });

      if (parsedRaw.entityType !== "player") continue;
      if (!namesLikelyMatch(name, parsedRaw.name)) {
        if (explicitSource) {
          nameMismatchUrl = parsedRaw.wikipediaUrl;
          nameMismatchArchiveName = parsedRaw.name;
        }
        continue;
      }

      const parsed = await attachWikidataProfile(parsedRaw);
      const applied = await applyWikipediaPlayerArchive(playerId, parsed, {
        mergeLiveFields: true,
        fillMissingOnly,
        upsertCareer: !fillMissingOnly,
      });
      const careerStints =
        (parsed.clubCareer?.length ?? 0) +
        (parsed.cupCareer?.length ?? 0) +
        (parsed.internationalCareer?.length ?? 0);

      return {
        enriched: applied.fieldsUpdated.length > 0 || !fillMissingOnly,
        playerId,
        wikipediaUrl: parsed.wikipediaUrl,
        careerStints: fillMissingOnly ? undefined : careerStints,
        fieldsUpdated: applied.fieldsUpdated,
        reason:
          applied.fieldsUpdated.length === 0
            ? "matched_no_new_data"
            : undefined,
      };
    } catch {
      continue;
    }
  }

  if (nameMismatchUrl) {
    return {
      enriched: false,
      playerId,
      wikipediaUrl: nameMismatchUrl,
      reason: `name_mismatch:${nameMismatchArchiveName ?? "unknown"}`,
    };
  }

  return {
    enriched: false,
    playerId,
    wikipediaUrl: explicitSource?.includes("wikipedia.org") ? explicitSource : player.wikipediaUrl ?? undefined,
    reason: "no_matching_wikipedia_article",
  };
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
          university: archive.university ?? null,
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
