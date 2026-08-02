import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  fixtures,
  standingRows,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { normalizeSlug, validateSlug } from "./fixture-admin-service";
import { competitionsForPicker } from "./competition-list-utils";
import { migrateSeasonId } from "./competition-dedupe-service";
import {
  buildDomesticSeasonCatalog,
  canonicalSeasonPickerScore,
  currentDomesticSeasonStartYear,
  formatSeasonLabelForKind,
  formatSeasonRangeLabel,
  normalizeSeasonLabel,
  parseSeasonStartYear,
  seasonSlugForKind,
  seasonSlugFromStartYear,
  seasonKindForCompetition,
  usesCalendarYearSeasons,
  usesDomesticSeasonCatalogForCompetition,
} from "./season-label-utils";
import {
  fixtureBelongsToSeason,
  seasonKindFromCompetitionType,
} from "./fixture-season-resolve";
import {
  dedupeSeasonsByYear,
  decorateSeasonPickerRows,
  pickDefaultSeasonForPicker,
} from "./season-list-utils";
import { lookupCompetitionChampion } from "./competition-champions-catalog";
import { isPlayoffRound } from "./rugby-round-utils";

export type CompetitionType = "domestic" | "international" | "world_cup" | "european";

export async function listAllSeasons(competitionId?: string) {
  let seasonKind: "club" | "international" | "tournament" = "club";
  if (competitionId) {
    const competition = await getCompetitionById(competitionId);
    seasonKind = seasonKindForCompetition(competition?.slug, competition?.competitionType);
    if (competition && !usesCalendarYearSeasons(competition.slug, competition.competitionType)) {
      await ensureRecentDomesticSeasons(competitionId);
    }
  }

  const db = getDb();
  const conditions = [eq(competitionSeasons.isDeprecated, false)];
  if (competitionId) {
    conditions.push(eq(competitionSeasons.competitionId, competitionId));
  }

  const rows = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      competitionId: competitionSeasons.competitionId,
      competitionName: competitions.name,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitionSeasons.competitionId, competitions.id))
    .where(and(...conditions))
    .orderBy(desc(competitionSeasons.year), asc(competitions.name));

  const seasons = decorateSeasonPickerRows(
    dedupeSeasonsByYear(
      rows.map((row) => ({
        ...row,
        year: row.year ?? parseSeasonStartYear(row.label) ?? 0,
      })),
    ),
    new Date(),
    seasonKind,
  );

  return { seasons, seasonKind };
}

export async function listSeasonsForPicker(competitionId: string) {
  const competition = await getCompetitionById(competitionId);
  const seasonKind = seasonKindForCompetition(competition?.slug, competition?.competitionType);
  if (competition && !usesCalendarYearSeasons(competition.slug, competition.competitionType)) {
    await ensureRecentDomesticSeasons(competitionId);
  }

  const db = getDb();
  const rows = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      competitionId: competitionSeasons.competitionId,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .where(
      and(eq(competitionSeasons.competitionId, competitionId), eq(competitionSeasons.isDeprecated, false)),
    )
    .orderBy(desc(competitionSeasons.year));

  return decorateSeasonPickerRows(
    dedupeSeasonsByYear(
      rows.map((row) => ({
        ...row,
        year: row.year ?? parseSeasonStartYear(row.label) ?? 0,
      })),
    ),
    new Date(),
    seasonKind,
  );
}

export async function listCompetitions() {
  const db = getDb();
  const rows = await db.select().from(competitions).orderBy(asc(competitions.name));

  const seasonRows = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.isDeprecated, false));

  const seasonsByCompetition = new Map<string, (typeof seasonRows)[number][]>();
  for (const season of seasonRows) {
    const bucket = seasonsByCompetition.get(season.competitionId) ?? [];
    bucket.push(season);
    seasonsByCompetition.set(season.competitionId, bucket);
  }

  return competitionsForPicker(
    rows.map((c) => {
      const competitionSeasons = seasonsByCompetition.get(c.id) ?? [];
      const pickerRows = dedupeSeasonsByYear(
        competitionSeasons.map((season) => ({
          id: season.id,
          label: season.label,
          year: season.year ?? parseSeasonStartYear(season.label) ?? 0,
          competitionId: season.competitionId,
          isActive: season.isActive,
        })),
      );
      const picked = pickDefaultSeasonForPicker(pickerRows);
      const activeSeason = picked
        ? (competitionSeasons.find((season) => season.id === picked.id) ?? null)
        : null;

      return {
        ...c,
        activeSeason,
      };
    }),
  );
}

