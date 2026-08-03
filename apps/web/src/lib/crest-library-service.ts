/**
 * Crest Library — approval centre for official / replica club crests.
 * Pitch & shirt consumers should use resolveApprovedTeamCrest().
 */
import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  teamCrestReviews,
  teamCrests,
  teamCrestVersions,
  teamShirts,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { CURRIE_CUP_CREST_SEEDS } from "./crest-library-currie-cup-seed";
import { NZ_NPC_CREST_SEEDS } from "./crest-library-npc-seed";
import { PREMIERSHIP_CREST_SEEDS } from "./crest-library-premiership-seed";
import type {
  CrestColourSwatch,
  CrestStatus,
  CrestVersionInput,
  ResolvedTeamCrest,
} from "./crest-library-types";
import { listSeasonScopedTeams } from "./season-scoped-picker-service";

type CrestSeedRow = {
  teamNames: string[];
  version: CrestVersionInput;
};

function asColours(raw: unknown): CrestColourSwatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { name?: unknown; hex?: unknown };
      if (typeof row.name !== "string" || typeof row.hex !== "string") return null;
      return { name: row.name, hex: row.hex };
    })
    .filter((c): c is CrestColourSwatch => Boolean(c));
}

function displayUrl(
  official: string | null | undefined,
  replica: string | null | undefined,
): string | null {
  return official?.trim() || replica?.trim() || null;
}

async function writeReview(
  crestId: string,
  versionId: string | null,
  status: string,
  notes?: string,
  reviewedBy?: string,
) {
  const db = getDb();
  await db.insert(teamCrestReviews).values({
    crestId,
    versionId,
    status,
    reviewNotes: notes ?? null,
    reviewedBy: reviewedBy ?? null,
  });
}

export async function listCrestLibraryCompetitions() {
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

export async function listCrestLibrarySeasons(competitionId: string) {
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

export async function listCrestLibraryTeams(competitionId: string, seasonId: string) {
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
    imageUrl: logoMap.get(t.id) ?? null,
    countryName: t.countryName ?? null,
  }));
}

export async function getCrestDetail(crestId: string) {
  const db = getDb();
  const [crest] = await db.select().from(teamCrests).where(eq(teamCrests.id, crestId)).limit(1);
  if (!crest) return null;

  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      imageUrl: teams.imageUrl,
    })
    .from(teams)
    .where(eq(teams.id, crest.teamId))
    .limit(1);

  let competition: { id: string; name: string; slug: string } | null = null;
  let season: { id: string; label: string; year: number } | null = null;
  if (crest.competitionId) {
    const [c] = await db
      .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
      .from(competitions)
      .where(eq(competitions.id, crest.competitionId))
      .limit(1);
    competition = c ?? null;
  }
  if (crest.seasonId) {
    const [s] = await db
      .select({
        id: competitionSeasons.id,
        label: competitionSeasons.label,
        year: competitionSeasons.year,
      })
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, crest.seasonId))
      .limit(1);
    season = s ?? null;
  }

  const versions = await db
    .select()
    .from(teamCrestVersions)
    .where(eq(teamCrestVersions.crestId, crestId))
    .orderBy(desc(teamCrestVersions.versionNumber));
  const reviews = await db
    .select()
    .from(teamCrestReviews)
    .where(eq(teamCrestReviews.crestId, crestId))
    .orderBy(desc(teamCrestReviews.createdAt));

  const latest = versions[0] ?? null;
  const approved = versions.find((v) => v.id === crest.approvedVersionId) ?? null;
  const display = approved ?? latest;

  return {
    crest,
    team,
    competition,
    season,
    versions,
    reviews,
    latestVersion: latest,
    approvedVersion: approved,
    displayVersion: display,
  };
}

