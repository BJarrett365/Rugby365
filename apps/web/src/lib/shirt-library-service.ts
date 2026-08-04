/**
 * Shirt Library — master approval centre for pitch kit graphics.
 * Public consumers must use resolveApprovedTeamShirt() only.
 */
import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  competitionShirtRequirements,
  fixtures,
  standingRows,
  teamCrests,
  teamShirtReferences,
  teamShirtReviews,
  teamShirts,
  teamShirtVersions,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { listSeasonScopedTeams } from "./season-scoped-picker-service";

async function currentCrestIdForTeam(teamId: string): Promise<string | null> {
  const db = getDb();
  const [crest] = await db
    .select({ id: teamCrests.id })
    .from(teamCrests)
    .where(
      and(
        eq(teamCrests.teamId, teamId),
        eq(teamCrests.isCurrent, true),
        ne(teamCrests.status, "ARCHIVED"),
      ),
    )
    .limit(1);
  return crest?.id ?? null;
}
import {
  checkShirtColourClash,
  pickReadableNumberColour,
  teamSetStatus,
} from "./shirt-library-math";
import { AUTUMN_NATIONS_SHIRT_SEEDS } from "./shirt-library-autumn-nations-seed";
import {
  CURRIE_CUP_2026_GUIDE_REF,
  CURRIE_CUP_SHIRT_SEEDS,
} from "./shirt-library-currie-cup-seed";
import { NATIONS_CHAMPIONSHIP_SHIRT_SEEDS } from "./shirt-library-nations-seed";
import { PREMIERSHIP_SHIRT_SEEDS } from "./shirt-library-premiership-seed";
import { SA_PROVINCIAL_SHIRT_SEEDS } from "./shirt-library-sa-provincial-seed";
import { MLR_SHIRT_SEEDS } from "./shirt-library-mlr-seed";
import { ALL_IRELAND_LEAGUE_SHIRT_SEEDS } from "./shirt-library-all-ireland-league-seed";
import { CHAMPIONS_CUP_SHIRT_SEEDS } from "./shirt-library-champions-cup-seed";
import { SCOTTISH_PREMIERSHIP_SHIRT_SEEDS } from "./shirt-library-scottish-premiership-seed";
import { SERIE_A_ELITE_SHIRT_SEEDS } from "./shirt-library-serie-a-elite-seed";
import { SUPER_RUGBY_PACIFIC_SHIRT_SEEDS } from "./shirt-library-super-rugby-seed";
import { SUPER_RYGBI_CYMRU_SHIRT_SEEDS } from "./shirt-library-super-rygbi-cymru-seed";
import { TOP14_SHIRT_SEEDS } from "./shirt-library-top14-seed";
import { URC_SHIRT_SEEDS } from "./shirt-library-urc-seed";
import { NZ_NPC_SHIRT_SEEDS } from "./shirt-library-npc-seed";
import type {
  ResolvedTeamShirt,
  ShirtKitType,
  ShirtSelectionMethod,
  ShirtStatus,
  ShirtSvgConfig,
  TeamShirtSetStatus,
} from "./shirt-library-types";
import { shirtConfigFromVersion } from "./shirt-svg-config";

const PUBLIC_OK: ShirtStatus = "APPROVED";

function fallbackSvg(teamName?: string | null): ShirtSvgConfig {
  // Deterministic plain fallback — never pretends to be approved.
  let hash = 0;
  const key = (teamName ?? "team").toLowerCase();
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const palette = ["#1b4d3e", "#1a237e", "#b71c1c", "#37474f", "#4a148c", "#00695c"];
  const body = palette[hash % palette.length]!;
  return {
    bodyColour: body,
    secondaryColour: "#ffffff",
    sleeveColour: body,
    collarColour: "#111111",
    cuffColour: "#111111",
    sidePanelColour: null,
    patternType: "PLAIN",
    patternColour: null,
    patternSettings: {},
    numberColour: pickReadableNumberColour(body),
    numberBorderColour: "rgba(0,0,0,0.35)",
    crestEnabled: false,
  };
}

export async function listShirtLibraryCompetitions() {
  const db = getDb();
  return db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      competitionType: competitions.competitionType,
    })
    .from(competitions)
    .orderBy(asc(competitions.name));
}

export async function listShirtLibrarySeasons(competitionId: string) {
  const db = getDb();
  return db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      isActive: competitionSeasons.isActive,
      slug: competitionSeasons.slug,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId))
    .orderBy(desc(competitionSeasons.year), desc(competitionSeasons.label));
}

export async function listShirtLibraryTeams(competitionId: string, seasonId: string) {
  const scoped = await listSeasonScopedTeams({ competitionId, seasonId });
  const db = getDb();
  const ids = scoped.teams.map((t) => t.id);
  const logos =
    ids.length === 0
      ? []
      : await db
          .select({ id: teams.id, imageUrl: teams.imageUrl })
          .from(teams)
          .where(inArray(teams.id, ids));
  const logoMap = new Map(logos.map((r) => [r.id, r.imageUrl]));
  return scoped.teams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    shortName: t.shortName,
    countryName: t.countryName,
    imageUrl: logoMap.get(t.id) ?? null,
  }));
}

export async function getOrCreateShirtRequirements(competitionId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(competitionShirtRequirements)
    .where(eq(competitionShirtRequirements.competitionId, competitionId))
    .limit(1);
  if (existing) return existing;

  const [inserted] = await db
    .insert(competitionShirtRequirements)
    .values({
      competitionId,
      homeRequired: true,
      awayRequired: true,
      thirdRequired: false,
    })
    .returning();
  return inserted ?? {
    id: "",
    competitionId,
    homeRequired: true,
    awayRequired: true,
    thirdRequired: false,
    updatedAt: new Date(),
  };
}

export async function listShirtsForTeamSeason(input: {
  teamId: string;
  competitionId: string;
  seasonId: string;
}) {
  const db = getDb();
  const shirts = await db
    .select()
    .from(teamShirts)
    .where(
      and(
        eq(teamShirts.teamId, input.teamId),
        eq(teamShirts.competitionId, input.competitionId),
        eq(teamShirts.seasonId, input.seasonId),
        ne(teamShirts.status, "ARCHIVED"),
      ),
    )
    .orderBy(asc(teamShirts.kitType));

  const shirtIds = shirts.map((s) => s.id);
  const versions =
    shirtIds.length === 0
      ? []
      : await db
          .select()
          .from(teamShirtVersions)
          .where(inArray(teamShirtVersions.shirtId, shirtIds))
          .orderBy(desc(teamShirtVersions.versionNumber));

  const refs =
    shirtIds.length === 0
      ? []
      : await db
          .select()
          .from(teamShirtReferences)
          .where(inArray(teamShirtReferences.shirtId, shirtIds));

  const reviews =
    shirtIds.length === 0
      ? []
      : await db
          .select()
          .from(teamShirtReviews)
          .where(inArray(teamShirtReviews.shirtId, shirtIds))
          .orderBy(desc(teamShirtReviews.createdAt));

  return shirts.map((shirt) => {
    const shirtVersions = versions.filter((v) => v.shirtId === shirt.id);
    const latest = shirtVersions[0] ?? null;
    const approved =
      shirtVersions.find((v) => v.id === shirt.approvedVersionId) ??
      shirtVersions.find((v) => v.status === "APPROVED") ??
      null;
    const display = approved ?? latest;
    return {
      shirt,
      latestVersion: latest,
      approvedVersion: approved,
      displayVersion: display,
      svgConfig: display ? shirtConfigFromVersion(display) : null,
      references: refs.filter((r) => r.shirtId === shirt.id),
      reviews: reviews.filter((r) => r.shirtId === shirt.id),
    };
  });
}

export async function getShirtDetail(shirtId: string) {
  const db = getDb();
  const [shirt] = await db.select().from(teamShirts).where(eq(teamShirts.id, shirtId)).limit(1);
  if (!shirt) return null;

  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      imageUrl: teams.imageUrl,
      countryName: teams.countryName,
    })
    .from(teams)
    .where(eq(teams.id, shirt.teamId))
    .limit(1);
  const [competition] = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
    .from(competitions)
    .where(eq(competitions.id, shirt.competitionId))
    .limit(1);
  const [season] = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, shirt.seasonId))
    .limit(1);

  const versions = await db
    .select()
    .from(teamShirtVersions)
    .where(eq(teamShirtVersions.shirtId, shirtId))
    .orderBy(desc(teamShirtVersions.versionNumber));
  const reviews = await db
    .select()
    .from(teamShirtReviews)
    .where(eq(teamShirtReviews.shirtId, shirtId))
    .orderBy(desc(teamShirtReviews.createdAt));
  const references = await db
    .select()
    .from(teamShirtReferences)
    .where(eq(teamShirtReferences.shirtId, shirtId))
    .orderBy(desc(teamShirtReferences.createdAt));

  const latest = versions[0] ?? null;
  const approved = versions.find((v) => v.id === shirt.approvedVersionId) ?? null;

  return {
    shirt,
    team,
    competition,
    season,
    versions,
    reviews,
    references,
    latestVersion: latest,
    approvedVersion: approved,
    displayVersion: approved ?? latest,
    svgConfig: (approved ?? latest) ? shirtConfigFromVersion(approved ?? latest!) : null,
  };
}