export async function getCompetitionById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  return row ?? null;
}

export async function getCompetitionBySlug(slug: string) {
  const db = getDb();
  const normalized = normalizeSlug(slug);
  const [bySlug] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, normalized))
    .limit(1);
  if (bySlug) return bySlug;

  // Public / Planet Rugby URLs often use planet_rugby_slug (e.g. currie-cup).
  const [byPlanetSlug] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.planetRugbySlug, normalized))
    .limit(1);
  return byPlanetSlug ?? null;
}

export async function getCompetitionDetail(id: string) {
  const competition = await getCompetitionById(id);
  if (!competition) return null;

  await normalizeCompetitionSeasonLabels(id);

  const db = getDb();
  const seasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, id))
    .orderBy(desc(competitionSeasons.year));

  return { competition, seasons };
}

export async function createCompetition(input: {
  name: string;
  slug?: string;
  competitionType?: CompetitionType;
  sdmsCompCode?: string;
  planetRugbySlug?: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Competition name is required");
  const slug = normalizeSlug(input.slug || name);
  const slugErr = validateSlug(slug);
  if (slugErr) throw new Error(slugErr);

  const db = getDb();
  const [row] = await db
    .insert(competitions)
    .values({
      name,
      slug,
      competitionType: input.competitionType ?? "domestic",
      sdmsCompCode: input.sdmsCompCode?.trim() || null,
      planetRugbySlug: input.planetRugbySlug?.trim() || null,
      sourceProvider: input.sdmsCompCode ? "sdms" : "manual",
    })
    .returning();
  return row;
}

export async function updateCompetition(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    competitionType: CompetitionType;
    sdmsCompCode: string | null;
    planetRugbySlug: string | null;
  }>,
) {
  const db = getDb();
  const [existing] = await db.select().from(competitions).where(eq(competitions.id, id)).limit(1);
  if (!existing) throw new Error("Competition not found");

  const slug = input.slug !== undefined ? normalizeSlug(input.slug) : existing.slug;
  if (input.slug !== undefined) {
    const slugErr = validateSlug(slug);
    if (slugErr) throw new Error(slugErr);
  }

  const [row] = await db
    .update(competitions)
    .set({
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.slug !== undefined ? { slug } : {}),
      ...(input.competitionType !== undefined ? { competitionType: input.competitionType } : {}),
      ...(input.sdmsCompCode !== undefined ? { sdmsCompCode: input.sdmsCompCode || null } : {}),
      ...(input.planetRugbySlug !== undefined
        ? { planetRugbySlug: input.planetRugbySlug || null }
        : {}),
    })
    .where(eq(competitions.id, id))
    .returning();
  return row;
}

export async function deleteCompetition(id: string) {
  const db = getDb();
  const [row] = await db
    .delete(competitions)
    .where(eq(competitions.id, id))
    .returning({ id: competitions.id });
  if (!row) throw new Error("Competition not found");
  return row;
}

export async function getSeasonById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, id))
    .limit(1);
  return row ?? null;
}