export async function createCrestDraft(input: {
  teamId: string;
  competitionId?: string | null;
  seasonId?: string | null;
  name?: string;
  createdBy?: string;
  version: CrestVersionInput;
}) {
  const db = getDb();
  const [team] = await db
    .select({ name: teams.name, imageUrl: teams.imageUrl })
    .from(teams)
    .where(eq(teams.id, input.teamId))
    .limit(1);

  // Only one current crest per team — demote others when creating a new current draft.
  await db
    .update(teamCrests)
    .set({ isCurrent: false, updatedAt: new Date() })
    .where(and(eq(teamCrests.teamId, input.teamId), eq(teamCrests.isCurrent, true)));

  const [crest] = await db
    .insert(teamCrests)
    .values({
      teamId: input.teamId,
      competitionId: input.competitionId ?? null,
      seasonId: input.seasonId ?? null,
      name: input.name ?? `${team?.name ?? "Team"} Crest`,
      status: "DRAFT",
      isCurrent: true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    })
    .returning();

  const official =
    input.version.officialImageUrl?.trim() || team?.imageUrl?.trim() || null;
  const replica = input.version.replicaImageUrl?.trim() || null;

  const [version] = await db
    .insert(teamCrestVersions)
    .values({
      crestId: crest!.id,
      versionNumber: 1,
      status: "DRAFT",
      title: input.version.title ?? null,
      description: input.version.description ?? null,
      aboutCrest: input.version.aboutCrest ?? null,
      primaryColour: input.version.primaryColour ?? null,
      secondaryColour: input.version.secondaryColour ?? null,
      accentColour: input.version.accentColour ?? null,
      colours: input.version.colours ?? [],
      officialImageUrl: official,
      replicaImageUrl: replica,
      sourceUrl: input.version.sourceUrl ?? null,
      sourceName: input.version.sourceName ?? null,
      notes: input.version.notes ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  return { crest: crest!, version: version! };
}

export async function createCrestVersion(
  crestId: string,
  version: CrestVersionInput,
  createdBy?: string,
) {
  const db = getDb();
  const [crest] = await db.select().from(teamCrests).where(eq(teamCrests.id, crestId)).limit(1);
  if (!crest) throw new Error("Crest not found");
  if (crest.status === "ARCHIVED") throw new Error("Cannot version an archived crest");

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${teamCrestVersions.versionNumber}), 0)` })
    .from(teamCrestVersions)
    .where(eq(teamCrestVersions.crestId, crestId));

  const next = Number(max ?? 0) + 1;
  const [row] = await db
    .insert(teamCrestVersions)
    .values({
      crestId,
      versionNumber: next,
      status: "DRAFT",
      title: version.title ?? null,
      description: version.description ?? null,
      aboutCrest: version.aboutCrest ?? null,
      primaryColour: version.primaryColour ?? null,
      secondaryColour: version.secondaryColour ?? null,
      accentColour: version.accentColour ?? null,
      colours: version.colours ?? [],
      officialImageUrl: version.officialImageUrl ?? null,
      replicaImageUrl: version.replicaImageUrl ?? null,
      sourceUrl: version.sourceUrl ?? null,
      sourceName: version.sourceName ?? null,
      notes: version.notes ?? null,
      createdBy: createdBy ?? null,
    })
    .returning();

  await db
    .update(teamCrests)
    .set({
      status: "DRAFT",
      updatedBy: createdBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamCrests.id, crestId));

  return row!;
}

export async function updateDraftCrestVersion(
  versionId: string,
  patch: CrestVersionInput,
  updatedBy?: string,
) {
  const db = getDb();
  const [version] = await db
    .select()
    .from(teamCrestVersions)
    .where(eq(teamCrestVersions.id, versionId))
    .limit(1);
  if (!version) throw new Error("Version not found");
  if (version.status === "APPROVED") {
    throw new Error("Never edit an approved version — create a new version instead");
  }

  const [updated] = await db
    .update(teamCrestVersions)
    .set({
      title: patch.title ?? null,
      description: patch.description ?? null,
      aboutCrest: patch.aboutCrest ?? null,
      primaryColour: patch.primaryColour ?? null,
      secondaryColour: patch.secondaryColour ?? null,
      accentColour: patch.accentColour ?? null,
      colours: patch.colours ?? version.colours,
      officialImageUrl: patch.officialImageUrl ?? null,
      replicaImageUrl: patch.replicaImageUrl ?? null,
      sourceUrl: patch.sourceUrl ?? null,
      sourceName: patch.sourceName ?? null,
      notes: patch.notes ?? null,
    })
    .where(eq(teamCrestVersions.id, versionId))
    .returning();

  await db
    .update(teamCrests)
    .set({ updatedBy: updatedBy ?? null, updatedAt: new Date() })
    .where(eq(teamCrests.id, version.crestId));

  return updated!;
}

export async function submitCrestForReview(crestId: string, submittedBy?: string) {
  const db = getDb();
  const detail = await getCrestDetail(crestId);
  if (!detail?.latestVersion) throw new Error("No version to submit");
  const version = detail.latestVersion;
  if (!displayUrl(version.officialImageUrl, version.replicaImageUrl)) {
    throw new Error("Add an official or replica crest image before submitting");
  }

  await db
    .update(teamCrestVersions)
    .set({ status: "AWAITING_REVIEW" })
    .where(eq(teamCrestVersions.id, version.id));
  await db
    .update(teamCrests)
    .set({
      status: "AWAITING_REVIEW",
      updatedBy: submittedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamCrests.id, crestId));
  await writeReview(crestId, version.id, "AWAITING_REVIEW", "Submitted for review", submittedBy);
}

/** Link all non-archived shirts for a team to this crest. */
export async function linkTeamShirtsToCrest(teamId: string, crestId: string) {
  const db = getDb();
  const result = await db
    .update(teamShirts)
    .set({ crestId, updatedAt: new Date() })
    .where(and(eq(teamShirts.teamId, teamId), ne(teamShirts.status, "ARCHIVED")))
    .returning({ id: teamShirts.id });
  return result.length;
}

export async function approveCrestVersion(
  crestId: string,
  options?: { versionId?: string; reviewedBy?: string; notes?: string },
) {
  const db = getDb();
  const detail = await getCrestDetail(crestId);
  if (!detail) throw new Error("Crest not found");
  const version =
    detail.versions.find((v) => v.id === options?.versionId) ?? detail.latestVersion;
  if (!version) throw new Error("No version to approve");

  const imageUrl = displayUrl(version.officialImageUrl, version.replicaImageUrl);
  if (!imageUrl) throw new Error("Cannot approve a crest without an image");

  await db
    .update(teamCrestVersions)
    .set({ status: "APPROVED" })
    .where(eq(teamCrestVersions.id, version.id));

  await db
    .update(teamCrests)
    .set({
      status: "APPROVED",
      isCurrent: true,
      approvedVersionId: version.id,
      approvedForPitchUse: true,
      useOnShirts: true,
      useOnMatchCentre: true,
      useOnSocialGraphics: true,
      approvedBy: options?.reviewedBy ?? null,
      approvedAt: new Date(),
      updatedBy: options?.reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamCrests.id, crestId));

  // Demote other current crests for this team.
  await db
    .update(teamCrests)
    .set({ isCurrent: false, updatedAt: new Date() })
    .where(
      and(
        eq(teamCrests.teamId, detail.crest.teamId),
        ne(teamCrests.id, crestId),
        eq(teamCrests.isCurrent, true),
      ),
    );

  // Sync team image + link shirts.
  await db
    .update(teams)
    .set({ imageUrl })
    .where(eq(teams.id, detail.crest.teamId));

  const shirtsLinked = await linkTeamShirtsToCrest(detail.crest.teamId, crestId);

  await writeReview(
    crestId,
    version.id,
    "APPROVED",
    options?.notes ?? "Approved for pitch / shirt use",
    options?.reviewedBy,
  );

  return { shirtsLinked, imageUrl };
}

export async function requestCrestChanges(
  crestId: string,
  notes: string,
  reviewedBy?: string,
  versionId?: string,
) {
  if (!notes.trim()) throw new Error("Review note is required when requesting changes");
  const db = getDb();
  const detail = await getCrestDetail(crestId);
  if (!detail) throw new Error("Crest not found");
  const version =
    detail.versions.find((v) => v.id === versionId) ?? detail.latestVersion;

  if (version) {
    await db
      .update(teamCrestVersions)
      .set({ status: "CHANGES_REQUIRED" })
      .where(eq(teamCrestVersions.id, version.id));
  }
  await db
    .update(teamCrests)
    .set({
      status: "CHANGES_REQUIRED",
      updatedBy: reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamCrests.id, crestId));
  await writeReview(crestId, version?.id ?? null, "CHANGES_REQUIRED", notes, reviewedBy);
}

export async function rejectCrest(
  crestId: string,
  notes: string,
  reviewedBy?: string,
  versionId?: string,
) {
  if (!notes.trim()) throw new Error("Review note is required when rejecting");
  const db = getDb();
  const detail = await getCrestDetail(crestId);
  if (!detail) throw new Error("Crest not found");
  const version =
    detail.versions.find((v) => v.id === versionId) ?? detail.latestVersion;

  if (version) {
    await db
      .update(teamCrestVersions)
      .set({ status: "REJECTED" })
      .where(eq(teamCrestVersions.id, version.id));
  }
  await db
    .update(teamCrests)
    .set({
      status: "REJECTED",
      approvedForPitchUse: false,
      updatedBy: reviewedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamCrests.id, crestId));
  await writeReview(crestId, version?.id ?? null, "REJECTED", notes, reviewedBy);
}

export async function archiveCrest(crestId: string, updatedBy?: string) {
  const db = getDb();
  await db
    .update(teamCrests)
    .set({
      status: "ARCHIVED",
      isCurrent: false,
      approvedForPitchUse: false,
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(teamCrests.id, crestId));
}

export async function resolveApprovedTeamCrest(
  teamId: string,
): Promise<ResolvedTeamCrest | null> {
  const db = getDb();
  const [crest] = await db
    .select()
    .from(teamCrests)
    .where(
      and(
        eq(teamCrests.teamId, teamId),
        eq(teamCrests.status, "APPROVED"),
        eq(teamCrests.approvedForPitchUse, true),
        eq(teamCrests.isCurrent, true),
      ),
    )
    .limit(1);

  if (!crest?.approvedVersionId) return null;

  const [version] = await db
    .select()
    .from(teamCrestVersions)
    .where(eq(teamCrestVersions.id, crest.approvedVersionId))
    .limit(1);
  if (!version) return null;

  const official = version.officialImageUrl;
  const replica = version.replicaImageUrl;

  return {
    crestId: crest.id,
    teamId: crest.teamId,
    versionId: version.id,
    status: crest.status as CrestStatus,
    officialImageUrl: official,
    replicaImageUrl: replica,
    displayImageUrl: displayUrl(official, replica),
    primaryColour: version.primaryColour,
    secondaryColour: version.secondaryColour,
    accentColour: version.accentColour,
    colours: asColours(version.colours),
    description: version.description,
    aboutCrest: version.aboutCrest,
  };
}

/** Prefer approved crest image; fall back to teams.image_url. */
export async function resolveTeamCrestImageUrl(teamId: string): Promise<string | null> {
  const approved = await resolveApprovedTeamCrest(teamId);
  if (approved?.displayImageUrl) return approved.displayImageUrl;
  const db = getDb();
  const [team] = await db
    .select({ imageUrl: teams.imageUrl })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  return team?.imageUrl ?? null;
}

export async function listTeamCrests(teamId: string) {
  const db = getDb();
  const crests = await db
    .select()
    .from(teamCrests)
    .where(and(eq(teamCrests.teamId, teamId), ne(teamCrests.status, "ARCHIVED")))
    .orderBy(desc(teamCrests.isCurrent), desc(teamCrests.updatedAt));

  const out = [];
  for (const crest of crests) {
    const versions = await db
      .select()
      .from(teamCrestVersions)
      .where(eq(teamCrestVersions.crestId, crest.id))
      .orderBy(desc(teamCrestVersions.versionNumber));
    const latest = versions[0] ?? null;
    const approved = versions.find((v) => v.id === crest.approvedVersionId) ?? null;
    const display = approved ?? latest;
    out.push({
      crest,
      latestVersion: latest,
      approvedVersion: approved,
      displayImageUrl: display
        ? displayUrl(display.officialImageUrl, display.replicaImageUrl)
        : null,
      colours: display ? asColours(display.colours) : [],
      description: display?.description ?? null,
      aboutCrest: display?.aboutCrest ?? null,
      primaryColour: display?.primaryColour ?? null,
      secondaryColour: display?.secondaryColour ?? null,
      accentColour: display?.accentColour ?? null,
    });
  }
  return out;
}

export async function getCompetitionCrestStatus(competitionId: string, seasonId: string) {
  const teamList = await listCrestLibraryTeams(competitionId, seasonId);
  const db = getDb();

  const rows = [];
  let approved = 0;
  let awaiting = 0;
  let draft = 0;
  let missing = 0;

  for (const team of teamList) {
    const [crest] = await db
      .select()
      .from(teamCrests)
      .where(
        and(
          eq(teamCrests.teamId, team.id),
          eq(teamCrests.isCurrent, true),
          ne(teamCrests.status, "ARCHIVED"),
        ),
      )
      .limit(1);

    let status: string = "NOT_STARTED";
    let displayImageUrl: string | null = team.imageUrl;
    let colours: CrestColourSwatch[] = [];
    let description: string | null = null;
    let shirtsLinked = 0;

    if (crest) {
      status = crest.status;
      const versions = await db
        .select()
        .from(teamCrestVersions)
        .where(eq(teamCrestVersions.crestId, crest.id))
        .orderBy(desc(teamCrestVersions.versionNumber));
      const display =
        versions.find((v) => v.id === crest.approvedVersionId) ?? versions[0] ?? null;
      if (display) {
        displayImageUrl = displayUrl(display.officialImageUrl, display.replicaImageUrl);
        colours = asColours(display.colours);
        description = display.description;
      }
      const linked = await db
        .select({ id: teamShirts.id })
        .from(teamShirts)
        .where(
          and(
            eq(teamShirts.teamId, team.id),
            eq(teamShirts.crestId, crest.id),
            ne(teamShirts.status, "ARCHIVED"),
          ),
        );
      shirtsLinked = linked.length;

      if (status === "APPROVED") approved += 1;
      else if (status === "AWAITING_REVIEW") awaiting += 1;
      else draft += 1;
    } else {
      missing += 1;
    }

    rows.push({
      team,
      crestId: crest?.id ?? null,
      status,
      displayImageUrl,
      colours,
      description,
      shirtsLinked,
    });
  }

  const teamCount = teamList.length;
  return {
    teams: rows,
    summary: {
      teamCount,
      approved,
      awaitingReview: awaiting,
      draft,
      notStarted: missing,
      readinessPct: teamCount ? Math.round((approved / teamCount) * 100) : 0,
    },
  };
}

async function ensureTeams(
  rows: Array<{
    slug: string;
    name: string;
    shortName: string;
    countryName: string;
    hemisphere: string;
    region: string;
  }>,
) {
  const db = getDb();
  for (const missingTeam of rows) {
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
        countryName: missingTeam.countryName,
        hemisphere: missingTeam.hemisphere,
        region: missingTeam.region,
        teamType: "club",
      });
    }
  }
}

async function seedCompetitionCrestDrafts(input: {
  competition: { id: string; name: string };
  seasonLabelHint?: string[];
  seeds: CrestSeedRow[];
  createdBy: string;
}) {
  const seasons = await listCrestLibrarySeasons(input.competition.id);
  const season =
    seasons.find((s) => s.isActive) ??
    seasons.find((s) =>
      (input.seasonLabelHint ?? ["2026", "2025"]).some((h) => s.label.includes(h)),
    ) ??
    seasons[0];
  if (!season) {
    return {
      ok: false as const,
      error: `No season found for ${input.competition.name}`,
      created: 0,
    };
  }

  const db = getDb();
  const teamList = await listCrestLibraryTeams(input.competition.id, season.id);
  const allTeams = await db
    .select({ id: teams.id, name: teams.name, imageUrl: teams.imageUrl })
    .from(teams);

  let created = 0;
  let updated = 0;
  let shirtsLinked = 0;
  const missing: string[] = [];
  const matched: string[] = [];

  for (const seed of input.seeds) {
    const matchName = (t: { name: string }) =>
      seed.teamNames.some((n) => t.name.toLowerCase() === n.toLowerCase());
    const byId = new Map<string, { id: string; name: string; imageUrl: string | null }>();
    for (const t of teamList) {
      if (matchName(t)) byId.set(t.id, { id: t.id, name: t.name, imageUrl: t.imageUrl });
    }
    for (const t of allTeams) {
      if (matchName(t)) byId.set(t.id, t);
    }
    const matchedTeams = [...byId.values()];

    if (matchedTeams.length === 0) {
      missing.push(seed.teamNames[0]!);
      continue;
    }

    for (const team of matchedTeams) {
      matched.push(team.name);
      const versionInput: CrestVersionInput = {
        ...seed.version,
        officialImageUrl: seed.version.officialImageUrl ?? team.imageUrl,
        replicaImageUrl: seed.version.replicaImageUrl ?? null,
      };

      const [existing] = await db
        .select({ id: teamCrests.id, status: teamCrests.status })
        .from(teamCrests)
        .where(
          and(
            eq(teamCrests.teamId, team.id),
            eq(teamCrests.isCurrent, true),
            ne(teamCrests.status, "ARCHIVED"),
          ),
        )
        .limit(1);

      let crestId: string;
      if (existing) {
        if (existing.status === "APPROVED") {
          shirtsLinked += await linkTeamShirtsToCrest(team.id, existing.id);
          continue;
        }
        await createCrestVersion(existing.id, versionInput, input.createdBy);
        await db
          .update(teamCrests)
          .set({
            competitionId: input.competition.id,
            seasonId: season.id,
            name: `${team.name} Crest`,
            updatedBy: input.createdBy,
            updatedAt: new Date(),
          })
          .where(eq(teamCrests.id, existing.id));
        crestId = existing.id;
        updated += 1;
      } else {
        const { crest } = await createCrestDraft({
          teamId: team.id,
          competitionId: input.competition.id,
          seasonId: season.id,
          name: `${team.name} Crest`,
          createdBy: input.createdBy,
          version: versionInput,
        });
        crestId = crest.id;
        created += 1;
      }

      shirtsLinked += await linkTeamShirtsToCrest(team.id, crestId);
    }
  }

  return {
    ok: true as const,
    competitionId: input.competition.id,
    seasonId: season.id,
    created,
    updated,
    shirtsLinked,
    matched: [...new Set(matched)],
    missing,
  };
}

/**
 * Seed Currie Cup 2026 crest drafts from the Crest Library guide.
 * Uses existing team.image_url as official image when present.
 * Links matching Shirt Library kits to each crest.
 */
export async function seedCurrieCupCrestDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug.includes("currie-cup")) ??
    comps.find((c) => c.name.toLowerCase().includes("currie cup"));
  if (!competition) {
    return { ok: false as const, error: "Currie Cup competition not found", created: 0 };
  }

  await ensureTeams([
    {
      slug: "border-bulldogs",
      name: "Border Bulldogs",
      shortName: "BOR",
      countryName: "South Africa",
      hemisphere: "south",
      region: "africa",
    },
    {
      slug: "griffons",
      name: "Griffons",
      shortName: "GRI",
      countryName: "South Africa",
      hemisphere: "south",
      region: "africa",
    },
    {
      slug: "eastern-province",
      name: "Eastern Province",
      shortName: "EP",
      countryName: "South Africa",
      hemisphere: "south",
      region: "africa",
    },
    {
      slug: "leopards",
      name: "Leopards",
      shortName: "LEO",
      countryName: "South Africa",
      hemisphere: "south",
      region: "africa",
    },
    {
      slug: "swd-eagles",
      name: "SWD Eagles",
      shortName: "SWD",
      countryName: "South Africa",
      hemisphere: "south",
      region: "africa",
    },
    {
      slug: "valke",
      name: "Valke",
      shortName: "VAL",
      countryName: "South Africa",
      hemisphere: "south",
      region: "africa",
    },
  ]);

  return seedCompetitionCrestDrafts({
    competition,
    seeds: CURRIE_CUP_CREST_SEEDS,
    createdBy,
  });
}

/**
 * Seed NZ NPC (2006–present) crest drafts from the Crest Library guide.
 * Links matching Shirt Library kits to each crest.
 */
export async function seedNpcCrestDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "npc-n0628z68" || c.slug === "npc") ??
    comps.find((c) => c.slug.includes("npc")) ??
    comps.find(
      (c) => /\bnpc\b/i.test(c.name) || c.name.toLowerCase().includes("provincial championship"),
    );
  if (!competition) {
    return { ok: false as const, error: "NPC competition not found", created: 0 };
  }

  return seedCompetitionCrestDrafts({
    competition,
    seeds: NZ_NPC_CREST_SEEDS,
    createdBy,
  });
}

/**
 * Seed English Premiership crest drafts.
 * Uses existing team.image_url (or known official assets) and links shirts.
 */
export async function seedPremiershipCrestDrafts(createdBy = "system-seed") {
  const db = getDb();
  const comps = await db.select().from(competitions);
  const competition =
    comps.find((c) => c.slug === "premiership") ??
    comps.find((c) => c.name.toLowerCase() === "premiership") ??
    comps.find((c) => c.name.toLowerCase().includes("premiership") && !c.slug.includes("scottish"));
  if (!competition) {
    return { ok: false as const, error: "Premiership competition not found", created: 0 };
  }

  return seedCompetitionCrestDrafts({
    competition,
    seeds: PREMIERSHIP_CREST_SEEDS,
    createdBy,
  });
}