type VersionInput = {
  bodyColour: string;
  secondaryColour?: string | null;
  sleeveColour?: string | null;
  collarColour?: string | null;
  cuffColour?: string | null;
  sidePanelColour?: string | null;
  patternType?: string;
  patternColour?: string | null;
  patternSettings?: Record<string, unknown>;
  numberColour?: string;
  numberBorderColour?: string | null;
  crestEnabled?: boolean;
};

export async function createShirtDraft(input: {
  teamId: string;
  competitionId: string;
  seasonId: string;
  kitType: ShirtKitType | string;
  name?: string;
  createdBy?: string;
  version: VersionInput;
}) {
  const db = getDb();
  const [team] = await db
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, input.teamId))
    .limit(1);

  const crestId = await currentCrestIdForTeam(input.teamId);

  const [shirt] = await db
    .insert(teamShirts)
    .values({
      teamId: input.teamId,
      competitionId: input.competitionId,
      seasonId: input.seasonId,
      kitType: String(input.kitType).toUpperCase(),
      name: input.name ?? `${team?.name ?? "Team"} ${String(input.kitType).toUpperCase()}`,
      status: "DRAFT",
      isCurrent: true,
      crestId,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    })
    .returning();

  const [version] = await db
    .insert(teamShirtVersions)
    .values({
      shirtId: shirt!.id,
      versionNumber: 1,
      status: "DRAFT",
      bodyColour: input.version.bodyColour,
      secondaryColour: input.version.secondaryColour ?? null,
      sleeveColour: input.version.sleeveColour ?? null,
      collarColour: input.version.collarColour ?? null,
      cuffColour: input.version.cuffColour ?? null,
      sidePanelColour: input.version.sidePanelColour ?? null,
      patternType: input.version.patternType ?? "PLAIN",
      patternColour: input.version.patternColour ?? null,
      patternSettings: input.version.patternSettings ?? {},
      numberColour: input.version.numberColour ?? pickReadableNumberColour(input.version.bodyColour),
      numberBorderColour: input.version.numberBorderColour ?? null,
      crestEnabled: input.version.crestEnabled !== false,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return { shirt: shirt!, version: version! };
}

export async function createShirtVersion(
  shirtId: string,
  version: VersionInput,
  createdBy?: string,
) {
  const db = getDb();
  const [shirt] = await db.select().from(teamShirts).where(eq(teamShirts.id, shirtId)).limit(1);
  if (!shirt) throw new Error("Shirt not found");
  if (shirt.status === "ARCHIVED") throw new Error("Cannot version an archived shirt");

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${teamShirtVersions.versionNumber}), 0)` })
    .from(teamShirtVersions)
    .where(eq(teamShirtVersions.shirtId, shirtId));

  const next = Number(max ?? 0) + 1;
  const [row] = await db
    .insert(teamShirtVersions)
    .values({
      shirtId,
      versionNumber: next,
      status: "DRAFT",
      bodyColour: version.bodyColour,
      secondaryColour: version.secondaryColour ?? null,
      sleeveColour: version.sleeveColour ?? null,
      collarColour: version.collarColour ?? null,
      cuffColour: version.cuffColour ?? null,
      sidePanelColour: version.sidePanelColour ?? null,
      patternType: version.patternType ?? "PLAIN",
      patternColour: version.patternColour ?? null,
      patternSettings: version.patternSettings ?? {},
      numberColour: version.numberColour ?? pickReadableNumberColour(version.bodyColour),
      numberBorderColour: version.numberBorderColour ?? null,
      crestEnabled: version.crestEnabled !== false,
      createdBy: createdBy ?? null,
    })
    .returning();

  // Keep live approved version; move shirt back to draft/review for the new version.
  if (shirt.status === "APPROVED") {
    await db
      .update(teamShirts)
      .set({
        status: "DRAFT",
        approvedForPitchUse: true, // previous approved version still live via approvedVersionId
        updatedBy: createdBy ?? null,
        updatedAt: new Date(),
      })
      .where(eq(teamShirts.id, shirtId));
  } else {
    await db
      .update(teamShirts)
      .set({ status: "DRAFT", updatedBy: createdBy ?? null, updatedAt: new Date() })
      .where(eq(teamShirts.id, shirtId));
  }

  return row!;
}

export async function updateDraftShirtVersion(
  versionId: string,
  patch: VersionInput,
  updatedBy?: string,
) {
  const db = getDb();
  const [version] = await db
    .select()
    .from(teamShirtVersions)
    .where(eq(teamShirtVersions.id, versionId))
    .limit(1);
  if (!version) throw new Error("Version not found");
  if (version.status === "APPROVED") {
    throw new Error("Never edit an approved version — create a new version instead");
  }

  const [updated] = await db
    .update(teamShirtVersions)
    .set({
      bodyColour: patch.bodyColour,
      secondaryColour: patch.secondaryColour ?? null,
      sleeveColour: patch.sleeveColour ?? null,
      collarColour: patch.collarColour ?? null,
      cuffColour: patch.cuffColour ?? null,
      sidePanelColour: patch.sidePanelColour ?? null,
      patternType: patch.patternType ?? version.patternType,
      patternColour: patch.patternColour ?? null,
      patternSettings: patch.patternSettings ?? version.patternSettings,
      numberColour: patch.numberColour ?? version.numberColour,
      numberBorderColour: patch.numberBorderColour ?? null,
      crestEnabled: patch.crestEnabled !== false,
    })
    .where(eq(teamShirtVersions.id, versionId))
    .returning();

  await db
    .update(teamShirts)
    .set({ updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .where(eq(teamShirts.id, version.shirtId));

  return updated!;
}

async function writeReview(
  shirtId: string,
  versionId: string | null,
  status: string,
  notes: string | null,
  reviewedBy?: string,
) {
  const db = getDb();
  await db.insert(teamShirtReviews).values({
    shirtId,
    versionId,
    status,
    reviewNotes: notes,
    reviewedBy: reviewedBy ?? null,
  });
}

export async function submitShirtForReview(shirtId: string, submittedBy?: string) {
  const db = getDb();
  const detail = await getShirtDetail(shirtId);
  if (!detail) throw new Error("Shirt not found");
  const version = detail.latestVersion;
  if (!version) throw new Error("No version to submit");

  await db
    .update(teamShirtVersions)
    .set({ status: "AWAITING_REVIEW" })
    .where(eq(teamShirtVersions.id, version.id));
  await db
    .update(teamShirts)
    .set({
      status: "AWAITING_REVIEW",
      updatedBy: submittedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamShirts.id, shirtId));
  await writeReview(shirtId, version.id, "AWAITING_REVIEW", "Submitted for review", submittedBy);
}

export async function approveShirtVersion(
  shirtId: string,
  options?: { versionId?: string; reviewedBy?: string; notes?: string },
) {
  const db = getDb();
  const detail = await getShirtDetail(shirtId);
  if (!detail) throw new Error("Shirt not found");
  const version =
    detail.versions.find((v) => v.id === options?.versionId) ?? detail.latestVersion;
  if (!version) throw new Error("No version to approve");

  await db
    .update(teamShirtVersions)
    .set({ status: "APPROVED" })
    .where(eq(teamShirtVersions.id, version.id));

  await db
    .update(teamShirts)
    .set({
      status: "APPROVED",
      approvedVersionId: version.id,
      approvedForPitchUse: true,
      useOnLineups: true,
      useOnTeamOfWeek: true,
      useOnMatchAnimations: true,
      useOnSocialGraphics: true,
      useOnBettingGraphics: true,
      approvedBy: options?.reviewedBy ?? null,
      approvedAt: new Date(),
      updatedBy: options?.reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamShirts.id, shirtId));

  await writeReview(
    shirtId,
    version.id,
    "APPROVED",
    options?.notes ?? "Approved for pitch use",
    options?.reviewedBy,
  );
}

export async function requestShirtChanges(
  shirtId: string,
  notes: string,
  reviewedBy?: string,
  versionId?: string,
) {
  if (!notes.trim()) throw new Error("Review note is required when requesting changes");
  const db = getDb();
  const detail = await getShirtDetail(shirtId);
  if (!detail) throw new Error("Shirt not found");
  const version =
    detail.versions.find((v) => v.id === versionId) ?? detail.latestVersion;

  if (version) {
    await db
      .update(teamShirtVersions)
      .set({ status: "CHANGES_REQUIRED" })
      .where(eq(teamShirtVersions.id, version.id));
  }
  await db
    .update(teamShirts)
    .set({
      status: "CHANGES_REQUIRED",
      updatedBy: reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamShirts.id, shirtId));
  await writeReview(shirtId, version?.id ?? null, "CHANGES_REQUIRED", notes, reviewedBy);
}

export async function rejectShirtVersion(
  shirtId: string,
  notes: string,
  reviewedBy?: string,
  versionId?: string,
) {
  if (!notes.trim()) throw new Error("Review note is required when rejecting a shirt");
  const db = getDb();
  const detail = await getShirtDetail(shirtId);
  if (!detail) throw new Error("Shirt not found");
  const version =
    detail.versions.find((v) => v.id === versionId) ?? detail.latestVersion;

  if (version) {
    await db
      .update(teamShirtVersions)
      .set({ status: "REJECTED" })
      .where(eq(teamShirtVersions.id, version.id));
  }
  await db
    .update(teamShirts)
    .set({
      status: "REJECTED",
      approvedForPitchUse: false,
      updatedBy: reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamShirts.id, shirtId));
  await writeReview(shirtId, version?.id ?? null, "REJECTED", notes, reviewedBy);
}

export async function archiveShirt(shirtId: string, reviewedBy?: string) {
  const db = getDb();
  await db
    .update(teamShirts)
    .set({
      status: "ARCHIVED",
      isCurrent: false,
      isHistoric: true,
      approvedForPitchUse: false,
      updatedBy: reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamShirts.id, shirtId));
  await writeReview(shirtId, null, "ARCHIVED", "Archived", reviewedBy);
}

export async function updateShirtUsageFlags(
  shirtId: string,
  flags: Partial<{
    useOnLineups: boolean;
    useOnTeamOfWeek: boolean;
    useOnMatchAnimations: boolean;
    useOnSocialGraphics: boolean;
    useOnBettingGraphics: boolean;
  }>,
  updatedBy?: string,
) {
  const db = getDb();
  const [shirt] = await db.select().from(teamShirts).where(eq(teamShirts.id, shirtId)).limit(1);
  if (!shirt) throw new Error("Shirt not found");
  if (shirt.status !== "APPROVED") {
    throw new Error("Usage flags can only be changed on approved shirts");
  }
  await db
    .update(teamShirts)
    .set({ ...flags, updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .where(eq(teamShirts.id, shirtId));
}

export async function getApprovedShirt(input: {
  teamId: string;
  seasonId?: string | null;
  competitionId?: string | null;
  kitType?: ShirtKitType | string;
}) {
  const db = getDb();
  const kit = String(input.kitType ?? "HOME").toUpperCase();
  const conditions = [
    eq(teamShirts.teamId, input.teamId),
    eq(teamShirts.status, PUBLIC_OK),
    eq(teamShirts.approvedForPitchUse, true),
    eq(teamShirts.kitType, kit),
  ];
  if (input.seasonId) conditions.push(eq(teamShirts.seasonId, input.seasonId));
  if (input.competitionId) conditions.push(eq(teamShirts.competitionId, input.competitionId));

  const [row] = await db
    .select()
    .from(teamShirts)
    .where(and(...conditions))
    .orderBy(desc(teamShirts.approvedAt))
    .limit(1);

  if (!row?.approvedVersionId) return null;
  const [version] = await db
    .select()
    .from(teamShirtVersions)
    .where(eq(teamShirtVersions.id, row.approvedVersionId))
    .limit(1);
  if (!version) return null;
  return { shirt: row, version, svgConfig: shirtConfigFromVersion(version) };
}

export async function getApprovedShirtsForTeam(teamId: string, seasonId?: string) {
  const db = getDb();
  const conditions = [
    eq(teamShirts.teamId, teamId),
    eq(teamShirts.status, PUBLIC_OK),
    eq(teamShirts.approvedForPitchUse, true),
  ];
  if (seasonId) conditions.push(eq(teamShirts.seasonId, seasonId));

  const shirts = await db
    .select()
    .from(teamShirts)
    .where(and(...conditions))
    .orderBy(asc(teamShirts.kitType));

  const versionIds = shirts
    .map((s) => s.approvedVersionId)
    .filter((id): id is string => Boolean(id));
  const versions =
    versionIds.length === 0
      ? []
      : await db
          .select()
          .from(teamShirtVersions)
          .where(inArray(teamShirtVersions.id, versionIds));

  return shirts.map((shirt) => {
    const version = versions.find((v) => v.id === shirt.approvedVersionId) ?? null;
    return {
      shirt,
      version,
      svgConfig: version ? shirtConfigFromVersion(version) : null,
    };
  });
}

/**
 * Central public resolver — never returns draft / awaiting-review kits.
 */
export async function resolveApprovedTeamShirt(input: {
  teamId: string;
  competitionId?: string | null;
  seasonId?: string | null;
  matchId?: string | null;
  kitType?: ShirtKitType | string | null;
  teamName?: string | null;
}): Promise<ResolvedTeamShirt> {
  const db = getDb();
  let kitType = String(input.kitType ?? "HOME").toUpperCase();
  let method: ShirtSelectionMethod = "DEFAULT_HOME";

  if (input.matchId) {
    const [fix] = await db
      .select({
        homeTeamId: fixtures.homeTeamId,
        awayTeamId: fixtures.awayTeamId,
        homeTeamKitId: fixtures.homeTeamKitId,
        awayTeamKitId: fixtures.awayTeamKitId,
      })
      .from(fixtures)
      .where(eq(fixtures.id, input.matchId))
      .limit(1);

    if (fix) {
      const kitId =
        fix.homeTeamId === input.teamId
          ? fix.homeTeamKitId
          : fix.awayTeamId === input.teamId
            ? fix.awayTeamKitId
            : null;
      if (kitId) {
        const [shirt] = await db
          .select()
          .from(teamShirts)
          .where(
            and(
              eq(teamShirts.id, kitId),
              eq(teamShirts.status, PUBLIC_OK),
              eq(teamShirts.approvedForPitchUse, true),
            ),
          )
          .limit(1);
        if (shirt?.approvedVersionId) {
          const [version] = await db
            .select()
            .from(teamShirtVersions)
            .where(eq(teamShirtVersions.id, shirt.approvedVersionId))
            .limit(1);
          if (version) {
            return {
              shirtId: shirt.id,
              versionId: version.id,
              kitType: shirt.kitType,
              svgConfig: shirtConfigFromVersion(version),
              approvalStatus: "APPROVED",
              selectionMethod: "MATCH_DATA",
              isFallback: false,
              teamName: input.teamName,
            };
          }
        }
      }
    }
  }

  let approved = await getApprovedShirt({
    teamId: input.teamId,
    seasonId: input.seasonId,
    competitionId: input.competitionId,
    kitType,
  });

  if (!approved && kitType !== "HOME") {
    approved = await getApprovedShirt({
      teamId: input.teamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      kitType: "HOME",
    });
    method = "DEFAULT_HOME";
    kitType = "HOME";
  }

  if (!approved) {
    // Most recent approved for team (any season).
    const [any] = await db
      .select()
      .from(teamShirts)
      .where(
        and(
          eq(teamShirts.teamId, input.teamId),
          eq(teamShirts.status, PUBLIC_OK),
          eq(teamShirts.approvedForPitchUse, true),
        ),
      )
      .orderBy(desc(teamShirts.approvedAt))
      .limit(1);
    if (any?.approvedVersionId) {
      const [version] = await db
        .select()
        .from(teamShirtVersions)
        .where(eq(teamShirtVersions.id, any.approvedVersionId))
        .limit(1);
      if (version) {
        return {
          shirtId: any.id,
          versionId: version.id,
          kitType: any.kitType,
          svgConfig: shirtConfigFromVersion(version),
          approvalStatus: "APPROVED",
          selectionMethod: "DEFAULT_HOME",
          isFallback: false,
          teamName: input.teamName,
        };
      }
    }
  }

  if (approved) {
    return {
      shirtId: approved.shirt.id,
      versionId: approved.version.id,
      kitType: approved.shirt.kitType,
      svgConfig: approved.svgConfig,
      approvalStatus: "APPROVED",
      selectionMethod: method,
      isFallback: false,
      teamName: input.teamName,
    };
  }

  return {
    shirtId: null,
    versionId: null,
    kitType,
    svgConfig: fallbackSvg(input.teamName),
    approvalStatus: "FALLBACK",
    selectionMethod: "FALLBACK",
    isFallback: true,
    teamName: input.teamName,
  };
}

export async function resolveTeamOfWeekShirt(input: {
  teamId: string;
  competitionId: string;
  seasonId: string;
  fixtureId?: string | null;
  kitTypeOverride?: ShirtKitType | string | null;
  teamName?: string | null;
}): Promise<ResolvedTeamShirt> {
  if (input.kitTypeOverride) {
    const approved = await getApprovedShirt({
      teamId: input.teamId,
      seasonId: input.seasonId,
      competitionId: input.competitionId,
      kitType: input.kitTypeOverride,
    });
    if (approved) {
      return {
        shirtId: approved.shirt.id,
        versionId: approved.version.id,
        kitType: approved.shirt.kitType,
        svgConfig: approved.svgConfig,
        approvalStatus: "APPROVED",
        selectionMethod: "ADMIN_OVERRIDE",
        isFallback: false,
        teamName: input.teamName,
      };
    }
  }
  return resolveApprovedTeamShirt({
    teamId: input.teamId,
    competitionId: input.competitionId,
    seasonId: input.seasonId,
    matchId: input.fixtureId,
    kitType: "HOME",
    teamName: input.teamName,
  });
}

export async function getCompetitionShirtStatus(competitionId: string, seasonId: string) {
  const [requirements, teamList, shirts] = await Promise.all([
    getOrCreateShirtRequirements(competitionId),
    listShirtLibraryTeams(competitionId, seasonId),
    getDb()
      .select()
      .from(teamShirts)
      .where(
        and(
          eq(teamShirts.competitionId, competitionId),
          eq(teamShirts.seasonId, seasonId),
          ne(teamShirts.status, "ARCHIVED"),
        ),
      ),
  ]);

  const byTeam = new Map<string, typeof shirts>();
  for (const s of shirts) {
    const list = byTeam.get(s.teamId) ?? [];
    list.push(s);
    byTeam.set(s.teamId, list);
  }

  const rows = teamList.map((team) => {
    const teamShirtsList = byTeam.get(team.id) ?? [];
    const statusFor = (kit: string) =>
      teamShirtsList.find((s) => s.kitType === kit)?.status ?? "NOT_CREATED";
    const home = statusFor("HOME");
    const away = statusFor("AWAY");
    const third = statusFor("THIRD");
    const overall: TeamShirtSetStatus = teamSetStatus({
      homeStatus: home,
      awayStatus: away,
      homeRequired: requirements.homeRequired,
      awayRequired: requirements.awayRequired,
    });
    return {
      team,
      home,
      away,
      third,
      overall,
      shirts: teamShirtsList,
    };
  });

  const fully = rows.filter((r) => r.overall === "Fully Approved").length;
  const homeApproved = rows.filter((r) => r.home === "APPROVED").length;
  const awayApproved = rows.filter((r) => r.away === "APPROVED").length;
  const awaiting = shirts.filter((s) => s.status === "AWAITING_REVIEW").length;
  const total = rows.length || 1;

  return {
    requirements,
    teams: rows,
    summary: {
      teamCount: rows.length,
      fullyApproved: fully,
      partlyApproved: rows.filter((r) => r.overall === "Partly Approved").length,
      notStarted: rows.filter((r) => r.overall === "Not Started").length,
      homeApproved,
      awayApproved,
      awaitingReview: awaiting,
      readinessPct: Math.round((fully / total) * 100),
    },
  };
}

export async function listAwaitingReviewShirts(competitionId?: string, seasonId?: string) {
  const db = getDb();
  const conditions = [eq(teamShirts.status, "AWAITING_REVIEW")];
  if (competitionId) conditions.push(eq(teamShirts.competitionId, competitionId));
  if (seasonId) conditions.push(eq(teamShirts.seasonId, seasonId));

  return db
    .select({
      shirt: teamShirts,
      teamName: teams.name,
      teamImageUrl: teams.imageUrl,
    })
    .from(teamShirts)
    .innerJoin(teams, eq(teamShirts.teamId, teams.id))
    .where(and(...conditions))
    .orderBy(asc(teams.name), asc(teamShirts.kitType));
}

export async function addShirtReference(input: {
  shirtId: string;
  imageUrl: string;
  imageType?: string;
  sourceUrl?: string;
  sourceName?: string;
  notes?: string;
  seasonLabel?: string;
  uploadedBy?: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(teamShirtReferences)
    .values({
      shirtId: input.shirtId,
      imageUrl: input.imageUrl,
      imageType: input.imageType ?? "front",
      sourceUrl: input.sourceUrl ?? null,
      sourceName: input.sourceName ?? null,
      notes: input.notes ?? null,
      seasonLabel: input.seasonLabel ?? null,
      uploadedBy: input.uploadedBy ?? null,
    })
    .returning();
  return row!;
}

/**
 * Seed Nations Championship home/away drafts (never auto-approved).
 * Seeds every competition whose name/slug matches Nations Championship
 * (there can be more than one row in CMS).
 */
export async function seedNationsChampionshipShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const targetComps = comps.filter(
    (c) =>
      c.slug.includes("nations-championship") ||
      c.name.toLowerCase().includes("nations championship"),
  );
  if (!targetComps.length) {
    return { ok: false as const, error: "Nations Championship competition not found", created: 0 };
  }

  let created = 0;
  const missing = new Set<string>();
  const seeded: Array<{ competitionId: string; seasonId: string; created: number }> = [];
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  for (const competition of targetComps) {
    const seasons = await listShirtLibrarySeasons(competition.id);
    const season = seasons.find((s) => s.isActive) ?? seasons[0];
    if (!season) continue;

    await getOrCreateShirtRequirements(competition.id);
    const teamList = await listShirtLibraryTeams(competition.id, season.id);
    let compCreated = 0;

    for (const seed of NATIONS_CHAMPIONSHIP_SHIRT_SEEDS) {
      const team =
        teamList.find((t) =>
          seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase()),
        ) ??
        allTeams.find((t) =>
          seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase()),
        );

      if (!team) {
        missing.add(seed.teamNames[0]!);
        continue;
      }

      for (const kit of seed.kits) {
        const [existing] = await db
          .select({ id: teamShirts.id })
          .from(teamShirts)
          .where(
            and(
              eq(teamShirts.teamId, team.id),
              eq(teamShirts.competitionId, competition.id),
              eq(teamShirts.seasonId, season.id),
              eq(teamShirts.kitType, kit.kitType),
              ne(teamShirts.status, "ARCHIVED"),
            ),
          )
          .limit(1);
        if (existing) continue;

        await createShirtDraft({
          teamId: team.id,
          competitionId: competition.id,
          seasonId: season.id,
          kitType: kit.kitType,
          createdBy,
          version: {
            bodyColour: kit.bodyColour,
            secondaryColour: kit.secondaryColour,
            sleeveColour: kit.sleeveColour ?? kit.bodyColour,
            collarColour: kit.collarColour ?? kit.bodyColour,
            cuffColour: kit.cuffColour ?? kit.bodyColour,
            sidePanelColour: kit.sidePanelColour ?? null,
            patternType: kit.patternType,
            patternColour: kit.patternColour ?? kit.secondaryColour,
            patternSettings: {
              fabricTexture: true,
              fabricTextureOpacity: 0.12,
              ...(kit.patternSettings ?? {}),
            },
            numberColour: kit.numberColour,
            crestEnabled: true,
          },
        });
        created += 1;
        compCreated += 1;
      }
    }

    seeded.push({ competitionId: competition.id, seasonId: season.id, created: compCreated });
  }

  const primary = seeded.sort((a, b) => b.created - a.created)[0];
  return {
    ok: true as const,
    competitionId: primary?.competitionId ?? targetComps[0]!.id,
    seasonId: primary?.seasonId ?? null,
    created,
    missing: [...missing],
    seeded,
  };
}

/**
 * Seed Currie Cup Premier Division home/away drafts from the Rugby365 shirt guide
 * (never auto-approved). Updates existing DRAFT shirts to match the latest guide.
 */
async function ensureShirtReference(input: {
  shirtId: string;
  imageUrl: string;
  imageType?: string;
  sourceName?: string;
  notes?: string;
  seasonLabel?: string;
  uploadedBy?: string;
}) {
  const db = getDb();
  const [existing] = await db
    .select({ id: teamShirtReferences.id })
    .from(teamShirtReferences)
    .where(
      and(
        eq(teamShirtReferences.shirtId, input.shirtId),
        eq(teamShirtReferences.imageUrl, input.imageUrl),
      ),
    )
    .limit(1);
  if (existing) return existing;
  return addShirtReference(input);
}

/**
 * Seed / refresh Currie Cup home/away kits for the active season.
 * Default: skip already-APPROVED shirts (safe draft seed).
 * forceUpdate: write a new version even when approved.
 * approve: approve latest version for pitch use after write.
 */
export async function seedCurrieCupShirtDrafts(
  createdBy = "system-seed",
  options?: { forceUpdate?: boolean; approve?: boolean },
) {
  const forceUpdate = options?.forceUpdate === true;
  const approve = options?.approve === true;
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug.includes("currie-cup")) ??
    comps.find((c) => c.name.toLowerCase().includes("currie cup"));
  if (!competition) {
    return { ok: false as const, error: "Currie Cup competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Currie Cup season found", created: 0 };
  }

  // First Division guide sides that may not exist yet in CMS.
  for (const missingTeam of [
    { slug: "border-bulldogs", name: "Border Bulldogs", shortName: "BOR" },
    { slug: "griffons", name: "Griffons", shortName: "GRI" },
  ]) {
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, missingTeam.slug))
      .limit(1);
    if (!existing) {
      await db.insert(teams).values({
        slug: missingTeam.slug,
        name: missingTeam.name,
        shortName: missingTeam.shortName,
        sourceProvider: "manual",
        countryName: "South Africa",
        hemisphere: "south",
        region: "africa",
        teamType: "club",
      });
    }
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  let updated = 0;
  let approved = 0;
  let crestsLinked = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of CURRIE_CUP_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const byId = new Map<string, { id: string; name: string }>();
    for (const t of teamList) if (matchName(t)) byId.set(t.id, t);
    for (const t of allTeams) if (matchName(t)) byId.set(t.id, t);
    const matchedTeams = [...byId.values()];

    if (matchedTeams.length === 0) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    for (const team of matchedTeams) {
      matched.push(team.name);
      const crestId = await currentCrestIdForTeam(team.id);

      for (const kit of seed.kits) {
        const versionInput = {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        };

        const [existing] = await db
          .select({
            id: teamShirts.id,
            status: teamShirts.status,
            crestId: teamShirts.crestId,
          })
          .from(teamShirts)
          .where(
            and(
              eq(teamShirts.teamId, team.id),
              eq(teamShirts.competitionId, competition.id),
              eq(teamShirts.seasonId, season.id),
              eq(teamShirts.kitType, kit.kitType),
              ne(teamShirts.status, "ARCHIVED"),
            ),
          )
          .limit(1);

        let shirtId: string;
        if (existing) {
          if (existing.status === "APPROVED" && !forceUpdate) continue;
          await createShirtVersion(existing.id, versionInput, createdBy);
          shirtId = existing.id;
          updated += 1;
          if (crestId && existing.crestId !== crestId) {
            await db
              .update(teamShirts)
              .set({ crestId, updatedAt: new Date() })
              .where(eq(teamShirts.id, shirtId));
            crestsLinked += 1;
          }
        } else {
          const { shirt } = await createShirtDraft({
            teamId: team.id,
            competitionId: competition.id,
            seasonId: season.id,
            kitType: kit.kitType,
            createdBy,
            version: versionInput,
          });
          shirtId = shirt.id;
          created += 1;
          if (crestId) crestsLinked += 1;
        }

        await ensureShirtReference({
          shirtId,
          imageUrl: CURRIE_CUP_2026_GUIDE_REF.imageUrl,
          imageType: CURRIE_CUP_2026_GUIDE_REF.imageType,
          sourceName: CURRIE_CUP_2026_GUIDE_REF.sourceName,
          notes: CURRIE_CUP_2026_GUIDE_REF.notes,
          seasonLabel: season.label,
          uploadedBy: createdBy,
        });

        for (const ref of seed.references ?? []) {
          if (ref.kitType && ref.kitType !== "ALL" && ref.kitType !== kit.kitType) continue;
          await ensureShirtReference({
            shirtId,
            imageUrl: ref.imageUrl,
            imageType: ref.imageType ?? "front",
            sourceName: ref.sourceName,
            notes: ref.notes,
            seasonLabel: season.label,
            uploadedBy: createdBy,
          });
        }

        if (approve) {
          await approveShirtVersion(shirtId, {
            reviewedBy: createdBy,
            notes: "Approved Currie Cup 2026 kit for current-season pitch use",
          });
          approved += 1;
        }
      }
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    updated,
    approved,
    crestsLinked,
    matched: [...new Set(matched)],
    missing,
  };
}

/** Force-refresh + approve Currie Cup kits on the active season from the 2026 seed. */
export async function updateCurrieCupShirtsForCurrentSeason(createdBy = "system-seed") {
  return seedCurrieCupShirtDrafts(createdBy, { forceUpdate: true, approve: true });
}

/**
 * Currie Cup convention: both sides wear HOME kits unless body colours clash,
 * in which case the away side switches to AWAY.
 */
export async function assignCurrieCupMatchKitsForRounds(roundNumbers: number[]): Promise<{
  ok: true;
  seasonId: string;
  updated: number;
  clashes: Array<{ fixtureId: string; home: string; away: string; distance: number | null }>;
  skipped: number;
}> {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug.includes("currie-cup")) ??
    comps.find((c) => c.name.toLowerCase().includes("currie cup"));
  if (!competition) throw new Error("Currie Cup competition not found");

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) throw new Error("No Currie Cup season found");

  const roundSet = new Set(roundNumbers.map((n) => String(n)));
  const allFixtures = await db
    .select()
    .from(fixtures)
    .where(
      and(eq(fixtures.competitionId, competition.id), eq(fixtures.seasonId, season.id)),
    );

  const teamNameById = new Map(
    (await db.select({ id: teams.id, name: teams.name }).from(teams)).map((t) => [
      t.id,
      t.name,
    ]),
  );

  const approvedShirts = await db
    .select({
      id: teamShirts.id,
      teamId: teamShirts.teamId,
      kitType: teamShirts.kitType,
      bodyColour: teamShirtVersions.bodyColour,
    })
    .from(teamShirts)
    .innerJoin(teamShirtVersions, eq(teamShirts.approvedVersionId, teamShirtVersions.id))
    .where(
      and(
        eq(teamShirts.competitionId, competition.id),
        eq(teamShirts.seasonId, season.id),
        eq(teamShirts.status, "APPROVED"),
        eq(teamShirts.approvedForPitchUse, true),
      ),
    );

  const shirtByTeamKit = new Map<string, { id: string; bodyColour: string }>();
  for (const row of approvedShirts) {
    shirtByTeamKit.set(`${row.teamId}:${row.kitType}`, {
      id: row.id,
      bodyColour: row.bodyColour,
    });
  }

  function roundMatches(round: string | null): boolean {
    if (!round) return false;
    const m = round.match(/(\d+)/);
    return Boolean(m && roundSet.has(m[1]!));
  }

  let updated = 0;
  let skipped = 0;
  const clashes: Array<{
    fixtureId: string;
    home: string;
    away: string;
    distance: number | null;
  }> = [];

  for (const fx of allFixtures) {
    if (!roundMatches(fx.round)) continue;
    if (!fx.homeTeamId || !fx.awayTeamId) {
      skipped += 1;
      continue;
    }

    const homeHome = shirtByTeamKit.get(`${fx.homeTeamId}:HOME`);
    const awayHome = shirtByTeamKit.get(`${fx.awayTeamId}:HOME`);
    const awayAway = shirtByTeamKit.get(`${fx.awayTeamId}:AWAY`);
    if (!homeHome || !awayHome) {
      skipped += 1;
      continue;
    }

    const clash = checkShirtColourClash({
      shirtAName: `${teamNameById.get(fx.homeTeamId) ?? "Home"} HOME`,
      shirtABody: homeHome.bodyColour,
      shirtBName: `${teamNameById.get(fx.awayTeamId) ?? "Away"} HOME`,
      shirtBBody: awayHome.bodyColour,
    });

    const awayKit = clash.clash && awayAway ? awayAway : awayHome;
    if (clash.clash) {
      clashes.push({
        fixtureId: fx.id,
        home: teamNameById.get(fx.homeTeamId) ?? fx.homeTeamId,
        away: teamNameById.get(fx.awayTeamId) ?? fx.awayTeamId,
        distance: clash.distance,
      });
    }

    await db
      .update(fixtures)
      .set({
        homeTeamKitId: homeHome.id,
        awayTeamKitId: awayKit.id,
      })
      .where(eq(fixtures.id, fx.id));
    updated += 1;
  }

  return {
    ok: true as const,
    seasonId: season.id,
    updated,
    clashes,
    skipped,
  };
}

/**
 * Seed Autumn Nations Series/Cup home/away drafts (never auto-approved).
 */
export async function seedAutumnNationsShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug.includes("autumn-nations")) ??
    comps.find((c) => c.name.toLowerCase().includes("autumn nations"));
  if (!competition) {
    return { ok: false as const, error: "Autumn Nations competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Autumn Nations season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of AUTUMN_NATIONS_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team =
      teamList.find(matchName) ??
      (teamList.length === 0 ? allTeams.find(matchName) : undefined);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });
      created += 1;
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

/**
 * Seed English Premiership home/away drafts from the Rugby365 shirt guide (never auto-approved).
 */
export async function seedPremiershipShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "premiership") ??
    comps.find((c) => c.name.toLowerCase() === "premiership");
  if (!competition) {
    return { ok: false as const, error: "Premiership competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Premiership season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of PREMIERSHIP_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/premiership-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "English Premiership Rugby 2025/26 Official Team Colours — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

/**
 * Seed New Zealand NPC (Hilux NPC / National Provincial Championship) home/away drafts.
 * Source: 2025 Official Team Colours — sponsor-free Rugby365 guide.
 */
export async function seedNpcShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "npc-n0628z68" || c.slug === "npc") ??
    comps.find((c) => c.slug.includes("npc")) ??
    comps.find((c) => /\bnpc\b/i.test(c.name) || c.name.toLowerCase().includes("provincial championship"));
  if (!competition) {
    return { ok: false as const, error: "NPC competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No NPC season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  let updated = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of NZ_NPC_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const byId = new Map<string, { id: string; name: string }>();
    for (const t of teamList) if (matchName(t)) byId.set(t.id, t);
    for (const t of allTeams) if (matchName(t)) byId.set(t.id, t);
    const matchedTeams = [...byId.values()];

    if (matchedTeams.length === 0) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    for (const team of matchedTeams) {
      matched.push(team.name);

      for (const kit of seed.kits) {
        const versionInput = {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        };

        const [existing] = await db
          .select({ id: teamShirts.id, status: teamShirts.status })
          .from(teamShirts)
          .where(
            and(
              eq(teamShirts.teamId, team.id),
              eq(teamShirts.competitionId, competition.id),
              eq(teamShirts.seasonId, season.id),
              eq(teamShirts.kitType, kit.kitType),
              ne(teamShirts.status, "ARCHIVED"),
            ),
          )
          .limit(1);

        let shirtId: string;
        if (existing) {
          if (existing.status === "APPROVED") continue;
          await createShirtVersion(existing.id, versionInput, createdBy);
          shirtId = existing.id;
          updated += 1;
        } else {
          const { shirt } = await createShirtDraft({
            teamId: team.id,
            competitionId: competition.id,
            seasonId: season.id,
            kitType: kit.kitType,
            createdBy,
            version: versionInput,
          });
          shirtId = shirt.id;
          created += 1;
        }

        await addShirtReference({
          shirtId,
          imageUrl: "/shirt-references/nz-npc-2025-home-away-ref.png",
          imageType: "front",
          sourceName: "National Provincial Championship New Zealand 2025 Official Team Colours — Rugby365",
          notes: "Sponsor-free NZ NPC kits for pitch overlays",
          seasonLabel: season.label,
          uploadedBy: createdBy,
        });
      }
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    updated,
    matched: [...new Set(matched)],
    missing,
  };
}

/**
 * Seed SA provincial (NPC guide) home/away drafts into Currie Cup (never auto-approved).
 * Guide title says National Provincial Championship; teams are SA provincial sides.
 */
export async function seedSaProvincialShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug.includes("currie-cup")) ??
    comps.find((c) => c.name.toLowerCase().includes("currie cup"));
  if (!competition) {
    return { ok: false as const, error: "Currie Cup competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Currie Cup season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of SA_PROVINCIAL_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/npc-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "National Provincial Championship 2025/26 Home & Away Shirts — Rugby365",
        notes: "SA provincial guide (seeded to Currie Cup). Sponsor-free for pitch overlays.",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

/**
 * Seed Top 14 home/away drafts from the Rugby365 shirt guide (never auto-approved).
 */
export async function seedTop14ShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "top-14" || c.slug.includes("top-14")) ??
    comps.find((c) => c.name.toLowerCase().includes("top 14"));
  if (!competition) {
    return { ok: false as const, error: "Top 14 competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Top 14 season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of TOP14_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/top14-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "Top 14 Rugby 2025/26 Home & Away Shirts — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

async function ensureMlrCompetitionAndSeason() {
  const db = getDb();
  let [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "major-league-rugby"))
    .limit(1);

  if (!competition) {
    [competition] = await db
      .insert(competitions)
      .values({
        slug: "major-league-rugby",
        name: "Major League Rugby",
        sourceProvider: "manual",
        competitionType: "domestic",
        catalogKey: "major-league-rugby",
        catalogGroup: "United States",
        countryName: "United States",
        region: "north_america",
        gender: "men",
        ageGroup: "senior",
        format: "league",
        level: "national_top",
        seasonStructure: "northern_split",
        lifecycleStatus: "current",
      })
      .returning();
  }

  if (!competition) {
    return { competition: null, season: null };
  }

  let seasons = await listShirtLibrarySeasons(competition.id);
  let season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2025") || s.year === 2025) ??
    seasons[0];

  if (!season) {
    const [inserted] = await db
      .insert(competitionSeasons)
      .values({
        competitionId: competition.id,
        slug: "2025",
        label: "2025",
        year: 2025,
        isActive: true,
        sourceProvider: "manual",
      })
      .returning();
    season = inserted
      ? {
          id: inserted.id,
          label: inserted.label,
          year: inserted.year,
          isActive: inserted.isActive,
          slug: inserted.slug,
        }
      : null;
  }

  // Ensure Rugby ATL exists for the guide.
  const [existingAtl] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, "rugby-atl"))
    .limit(1);
  if (!existingAtl) {
    await db.insert(teams).values({
      slug: "rugby-atl",
      name: "Rugby ATL",
      shortName: "ATL",
      sourceProvider: "manual",
      countryName: "United States",
      hemisphere: "north",
      region: "north_america",
      teamType: "club",
    });
  }

  // Fix corrupted Old Glory display name if present.
  await db
    .update(teams)
    .set({ name: "Old Glory DC" })
    .where(eq(teams.slug, "old-glory-dc"));

  return { competition, season };
}

/**
 * Seed Major League Rugby home/away drafts from the Rugby365 shirt guide (never auto-approved).
 * Creates the MLR competition/season if missing.
 */
export async function seedMlrShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const { competition, season } = await ensureMlrCompetitionAndSeason();
  if (!competition || !season) {
    return { ok: false as const, error: "Could not create Major League Rugby competition", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];
  const matchedTeamIds: string[] = [];

  for (const seed of MLR_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);
    matchedTeamIds.push(team.id);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/mlr-2025-home-away-ref.png",
        imageType: "front",
        sourceName: "Major League Rugby 2025 Home & Away Shirts — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  // Populate empty standings so Shirt Library season picker lists MLR clubs.
  for (const [index, teamId] of matchedTeamIds.entries()) {
    const [existingRow] = await db
      .select({ id: standingRows.id })
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, season.id),
          eq(standingRows.teamId, teamId),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);
    if (existingRow) continue;
    await db.insert(standingRows).values({
      seasonId: season.id,
      teamId,
      view: "overall",
      rank: index + 1,
    });
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

/**
 * Seed Super Rugby Pacific home/away drafts from the Rugby365 shirt guide (never auto-approved).
 */
export async function seedUrcShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "united-rugby-championship" || c.slug.includes("united-rugby")) ??
    comps.find((c) => c.name.toLowerCase().includes("united rugby"));
  if (!competition) {
    return { ok: false as const, error: "United Rugby Championship not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No URC season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  let updated = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of URC_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const byId = new Map<string, { id: string; name: string }>();
    for (const t of teamList) if (matchName(t)) byId.set(t.id, t);
    for (const t of allTeams) if (matchName(t)) byId.set(t.id, t);
    const matchedTeams = [...byId.values()];

    if (matchedTeams.length === 0) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    for (const team of matchedTeams) {
      matched.push(team.name);

      for (const kit of seed.kits) {
        const versionInput = {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        };

        const [existing] = await db
          .select({ id: teamShirts.id, status: teamShirts.status })
          .from(teamShirts)
          .where(
            and(
              eq(teamShirts.teamId, team.id),
              eq(teamShirts.competitionId, competition.id),
              eq(teamShirts.seasonId, season.id),
              eq(teamShirts.kitType, kit.kitType),
              ne(teamShirts.status, "ARCHIVED"),
            ),
          )
          .limit(1);

        let shirtId: string;
        if (existing) {
          if (existing.status === "APPROVED") continue;
          await createShirtVersion(existing.id, versionInput, createdBy);
          shirtId = existing.id;
          updated += 1;
        } else {
          const { shirt } = await createShirtDraft({
            teamId: team.id,
            competitionId: competition.id,
            seasonId: season.id,
            kitType: kit.kitType,
            createdBy,
            version: versionInput,
          });
          shirtId = shirt.id;
          created += 1;
        }

        await addShirtReference({
          shirtId,
          imageUrl: "/shirt-references/currie-cup-premier-2025-home-away-ref.png",
          imageType: "front",
          sourceName: "URC SA franchise colours — Cape blue/white (Stormers) + Currie Cup guide",
          notes: "Sponsor-free drafts for pitch overlays",
          seasonLabel: season.label,
          uploadedBy: createdBy,
        });
      }
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    updated,
    matched: [...new Set(matched)],
    missing,
  };
}

export async function seedSuperRugbyPacificShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "super-rugby" || c.slug.includes("super-rugby")) ??
    comps.find((c) => c.name.toLowerCase().includes("super rugby"));
  if (!competition) {
    return { ok: false as const, error: "Super Rugby competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Super Rugby season found", created: 0 };
  }

  // Guide extras not always in DB.
  for (const missingTeam of [
    { slug: "dragons-rfc", name: "Dragons RFC", shortName: "DRA" },
    { slug: "christchurch-moana", name: "Christchurch Moana", shortName: "CHM" },
  ]) {
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, missingTeam.slug))
      .limit(1);
    if (!existing) {
      await db.insert(teams).values({
        slug: missingTeam.slug,
        name: missingTeam.name,
        shortName: missingTeam.shortName,
        sourceProvider: "manual",
        countryName: "New Zealand",
        hemisphere: "south",
        region: "oceania",
        teamType: "club",
      });
    }
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of SUPER_RUGBY_PACIFIC_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    // Prefer exact season roster match so "Blues" / "Chiefs" don't hit unrelated clubs.
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/super-rugby-pacific-2026-home-away-ref.png",
        imageType: "front",
        sourceName: "Super Rugby Pacific 2026 Home & Away Shirts — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

async function ensureSerieAEliteCompetitionAndSeason() {
  const db = getDb();
  let [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "serie-a-elite"))
    .limit(1);

  if (!competition) {
    [competition] = await db
      .insert(competitions)
      .values({
        slug: "serie-a-elite",
        name: "Serie A Elite",
        sourceProvider: "manual",
        competitionType: "domestic",
        catalogKey: "serie-a-elite",
        catalogGroup: "Italy",
        countryName: "Italy",
        region: "europe",
        gender: "men",
        ageGroup: "senior",
        format: "league",
        level: "national_top",
        seasonStructure: "northern_split",
        lifecycleStatus: "current",
      })
      .returning();
  }

  if (!competition) {
    return { competition: null, season: null };
  }

  let seasons = await listShirtLibrarySeasons(competition.id);
  let season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2025") || s.label.includes("2026")) ??
    seasons[0];

  if (!season) {
    const [inserted] = await db
      .insert(competitionSeasons)
      .values({
        competitionId: competition.id,
        slug: "2025-26",
        label: "2025–26",
        year: 2025,
        isActive: true,
        sourceProvider: "manual",
      })
      .returning();
    season = inserted
      ? {
          id: inserted.id,
          label: inserted.label,
          year: inserted.year,
          isActive: inserted.isActive,
          slug: inserted.slug,
        }
      : null;
  }

  const ensureTeams = [
    { slug: "virtus-rugby", name: "Virtus Rugby", shortName: "VIR" },
    { slug: "umana-reyer-rugby", name: "Umana Reyer Rugby", shortName: "REY" },
    { slug: "rugby-roma-olympic-club", name: "Rugby Roma Olympic Club", shortName: "ROM" },
    { slug: "patty-lyons", name: "Patty Lyons", shortName: "PLY" },
  ];
  for (const t of ensureTeams) {
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, t.slug))
      .limit(1);
    if (!existing) {
      await db.insert(teams).values({
        slug: t.slug,
        name: t.name,
        shortName: t.shortName,
        sourceProvider: "manual",
        countryName: "Italy",
        hemisphere: "north",
        region: "europe",
        teamType: "club",
      });
    }
  }

  return { competition, season };
}

/**
 * Seed Serie A Elite home/away drafts from the Rugby365 shirt guide (never auto-approved).
 * Creates the competition/season if missing.
 */
export async function seedSerieAEliteShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const { competition, season } = await ensureSerieAEliteCompetitionAndSeason();
  if (!competition || !season) {
    return { ok: false as const, error: "Could not create Serie A Elite competition", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];
  const matchedTeamIds: string[] = [];

  for (const seed of SERIE_A_ELITE_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);
    matchedTeamIds.push(team.id);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/serie-a-elite-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "Serie A Elite 2025/26 Official Team Colours — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  for (const [index, teamId] of matchedTeamIds.entries()) {
    const [existingRow] = await db
      .select({ id: standingRows.id })
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, season.id),
          eq(standingRows.teamId, teamId),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);
    if (existingRow) continue;
    await db.insert(standingRows).values({
      seasonId: season.id,
      teamId,
      view: "overall",
      rank: index + 1,
    });
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

async function ensureScottishPremiershipCompetitionAndSeason() {
  const db = getDb();
  let [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "scottish-premiership"))
    .limit(1);

  if (!competition) {
    [competition] = await db
      .insert(competitions)
      .values({
        slug: "scottish-premiership",
        name: "Scottish Premiership",
        sourceProvider: "manual",
        competitionType: "domestic",
        catalogKey: "scottish-premiership",
        catalogGroup: "Scotland",
        countryName: "Scotland",
        region: "europe",
        gender: "men",
        ageGroup: "senior",
        format: "league",
        level: "national_top",
        seasonStructure: "northern_split",
        lifecycleStatus: "current",
      })
      .returning();
  }

  if (!competition) {
    return { competition: null, season: null };
  }

  let seasons = await listShirtLibrarySeasons(competition.id);
  let season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2025") || s.label.includes("2026")) ??
    seasons[0];

  if (!season) {
    const [inserted] = await db
      .insert(competitionSeasons)
      .values({
        competitionId: competition.id,
        slug: "2025-26",
        label: "2025–26",
        year: 2025,
        isActive: true,
        sourceProvider: "manual",
      })
      .returning();
    season = inserted
      ? {
          id: inserted.id,
          label: inserted.label,
          year: inserted.year,
          isActive: inserted.isActive,
          slug: inserted.slug,
        }
      : null;
  }

  const ensureTeams = [
    { slug: "dundee-rugby", name: "Dundee Rugby", shortName: "DUN" },
    { slug: "murrayfield-wanderers", name: "Murrayfield Wanderers", shortName: "MUR" },
    { slug: "jedforest-rugby", name: "Jedforest Rugby", shortName: "JED" },
    { slug: "hawick-linden", name: "Hawick Linden", shortName: "HAW" },
  ];
  for (const t of ensureTeams) {
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, t.slug))
      .limit(1);
    if (!existing) {
      await db.insert(teams).values({
        slug: t.slug,
        name: t.name,
        shortName: t.shortName,
        sourceProvider: "manual",
        countryName: "Scotland",
        hemisphere: "north",
        region: "europe",
        teamType: "club",
      });
    }
  }

  return { competition, season };
}

/**
 * Seed Scottish Premiership home/away drafts from the Rugby365 shirt guide (never auto-approved).
 */
export async function seedScottishPremiershipShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const { competition, season } = await ensureScottishPremiershipCompetitionAndSeason();
  if (!competition || !season) {
    return {
      ok: false as const,
      error: "Could not create Scottish Premiership competition",
      created: 0,
    };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];
  const matchedTeamIds: string[] = [];

  for (const seed of SCOTTISH_PREMIERSHIP_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);
    matchedTeamIds.push(team.id);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/scottish-premiership-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "Scottish Premiership 2025/26 Official Team Colours — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  for (const [index, teamId] of matchedTeamIds.entries()) {
    const [existingRow] = await db
      .select({ id: standingRows.id })
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, season.id),
          eq(standingRows.teamId, teamId),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);
    if (existingRow) continue;
    await db.insert(standingRows).values({
      seasonId: season.id,
      teamId,
      view: "overall",
      rank: index + 1,
    });
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

async function ensureSuperRygbiCymruCompetitionAndSeason() {
  const db = getDb();
  let [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "super-rygbi-cymru"))
    .limit(1);

  if (!competition) {
    [competition] = await db
      .insert(competitions)
      .values({
        slug: "super-rygbi-cymru",
        name: "Super Rygbi Cymru",
        sourceProvider: "manual",
        competitionType: "domestic",
        catalogKey: "super-rygbi-cymru",
        catalogGroup: "Wales",
        countryName: "Wales",
        region: "europe",
        gender: "men",
        ageGroup: "senior",
        format: "league",
        level: "national_top",
        seasonStructure: "northern_split",
        lifecycleStatus: "current",
      })
      .returning();
  }

  if (!competition) {
    return { competition: null, season: null };
  }

  let seasons = await listShirtLibrarySeasons(competition.id);
  let season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2025") || s.label.includes("2026")) ??
    seasons[0];

  if (!season) {
    const [inserted] = await db
      .insert(competitionSeasons)
      .values({
        competitionId: competition.id,
        slug: "2025-26",
        label: "2025–26",
        year: 2025,
        isActive: true,
        sourceProvider: "manual",
      })
      .returning();
    season = inserted
      ? {
          id: inserted.id,
          label: inserted.label,
          year: inserted.year,
          isActive: inserted.isActive,
          slug: inserted.slug,
        }
      : null;
  }

  const ensureTeams = [
    { slug: "rhondda-rugby", name: "Rhondda Rugby", shortName: "RHO" },
    { slug: "eirias-rugby", name: "Eirias Rugby", shortName: "EIR" },
    { slug: "aberystwyth-rugby", name: "Aberystwyth Rugby", shortName: "ABE" },
    { slug: "bridgend-ravens", name: "Bridgend Ravens", shortName: "BRI" },
    { slug: "newport-rugby", name: "Newport Rugby", shortName: "NEW" },
    { slug: "swansea-rugby", name: "Swansea Rugby", shortName: "SWA" },
    { slug: "merthyr-rugby", name: "Merthyr Rugby", shortName: "MER" },
  ];
  for (const t of ensureTeams) {
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, t.slug))
      .limit(1);
    if (!existing) {
      await db.insert(teams).values({
        slug: t.slug,
        name: t.name,
        shortName: t.shortName,
        sourceProvider: "manual",
        countryName: "Wales",
        hemisphere: "north",
        region: "europe",
        teamType: "club",
      });
    }
  }

  return { competition, season };
}

/**
 * Seed Super Rygbi Cymru home/away drafts from the Rugby365 shirt guide (never auto-approved).
 */
export async function seedSuperRygbiCymruShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const { competition, season } = await ensureSuperRygbiCymruCompetitionAndSeason();
  if (!competition || !season) {
    return {
      ok: false as const,
      error: "Could not create Super Rygbi Cymru competition",
      created: 0,
    };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];
  const matchedTeamIds: string[] = [];

  for (const seed of SUPER_RYGBI_CYMRU_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team = teamList.find(matchName) ?? allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);
    matchedTeamIds.push(team.id);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/super-rygbi-cymru-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "Super Rygbi Cymru 2025/26 Official Team Colours — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  for (const [index, teamId] of matchedTeamIds.entries()) {
    const [existingRow] = await db
      .select({ id: standingRows.id })
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, season.id),
          eq(standingRows.teamId, teamId),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);
    if (existingRow) continue;
    await db.insert(standingRows).values({
      seasonId: season.id,
      teamId,
      view: "overall",
      rank: index + 1,
    });
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

async function ensureAllIrelandLeagueCompetitionAndSeason() {
  const db = getDb();
  let [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, "all-ireland-league"))
    .limit(1);

  if (!competition) {
    [competition] = await db
      .insert(competitions)
      .values({
        slug: "all-ireland-league",
        name: "All-Ireland League",
        sourceProvider: "manual",
        competitionType: "domestic",
        catalogKey: "all-ireland-league",
        catalogGroup: "Ireland",
        countryName: "Ireland",
        region: "europe",
        gender: "men",
        ageGroup: "senior",
        format: "league",
        level: "national_top",
        seasonStructure: "northern_split",
        lifecycleStatus: "current",
      })
      .returning();
  }

  if (!competition) {
    return { competition: null, season: null };
  }

  let seasons = await listShirtLibrarySeasons(competition.id);
  let season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2025") || s.label.includes("2026")) ??
    seasons[0];

  if (!season) {
    const [inserted] = await db
      .insert(competitionSeasons)
      .values({
        competitionId: competition.id,
        slug: "2025-26",
        label: "2025–26",
        year: 2025,
        isActive: true,
        sourceProvider: "manual",
      })
      .returning();
    season = inserted
      ? {
          id: inserted.id,
          label: inserted.label,
          year: inserted.year,
          isActive: inserted.isActive,
          slug: inserted.slug,
        }
      : null;
  }

  const ensureTeams = [
    { slug: "ballincollig-rfc", name: "Ballincollig RFC", shortName: "BAL" },
    { slug: "bangor-rugby", name: "Bangor Rugby", shortName: "BAN" },
    { slug: "dublin-university-fc", name: "Dublin University FC", shortName: "DU" },
    { slug: "donnybrook-rfc", name: "Donnybrook RFC", shortName: "DON" },
    { slug: "galwegians-rfc", name: "Galwegians RFC", shortName: "GAL" },
    { slug: "old-belvedere-rfc", name: "Old Belvedere RFC", shortName: "OB" },
    { slug: "rathmines-rfc", name: "Rathmines RFC", shortName: "RAT" },
    { slug: "ulster-rugby-club", name: "Ulster Rugby Club", shortName: "URC" },
    { slug: "ucd-rugby", name: "UCD Rugby", shortName: "UCD" },
    { slug: "ul-bohemian-rfc", name: "U.L. Bohemian RFC", shortName: "ULB" },
    { slug: "nenagh-ormond-rfc", name: "Nenagh Ormond RFC", shortName: "NEN" },
    { slug: "city-of-derry-rfc", name: "City of Derry RFC", shortName: "COD" },
    { slug: "tullamore-rfc", name: "Tullamore RFC", shortName: "TUL" },
    { slug: "cork-constitution", name: "Cork Constitution", shortName: "CON" },
  ];
  for (const t of ensureTeams) {
    const [existing] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.slug, t.slug))
      .limit(1);
    if (!existing) {
      await db.insert(teams).values({
        slug: t.slug,
        name: t.name,
        shortName: t.shortName,
        sourceProvider: "manual",
        countryName: "Ireland",
        hemisphere: "north",
        region: "europe",
        teamType: "club",
      });
    }
  }

  return { competition, season };
}

/**
 * Seed All-Ireland League home/away drafts from the Rugby365 shirt guide (never auto-approved).
 */
export async function seedAllIrelandLeagueShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const { competition, season } = await ensureAllIrelandLeagueCompetitionAndSeason();
  if (!competition || !season) {
    return {
      ok: false as const,
      error: "Could not create All-Ireland League competition",
      created: 0,
    };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];
  const matchedTeamIds: string[] = [];

  for (const seed of ALL_IRELAND_LEAGUE_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const team =
      teamList.find((t) => t.name.toLowerCase() === seed.teamNames[0]!.toLowerCase()) ??
      allTeams.find((t) => t.name.toLowerCase() === seed.teamNames[0]!.toLowerCase()) ??
      teamList.find(matchName) ??
      allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);
    matchedTeamIds.push(team.id);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/all-ireland-league-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "All-Ireland League 2025/26 Official Team Colours — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  for (const [index, teamId] of matchedTeamIds.entries()) {
    const [existingRow] = await db
      .select({ id: standingRows.id })
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, season.id),
          eq(standingRows.teamId, teamId),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);
    if (existingRow) continue;
    await db.insert(standingRows).values({
      seasonId: season.id,
      teamId,
      view: "overall",
      rank: index + 1,
    });
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}

/**
 * Seed European Rugby Champions Cup home/away drafts from the Rugby365 shirt guide
 * (never auto-approved).
 */
export async function seedChampionsCupShirtDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "rugby-champions-cup" || c.slug.includes("champions-cup")) ??
    comps.find((c) => {
      const n = c.name.toLowerCase();
      return n.includes("champions cup") || n.includes("investec champions");
    });
  if (!competition) {
    return { ok: false as const, error: "Champions Cup competition not found", created: 0 };
  }

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) => s.label.includes("2026") || s.label.includes("2025")) ??
    seasons[0];
  if (!season) {
    return { ok: false as const, error: "No Champions Cup season found", created: 0 };
  }

  await getOrCreateShirtRequirements(competition.id);
  const teamList = await listShirtLibraryTeams(competition.id, season.id);
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);

  let created = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of CHAMPIONS_CUP_SHIRT_SEEDS) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    // Prefer primary guide name, then season roster, then global teams.
    // Avoid matching "Ulster Rugby Club" when primary is "Ulster".
    const team =
      teamList.find((t) => t.name.toLowerCase() === seed.teamNames[0]!.toLowerCase()) ??
      allTeams.find((t) => t.name.toLowerCase() === seed.teamNames[0]!.toLowerCase()) ??
      teamList.find(matchName) ??
      allTeams.find(matchName);

    if (!team) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    matched.push(team.name);

    for (const kit of seed.kits) {
      const [existing] = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.competitionId, competition.id),
            eq(teamShirts.seasonId, season.id),
            eq(teamShirts.kitType, kit.kitType),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        )
        .limit(1);
      if (existing) continue;

      const { shirt } = await createShirtDraft({
        teamId: team.id,
        competitionId: competition.id,
        seasonId: season.id,
        kitType: kit.kitType,
        createdBy,
        version: {
          bodyColour: kit.bodyColour,
          secondaryColour: kit.secondaryColour,
          sleeveColour: kit.sleeveColour ?? kit.bodyColour,
          collarColour: kit.collarColour ?? kit.bodyColour,
          cuffColour: kit.cuffColour ?? kit.bodyColour,
          sidePanelColour: kit.sidePanelColour ?? null,
          patternType: kit.patternType,
          patternColour: kit.patternColour ?? kit.secondaryColour,
          patternSettings: {
            fabricTexture: true,
            fabricTextureOpacity: 0.06,
            ...(kit.patternSettings ?? {}),
          },
          numberColour: kit.numberColour,
          crestEnabled: true,
        },
      });

      await addShirtReference({
        shirtId: shirt.id,
        imageUrl: "/shirt-references/champions-cup-2025-26-home-away-ref.png",
        imageType: "front",
        sourceName: "European Rugby Champions Cup 2025/26 Official Team Colours — Rugby365",
        notes: "Sponsor-free official colours guide for pitch overlays",
        seasonLabel: season.label,
        uploadedBy: createdBy,
      });

      created += 1;
    }
  }

  return {
    ok: true as const,
    competitionId: competition.id,
    seasonId: season.id,
    seasonLabel: season.label,
    created,
    matched,
    missing,
  };
}