export async function upsertSeason(input: {
  competitionId: string;
  label: string;
  isActive?: boolean;
  /** Club uses cross-year labels; international/tournament use calendar year. */
  seasonKind?: "club" | "international" | "tournament";
}) {
  const startYear = parseSeasonStartYear(input.label.trim());
  if (startYear == null) throw new Error("Season label must be a year or range, e.g. 2025–26");

  const seasonKind = input.seasonKind ?? "club";
  const label = formatSeasonLabelForKind(startYear, seasonKind);
  const slug = seasonSlugForKind(startYear, seasonKind);
  const year = startYear;

  const db = getDb();
  const competitionSeasonRows = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, input.competitionId));

  const existing =
    competitionSeasonRows.find((row) => row.year === year) ??
    competitionSeasonRows.find((row) => parseSeasonStartYear(row.label) === year);

  if (input.isActive) {
    await db
      .update(competitionSeasons)
      .set({ isActive: false })
      .where(eq(competitionSeasons.competitionId, input.competitionId));
  }

  if (existing) {
    const [updated] = await db
      .update(competitionSeasons)
      .set({
        label,
        slug,
        year,
        isDeprecated: false,
        ...(input.isActive ? { isActive: true } : {}),
      })
      .where(eq(competitionSeasons.id, existing.id))
      .returning();
    return updated;
  }

  const [row] = await db
    .insert(competitionSeasons)
    .values({
      competitionId: input.competitionId,
      slug,
      label,
      year,
      isActive: input.isActive ?? false,
      isDeprecated: false,
    })
    .returning();
  return row;
}

/**
 * Ensure current (+ previous) domestic seasons exist for picker dropdowns.
 * Marks the calendar-current season active (e.g. 2026–27 from July 2026).
 * Always undepricates rows so they appear in filters.
 */
export async function ensureRecentDomesticSeasons(
  competitionId: string,
  referenceDate = new Date(),
) {
  const competition = await getCompetitionById(competitionId);
  if (!competition || !usesDomesticSeasonCatalogForCompetition(competition.slug, competition.competitionType)) {
    return;
  }

  const currentYear = currentDomesticSeasonStartYear(referenceDate);
  await upsertSeason({
    competitionId,
    label: formatSeasonRangeLabel(currentYear - 1),
  });
  await upsertSeason({
    competitionId,
    label: formatSeasonRangeLabel(currentYear),
    isActive: true,
  });

  // Belt-and-braces: clear deprecated on current/previous even if upsert matched oddly
  const db = getDb();
  await db
    .update(competitionSeasons)
    .set({ isDeprecated: false })
    .where(
      and(
        eq(competitionSeasons.competitionId, competitionId),
        inArray(competitionSeasons.year, [currentYear - 1, currentYear]),
      ),
    );
}

async function migrateStandingRowsToSeason(fromSeasonId: string, toSeasonId: string) {
  await migrateSeasonId(fromSeasonId, toSeasonId);
}

export async function normalizeCompetitionSeasonLabels(competitionId: string) {
  await mergeDuplicateCompetitionSeasons(competitionId);
}

async function mergeDuplicateCompetitionSeasons(competitionId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));

  const byYear = new Map<number, Array<(typeof rows)[number]>>();
  for (const row of rows) {
    if (row.isDeprecated) continue;
    const year = row.year ?? parseSeasonStartYear(row.label);
    if (year == null) continue;
    const list = byYear.get(year) ?? [];
    list.push(row);
    byYear.set(year, list);
  }

  for (const [year, list] of byYear) {
    const canonical = formatSeasonRangeLabel(year);
    const slug = seasonSlugFromStartYear(year);

    if (list.length === 1) {
      const [single] = list;
      if (single.label !== canonical || single.year !== year || single.slug !== slug) {
        await db
          .update(competitionSeasons)
          .set({ label: canonical, slug, year, isDeprecated: false })
          .where(eq(competitionSeasons.id, single.id));
      }
      continue;
    }

    const ranked = await Promise.all(
      list.map(async (row) => {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(standingRows)
          .where(eq(standingRows.seasonId, row.id));
        const standingsCount = Number(countRow?.count ?? 0);
        return {
          row,
          standingsCount,
          score: canonicalSeasonPickerScore({
            label: row.label,
            originalLabel: row.label,
            slug: row.slug,
            isActive: row.isActive,
            standingsCount,
          }),
        };
      }),
    );
    ranked.sort(
      (a, b) =>
        b.score - a.score ||
        b.standingsCount - a.standingsCount ||
        a.row.label.localeCompare(b.row.label),
    );
    const keeper = ranked[0]!.row;

    for (const { row } of ranked.slice(1)) {
      await migrateStandingRowsToSeason(row.id, keeper.id);
      await db
        .update(competitionSeasons)
        .set({ isDeprecated: true })
        .where(eq(competitionSeasons.id, row.id));
      console.info(
        `[season-dedup] Deprecated duplicate season ${row.label} (${row.id}) → canonical ${canonical} (${keeper.id})`,
      );
      await db.delete(competitionSeasons).where(eq(competitionSeasons.id, row.id));
    }

    await db
      .update(competitionSeasons)
      .set({ label: canonical, slug, year, isDeprecated: false })
      .where(eq(competitionSeasons.id, keeper.id));
  }
}

export type DuplicateSeasonReportRow = {
  competitionId: string;
  year: number;
  canonicalLabel: string;
  seasons: Array<{
    id: string;
    label: string;
    slug: string;
    standingsCount: number;
    isDeprecated: boolean;
    score: number;
  }>;
};

export async function reportDuplicateCompetitionSeasons(
  competitionId: string,
): Promise<DuplicateSeasonReportRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));

  const byYear = new Map<number, DuplicateSeasonReportRow>();
  for (const row of rows) {
    const year = row.year ?? parseSeasonStartYear(row.label);
    if (year == null) continue;
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(standingRows)
      .where(eq(standingRows.seasonId, row.id));
    const standingsCount = Number(countRow?.count ?? 0);
    const entry =
      byYear.get(year) ??
      ({
        competitionId,
        year,
        canonicalLabel: formatSeasonRangeLabel(year),
        seasons: [],
      } satisfies DuplicateSeasonReportRow);
    entry.seasons.push({
      id: row.id,
      label: row.label,
      slug: row.slug,
      standingsCount,
      isDeprecated: row.isDeprecated,
      score: canonicalSeasonPickerScore({
        label: row.label,
        slug: row.slug,
        isActive: row.isActive,
        standingsCount,
      }),
    });
    byYear.set(year, entry);
  }

  return [...byYear.values()]
    .filter((entry) => entry.seasons.length > 1)
    .sort((a, b) => b.year - a.year);
}

export async function syncDomesticSeasonCatalog(competitionId: string, referenceDate = new Date()) {
  const competition = await getCompetitionById(competitionId);
  if (!competition || !usesDomesticSeasonCatalogForCompetition(competition.slug, competition.competitionType)) {
    return;
  }

  await mergeDuplicateCompetitionSeasons(competitionId);

  const currentYear = currentDomesticSeasonStartYear(referenceDate);
  const catalog = buildDomesticSeasonCatalog(undefined, currentYear);

  for (const season of catalog) {
    await upsertSeason({
      competitionId,
      label: season.label,
      ...(season.year === currentYear ? { isActive: true } : {}),
    });
  }

  const db = getDb();
  await db
    .update(competitionSeasons)
    .set({ isActive: false })
    .where(and(eq(competitionSeasons.competitionId, competitionId), ne(competitionSeasons.year, currentYear)));
  await db
    .update(competitionSeasons)
    .set({ isActive: true })
    .where(and(eq(competitionSeasons.competitionId, competitionId), eq(competitionSeasons.year, currentYear)));
}

export type StandingView = "overall" | "home" | "away";

type ResolvedCompetitionSeason = {
  seasons: Array<typeof competitionSeasons.$inferSelect & { year: number }>;
  season: (typeof competitionSeasons.$inferSelect & { year: number }) | null;
};

async function resolveCompetitionSeason(
  competitionId: string,
  seasonLabel?: string,
): Promise<ResolvedCompetitionSeason> {
  const db = getDb();
  const rawSeasons = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId))
    .orderBy(desc(competitionSeasons.year));

  const activeSeasons = rawSeasons.filter((row) => !row.isDeprecated);
  const seasons = dedupeSeasonsByYear(
    activeSeasons.map((row) => ({
      ...row,
      year: row.year ?? parseSeasonStartYear(row.label) ?? 0,
    })),
  );

  if (!seasons.length) return { seasons: [], season: null };

  const normalizedLabel = seasonLabel ? normalizeSeasonLabel(seasonLabel) : null;
  const requestedYear = seasonLabel ? parseSeasonStartYear(seasonLabel) : null;
  const season =
    (seasonLabel
      ? seasons.find((s) => s.label === seasonLabel) ??
        (normalizedLabel ? seasons.find((s) => s.label === normalizedLabel) : null) ??
        (requestedYear != null ? seasons.find((s) => s.year === requestedYear) : null) ??
        activeSeasons.find((s) => s.label === seasonLabel) ??
        null
      : null) ??
    seasons.find((s) => s.isActive) ??
    seasons[0] ??
    null;

  return { seasons, season };
}

export async function getSeasonStandings(seasonId: string, view: StandingView = "overall") {
  const db = getDb();
  const rows = await db
    .select({
      id: standingRows.id,
      rank: standingRows.rank,
      played: standingRows.played,
      won: standingRows.won,
      draw: standingRows.draw,
      lost: standingRows.lost,
      pointsFor: standingRows.pointsFor,
      pointsAgainst: standingRows.pointsAgainst,
      pointsDiff: standingRows.pointsDiff,
      bonusPoints: standingRows.bonusPoints,
      tryBonusPoints: standingRows.tryBonusPoints,
      losingBonusPoints: standingRows.losingBonusPoints,
      points: standingRows.points,
      form: standingRows.form,
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      teamShortName: teams.shortName,
    })
    .from(standingRows)
    .innerJoin(teams, eq(standingRows.teamId, teams.id))
    .where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, view)))
    .orderBy(asc(standingRows.rank));

  return rows;
}

export async function getCompetitionStandingsBySlug(
  slug: string,
  options: { seasonLabel?: string; view?: StandingView } = {},
) {
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return null;

  if (usesDomesticSeasonCatalogForCompetition(competition.slug, competition.competitionType)) {
    await syncDomesticSeasonCatalog(competition.id);
    await normalizeCompetitionSeasonLabels(competition.id);
  }

  const { seasons, season } = await resolveCompetitionSeason(competition.id, options.seasonLabel);
  const pickerSeasons = decorateSeasonPickerRows(seasons);

  if (!seasons.length) {
    return {
      competition,
      seasons: pickerSeasons,
      season: null,
      standings: [],
      champion: null,
      playoffFixtures: [],
      playedMismatch: false,
    };
  }

  const view = options.view ?? "overall";
  const standings = season ? await getSeasonStandings(season.id, view) : [];
  const champion = season ? await resolveSeasonChampion(competition.slug, season) : null;
  const playoffFixtures = season ? await listPlayoffFixtures(competition.id, season) : [];
  const playedCounts = new Set(standings.map((row) => row.played).filter((played) => played > 0));
  const playedMismatch = playedCounts.size > 1;

  return {
    competition,
    seasons: pickerSeasons,
    season,
    standings,
    champion,
    playoffFixtures,
    playedMismatch,
  };
}

export type CompetitionFixtureRow = {
  id: string;
  slug: string;
  kickoffAt: Date | null;
  status: string;
  round: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  venueName: string | null;
  planetRugbyUrl: string | null;
};

export async function listCompetitionFixtures(
  competitionId: string,
  options: {
    seasonLabel?: string;
    type?: "fixtures" | "results" | "all";
  } = {},
): Promise<CompetitionFixtureRow[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(fixtures)
    .where(eq(fixtures.competitionId, competitionId))
    .orderBy(desc(fixtures.kickoffAt));

  const teamRows = await db.select().from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

  const { season } = await resolveCompetitionSeason(competitionId, options.seasonLabel);
  const seasonYear = season?.year ?? (options.seasonLabel ? parseSeasonStartYear(options.seasonLabel) : null);
  const competition = await getCompetitionById(competitionId);
  const seasonKind = seasonKindFromCompetitionType(competition?.competitionType);

  const type = options.type ?? "all";

  return rows
    .filter((f) => {
      if (season && seasonYear != null) {
        if (
          !fixtureBelongsToSeason({
            fixtureSeasonId: f.seasonId,
            kickoffAt: f.kickoffAt,
            seasonId: season.id,
            seasonYear,
            seasonKind,
          })
        ) {
          return false;
        }
      }
      if (type === "results") {
        return f.status === "full_time" || f.status === "live";
      }
      if (type === "fixtures") {
        return f.status === "scheduled" || f.status === "postponed" || f.status === "cancelled";
      }
      return true;
    })
    .map((f) => ({
      id: f.id,
      slug: f.slug,
      kickoffAt: f.kickoffAt,
      status: f.status,
      round: f.round,
      homeTeam: f.homeTeamId ? (teamById[f.homeTeamId] ?? null) : null,
      awayTeam: f.awayTeamId ? (teamById[f.awayTeamId] ?? null) : null,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      venueName: f.venueName,
      planetRugbyUrl: f.planetRugbyUrl,
    }));
}

export async function listPlayoffFixtures(
  competitionId: string,
  season: { id?: string; year: number; label?: string },
): Promise<CompetitionFixtureRow[]> {
  const db = getDb();

  if (season.id) {
    const teamRows = await db.select().from(teams);
    const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));
    const rows = await db
      .select()
      .from(fixtures)
      .where(
        and(
          eq(fixtures.competitionId, competitionId),
          eq(fixtures.seasonId, season.id),
          sql`${fixtures.stage} <> 'regular'`,
        ),
      )
      .orderBy(asc(fixtures.kickoffAt));

    if (rows.length) {
      return rows.map((f) => ({
        id: f.id,
        slug: f.slug,
        kickoffAt: f.kickoffAt,
        status: f.status,
        round: f.round ?? f.stage,
        homeTeam: f.homeTeamId ? (teamById[f.homeTeamId] ?? null) : null,
        awayTeam: f.awayTeamId ? (teamById[f.awayTeamId] ?? null) : null,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        venueName: f.venueName,
        planetRugbyUrl: f.planetRugbyUrl,
      }));
    }
  }

  const all = await listCompetitionFixtures(competitionId, {
    seasonLabel: season.label ?? String(season.year),
    type: "all",
  });
  return all
    .filter((fixture) => isPlayoffRound(fixture.round))
    .sort((a, b) => {
      const aTime = a.kickoffAt?.getTime() ?? 0;
      const bTime = b.kickoffAt?.getTime() ?? 0;
      return aTime - bTime;
    });
}

async function resolveSeasonChampion(
  competitionSlug: string,
  season: { id: string; label: string; championTeamId?: string | null },
) {
  const db = getDb();
  if (season.championTeamId) {
    const [team] = await db.select().from(teams).where(eq(teams.id, season.championTeamId)).limit(1);
    if (team) {
      return {
        winner: team.name,
        label: season.label,
        wikipediaUrl: undefined as string | undefined,
        teamId: team.id,
      };
    }
  }

  const catalog = lookupCompetitionChampion(competitionSlug, season.label);
  if (!catalog) return null;
  return {
    winner: catalog.winner,
    label: catalog.label,
    wikipediaUrl: catalog.wikipediaUrl,
    teamId: null as string | null,
  };
}

export async function getCompetitionHubBySlug(
  slug: string,
  options: { seasonLabel?: string; view?: StandingView } = {},
) {
  const standingsData = await getCompetitionStandingsBySlug(slug, options);
  if (!standingsData) return null;

  const seasonLabel = options.seasonLabel ?? standingsData.season?.label;
  const fixtureList = await listCompetitionFixtures(standingsData.competition.id, {
    seasonLabel,
    type: "all",
  });
  const results = fixtureList.filter((f) => f.status === "full_time" || f.status === "live");
  const upcoming = fixtureList.filter(
    (f) => f.status === "scheduled" || f.status === "postponed",
  );

  return {
    ...standingsData,
    fixtures: upcoming,
    results,
    allMatches: fixtureList,
  };
}
