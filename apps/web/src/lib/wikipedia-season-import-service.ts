import { and, eq, sql } from "drizzle-orm";
import {
  parseWikipediaSeasonPage,
  type WikipediaFixtureRow,
  type WikipediaSeasonPageParse,
  type WikipediaStandingRow,
} from "@rugby365/import-sdk";
import { competitionSeasons, fixtures, standingRows, teams } from "@rugby365/db";
import { getCompetitionBySlug, upsertSeason } from "./competition-admin-service";
import { getDb } from "./db";
import { resolveReferee } from "./entity-admin-service";
import { resolveTeam } from "./entity-resolve-service";
import {
  createFixture,
  findFixtureByExternalMatchId,
  findFixtureBySlug,
  updateFixture,
} from "./fixture-admin-service";
import { buildFixtureSlug } from "./fixture-slug";
import { formatSeasonRangeLabel } from "./season-label-utils";
import { canonicalPremiershipTeamName } from "./transfer-match-service";
import { resolveVenue } from "./venue-admin-service";
import {
  PREMIERSHIP_CHAMPIONS,
  CHALLENGE_CUP_CHAMPIONS,
  CHAMPIONS_CUP_CHAMPIONS,
  RUGBY_CHAMPIONSHIP_CHAMPIONS,
  CURRIE_CUP_CHAMPIONS,
  SIX_NATIONS_CHAMPIONS,
  RUGBY_WORLD_CUP_CHAMPIONS,
  RUGBY_EUROPE_CHAMPIONSHIP_CHAMPIONS,
  END_OF_YEAR_INTERNATIONALS_SEASONS,
  AUTUMN_NATIONS_CUP_SEASONS,
  TOP_14_CHAMPIONS,
  SUPER_RUGBY_CHAMPIONS,
  RFU_CHAMPIONSHIP_CHAMPIONS,
  NATIONS_CHAMPIONSHIP_SEASONS,
  WORLD_RUGBY_NATIONS_CUP_SEASONS,
  NPC_CHAMPIONS,
} from "./competition-champions-catalog";
import { isJunkTeamName, normalizeTeamName } from "./entity-normalize";
import { formatSeasonLabelForKind } from "./season-label-utils";

export const WIKIPEDIA_SEASON_PROVIDER = "wikipedia";

export type WikipediaSeasonImportOptions = {
  competitionSlug?: string;
  seasonStartYear?: number;
  mode?: "fill_missing" | "update_existing";
  importTable?: boolean;
  importFixtures?: boolean;
  importPlayoffs?: boolean;
  importWinner?: boolean;
  importAttendance?: boolean;
  createMissingTeams?: boolean;
};

export type WikipediaSeasonImportCounts = {
  found: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type WikipediaSeasonImportReport = {
  pageTitle: string;
  wikipediaUrl: string;
  revisionId: number | null;
  seasonLabel: string;
  seasonId: string;
  competitionId: string;
  championName: string | null;
  championTeamId: string | null;
  warnings: string[];
  table: WikipediaSeasonImportCounts;
  fixtures: WikipediaSeasonImportCounts;
  playoffs: WikipediaSeasonImportCounts;
  attendance: WikipediaSeasonImportCounts;
  venues: WikipediaSeasonImportCounts;
  referees: WikipediaSeasonImportCounts;
  unmappedTeams: string[];
};

function wikipediaSeasonKind(competitionSlug: string, competitionType: string): "club" | "international" | "tournament" {
  if (competitionSlug.startsWith("currie-cup") || competitionSlug === "super-rugby" || competitionSlug === "npc" || competitionSlug.startsWith("npc-")) {
    return "international";
  }
  if (
    competitionSlug === "rugby-championship" ||
    competitionSlug === "six-nations" ||
    competitionSlug === "nations-championship" ||
    competitionSlug === "international" ||
    competitionSlug === "international-matches-n062z68w" ||
    competitionSlug === "rugby-europe-championship" ||
    competitionSlug === "end-of-year-internationals" ||
    competitionSlug === "autumn-nations-cup" ||
    competitionSlug.startsWith("autumn-nations-cup") ||
    competitionType === "international" ||
    competitionType === "world_cup"
  ) {
    return competitionType === "world_cup" || competitionSlug === "rugby-world-cup"
      ? "tournament"
      : "international";
  }
  return "club";
}

function emptyCounts(found = 0): WikipediaSeasonImportCounts {
  return { found, created: 0, updated: 0, skipped: 0, errors: 0 };
}

function wikiExternalId(pageTitle: string, row: WikipediaFixtureRow): string {
  const day = row.date ?? "undated";
  const home = row.homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  const away = row.awayTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24);
  return `wikipedia:${pageTitle}:${day}:${home}-v-${away}:${row.stage}`;
}

function shortSlug(input: {
  homeSlug: string;
  awaySlug: string;
  kickoffAt: string | null;
}): string {
  const built = buildFixtureSlug({
    homeSlug: input.homeSlug,
    awaySlug: input.awaySlug,
    kickoffAt: input.kickoffAt,
    format: "teams-date",
  });
  if (built.length <= 80) return built;
  const home = input.homeSlug.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 18);
  const away = input.awaySlug.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 18);
  const day = input.kickoffAt?.slice(0, 10) ?? "undated";
  return `${home}-v-${away}-${day}`.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function resolveSeasonTeam(
  name: string,
  createIfMissing: boolean,
  competitionSlug: string,
) {
  const cleaned = name
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:st|nd|rd|th)\s+title\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || isJunkTeamName(cleaned)) return null;
  const canonical =
    competitionSlug === "premiership"
      ? canonicalPremiershipTeamName(cleaned)
      : normalizeTeamName(cleaned);
  if (!canonical || isJunkTeamName(canonical)) return null;
  return resolveTeam({
    name: canonical,
    createIfMissing,
    sourceProvider: WIKIPEDIA_SEASON_PROVIDER,
  });
}

async function findExistingFixture(input: {
  externalMatchId: string;
  competitionId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string | null;
  slug: string;
}) {
  const byExternal = await findFixtureByExternalMatchId(input.externalMatchId);
  if (byExternal) return byExternal;
  const bySlug = await findFixtureBySlug(input.slug);
  if (bySlug) return bySlug;

  if (!input.kickoffAt) return null;
  const db = getDb();
  const day = input.kickoffAt.slice(0, 10);
  const [row] = await db
    .select()
    .from(fixtures)
    .where(
      and(
        eq(fixtures.competitionId, input.competitionId),
        eq(fixtures.seasonId, input.seasonId),
        eq(fixtures.homeTeamId, input.homeTeamId),
        eq(fixtures.awayTeamId, input.awayTeamId),
        sql`(${fixtures.kickoffAt})::date = ${day}::date`,
      ),
    )
    .limit(1);
  return row ?? null;
}

function pickBetterNumber(existing: number | null | undefined, incoming: number | null | undefined, mode: string) {
  if (incoming == null) return existing ?? null;
  if (mode === "update_existing") return incoming;
  if (existing == null || existing === 0) return incoming;
  return existing;
}

function pickBetterString(existing: string | null | undefined, incoming: string | null | undefined, mode: string) {
  if (!incoming) return existing ?? null;
  if (mode === "update_existing") return incoming;
  if (!existing) return incoming;
  return existing;
}

async function upsertFixtureFromWiki(input: {
  row: WikipediaFixtureRow;
  competition: { id: string; name: string; slug: string };
  seasonId: string;
  pageTitle: string;
  mode: "fill_missing" | "update_existing";
  importAttendance: boolean;
  createMissingTeams: boolean;
  counts: WikipediaSeasonImportCounts;
  attendanceCounts: WikipediaSeasonImportCounts;
  venueCounts: WikipediaSeasonImportCounts;
  refereeCounts: WikipediaSeasonImportCounts;
  unmappedTeams: Set<string>;
}) {
  const homeTeam = await resolveSeasonTeam(input.row.homeTeam, input.createMissingTeams, input.competition.slug);
  const awayTeam = await resolveSeasonTeam(input.row.awayTeam, input.createMissingTeams, input.competition.slug);
  if (!homeTeam || !awayTeam) {
    if (!homeTeam) input.unmappedTeams.add(input.row.homeTeam);
    if (!awayTeam) input.unmappedTeams.add(input.row.awayTeam);
    input.counts.skipped += 1;
    return;
  }

  const externalMatchId = wikiExternalId(input.pageTitle, input.row);
  const slug = shortSlug({
    homeSlug: homeTeam.slug,
    awaySlug: awayTeam.slug,
    kickoffAt: input.row.kickoffAt,
  });

  let venueId: string | null = null;
  if (input.row.venueName) {
    input.venueCounts.found += 1;
    const venue = await resolveVenue({
      name: input.row.venueName,
      teamId: homeTeam.id,
      createIfMissing: false,
    });
    if (venue) {
      venueId = venue.id;
      input.venueCounts.updated += 1;
    } else {
      input.venueCounts.skipped += 1;
    }
  }

  let refereeId: string | null = null;
  if (input.row.refereeName) {
    input.refereeCounts.found += 1;
    try {
      const referee = await resolveReferee({
        name: input.row.refereeName,
        createIfMissing: true,
      });
      if (referee) {
        refereeId = referee.id;
        input.refereeCounts.created += 1;
      } else {
        input.refereeCounts.skipped += 1;
      }
    } catch {
      const existingRef = await resolveReferee({
        name: input.row.refereeName,
        createIfMissing: false,
      });
      refereeId = existingRef?.id ?? null;
      input.refereeCounts.skipped += 1;
    }
  }

  const existing = await findExistingFixture({
    externalMatchId,
    competitionId: input.competition.id,
    seasonId: input.seasonId,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    kickoffAt: input.row.kickoffAt,
    slug,
  });

  const db = getDb();
  const scoreReady = input.row.homeScore != null && input.row.awayScore != null;

  if (existing) {
    const attendance =
      input.importAttendance
        ? pickBetterNumber(existing.attendance, input.row.attendance, input.mode)
        : existing.attendance;
    if (input.importAttendance && input.row.attendance != null && (existing.attendance == null || existing.attendance === 0)) {
      input.attendanceCounts.updated += 1;
    } else if (input.importAttendance && input.row.attendance != null) {
      input.attendanceCounts.skipped += 1;
    }

    await updateFixture(existing.id, {
      competitionId: input.competition.id,
      competitionName: input.competition.name,
      kickoffAt: pickBetterString(existing.kickoffAt?.toISOString() ?? null, input.row.kickoffAt, input.mode),
      status: input.mode === "update_existing" || existing.status === "scheduled" ? input.row.status : existing.status,
      externalMatchId: existing.externalMatchId ?? externalMatchId,
      venueId: existing.venueId ?? venueId,
      attendance,
      refereeId: existing.refereeId ?? refereeId,
      round: pickBetterString(existing.round, input.row.round, input.mode),
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    });

    await db
      .update(fixtures)
      .set({
        seasonId: input.seasonId,
        stage: input.row.stage,
        ...(scoreReady
          ? {
              homeScore:
                input.mode === "update_existing" || !existing.homeScore
                  ? input.row.homeScore!
                  : existing.homeScore,
              awayScore:
                input.mode === "update_existing" || !existing.awayScore
                  ? input.row.awayScore!
                  : existing.awayScore,
            }
          : {}),
        venueName: existing.venueName ?? input.row.venueName,
        refereeName: existing.refereeName ?? input.row.refereeName,
        providerSnapshot: {
          ...(typeof existing.providerSnapshot === "object" && existing.providerSnapshot
            ? (existing.providerSnapshot as object)
            : {}),
          wikipedia: {
            pageTitle: input.pageTitle,
            stage: input.row.stage,
            round: input.row.round,
            matchweek: input.row.matchweek,
            source: "wikipedia-season-import",
          },
        },
      })
      .where(eq(fixtures.id, existing.id));

    input.counts.updated += 1;
    return;
  }

  const created = await createFixture({
    slug,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    competitionId: input.competition.id,
    competitionName: input.competition.name,
    kickoffAt: input.row.kickoffAt,
    status: input.row.status,
    externalMatchId,
    venueId,
    attendance: input.importAttendance ? input.row.attendance : null,
    refereeId,
    round: input.row.round,
  });

  await db
    .update(fixtures)
    .set({
      seasonId: input.seasonId,
      stage: input.row.stage,
      homeScore: input.row.homeScore ?? 0,
      awayScore: input.row.awayScore ?? 0,
      venueName: input.row.venueName,
      refereeName: input.row.refereeName,
      providerSnapshot: {
        wikipedia: {
          pageTitle: input.pageTitle,
          stage: input.row.stage,
          round: input.row.round,
          matchweek: input.row.matchweek,
          source: "wikipedia-season-import",
        },
      },
    })
    .where(eq(fixtures.id, created!.id));

  input.counts.created += 1;
  if (input.importAttendance && input.row.attendance != null) input.attendanceCounts.created += 1;
}

/** Clamp wiki-parsed ints into PostgreSQL integer range (bad cells can explode). */
function clampStandingInt(value: number | null | undefined, fallback = 0): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  if (n > 2_147_483_647) return 2_147_483_647;
  if (n < -2_147_483_648) return -2_147_483_648;
  return n;
}

function standingRowValues(row: WikipediaStandingRow) {
  return {
    rank: clampStandingInt(row.rank),
    played: clampStandingInt(row.played),
    won: clampStandingInt(row.won),
    draw: clampStandingInt(row.draw),
    lost: clampStandingInt(row.lost),
    pointsFor: clampStandingInt(row.pointsFor),
    pointsAgainst: clampStandingInt(row.pointsAgainst),
    pointsDiff: clampStandingInt(row.pointsDiff),
    bonusPoints: clampStandingInt(row.bonusPoints),
    tryBonusPoints: clampStandingInt(row.tryBonusPoints),
    losingBonusPoints: clampStandingInt(row.losingBonusPoints),
    pointsDeduction: clampStandingInt(row.pointsDeduction),
    points: clampStandingInt(row.points),
  };
}

async function importStandings(
  seasonId: string,
  rows: WikipediaStandingRow[],
  mode: "fill_missing" | "update_existing",
  createMissingTeams: boolean,
  unmappedTeams: Set<string>,
  competitionSlug: string,
): Promise<WikipediaSeasonImportCounts> {
  const counts = emptyCounts(rows.length);
  const db = getDb();

  if (mode === "update_existing") {
    await db.delete(standingRows).where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, "overall")));
  }

  const syncedAt = new Date();
  for (const row of rows) {
    const team = await resolveSeasonTeam(row.teamName, createMissingTeams, competitionSlug);
    if (!team) {
      unmappedTeams.add(row.teamName);
      counts.skipped += 1;
      continue;
    }

    const values = standingRowValues(row);

    const [existing] = await db
      .select()
      .from(standingRows)
      .where(
        and(
          eq(standingRows.seasonId, seasonId),
          eq(standingRows.teamId, team.id),
          eq(standingRows.view, "overall"),
        ),
      )
      .limit(1);

    if (existing && mode === "fill_missing") {
      // Prefer Wikipedia completed table when existing looks incomplete / inconsistent.
      const shouldReplace =
        existing.played !== values.played ||
        existing.points !== values.points ||
        existing.rank !== values.rank;
      if (!shouldReplace) {
        counts.skipped += 1;
        continue;
      }
      await db
        .update(standingRows)
        .set({ ...values, syncedAt })
        .where(eq(standingRows.id, existing.id));
      counts.updated += 1;
      continue;
    }

    if (existing) {
      await db
        .update(standingRows)
        .set({ ...values, syncedAt })
        .where(eq(standingRows.id, existing.id));
      counts.updated += 1;
    } else {
      await db.insert(standingRows).values({
        seasonId,
        teamId: team.id,
        view: "overall",
        ...values,
        syncedAt,
      });
      counts.created += 1;
    }
  }

  return counts;
}

export async function analyseWikipediaSeasonPage(url: string): Promise<WikipediaSeasonPageParse> {
  return parseWikipediaSeasonPage(url);
}

export async function importWikipediaSeasonPage(
  url: string,
  options: WikipediaSeasonImportOptions = {},
): Promise<WikipediaSeasonImportReport> {
  const mode = options.mode ?? "update_existing";
  const createMissingTeams = options.createMissingTeams ?? false;
  const competitionSlug = options.competitionSlug ?? "premiership";
  const parsed = await parseWikipediaSeasonPage(url);

  const year = options.seasonStartYear ?? parsed.seasonStartYear;
  if (year == null) throw new Error(`Could not determine season year for ${url}`);

  const competition = await getCompetitionBySlug(competitionSlug);
  if (!competition) throw new Error(`Competition not found: ${competitionSlug}`);

  if (parsed.seasonStartYear != null && parsed.seasonStartYear !== year) {
    throw new Error(
      `Season mismatch — page year ${parsed.seasonStartYear} does not match requested ${year}`,
    );
  }

  const season = await upsertSeason({
    competitionId: competition.id,
    label: String(year),
    isActive: false,
    seasonKind: wikipediaSeasonKind(competition.slug, competition.competitionType ?? "domestic"),
  });

  const unmappedTeams = new Set<string>();
  const warnings = [...parsed.warnings];

  let table = emptyCounts(parsed.standings.length);
  if (options.importTable !== false) {
    table = await importStandings(
      season.id,
      parsed.standings,
      mode,
      createMissingTeams,
      unmappedTeams,
      competition.slug,
    );
  }

  const fixtureCounts = emptyCounts(parsed.fixtures.length);
  const playoffCounts = emptyCounts(parsed.playoffFixtures.length);
  const attendanceCounts = emptyCounts(
    [...parsed.fixtures, ...parsed.playoffFixtures].filter((f) => f.attendance != null).length,
  );
  const venueCounts = emptyCounts(parsed.venues.length);
  const refereeCounts = emptyCounts(parsed.referees.length);

  if (options.importFixtures !== false) {
    for (const row of parsed.fixtures) {
      try {
        await upsertFixtureFromWiki({
          row,
          competition: { id: competition.id, name: competition.name, slug: competition.slug },
          seasonId: season.id,
          pageTitle: parsed.pageTitle,
          mode,
          importAttendance: options.importAttendance !== false,
          createMissingTeams,
          counts: fixtureCounts,
          attendanceCounts,
          venueCounts,
          refereeCounts,
          unmappedTeams,
        });
      } catch (error) {
        fixtureCounts.errors += 1;
        warnings.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (options.importPlayoffs !== false) {
    for (const row of parsed.playoffFixtures) {
      try {
        await upsertFixtureFromWiki({
          row,
          competition: { id: competition.id, name: competition.name, slug: competition.slug },
          seasonId: season.id,
          pageTitle: parsed.pageTitle,
          mode,
          importAttendance: options.importAttendance !== false,
          createMissingTeams,
          counts: playoffCounts,
          attendanceCounts,
          venueCounts,
          refereeCounts,
          unmappedTeams,
        });
      } catch (error) {
        playoffCounts.errors += 1;
        warnings.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  let championTeamId: string | null = null;
  const championName = parsed.championName;
  if (options.importWinner !== false && championName) {
    const champion = await resolveSeasonTeam(championName, createMissingTeams, competition.slug);
    if (champion) {
      championTeamId = champion.id;
      const db = getDb();
      await db
        .update(competitionSeasons)
        .set({
          championTeamId: champion.id,
          wikipediaSourceUrl: parsed.wikipediaUrl,
          sourceProvider: WIKIPEDIA_SEASON_PROVIDER,
          syncedAt: new Date(),
        })
        .where(eq(competitionSeasons.id, season.id));
    } else {
      unmappedTeams.add(championName);
      warnings.push(`Champion not mapped: ${championName}`);
    }
  } else {
    const db = getDb();
    await db
      .update(competitionSeasons)
      .set({
        wikipediaSourceUrl: parsed.wikipediaUrl,
        sourceProvider: WIKIPEDIA_SEASON_PROVIDER,
        syncedAt: new Date(),
      })
      .where(eq(competitionSeasons.id, season.id));
  }

  // Regular season P reconciliation warning
  if (parsed.standings.length && parsed.fixtures.length) {
    const sumPlayed = parsed.standings.reduce((n, r) => n + r.played, 0);
    const expectedFx = sumPlayed / 2;
    const completedFx = parsed.fixtures.filter((f) => f.status === "full_time").length;
    if (Math.abs(expectedFx - completedFx) > 0.5) {
      warnings.push(
        `Table/fixture mismatch: sum(P)/2=${expectedFx}, completed regular fixtures=${completedFx}`,
      );
    }
  }

  return {
    pageTitle: parsed.pageTitle,
    wikipediaUrl: parsed.wikipediaUrl,
    revisionId: parsed.revisionId,
    seasonLabel: formatSeasonLabelForKind(
      year,
      wikipediaSeasonKind(competition.slug, competition.competitionType ?? "domestic"),
    ),
    seasonId: season.id,
    competitionId: competition.id,
    championName,
    championTeamId,
    warnings,
    table,
    fixtures: fixtureCounts,
    playoffs: playoffCounts,
    attendance: attendanceCounts,
    venues: venueCounts,
    referees: refereeCounts,
    unmappedTeams: [...unmappedTeams],
  };
}

export function premiershipWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return PREMIERSHIP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function challengeCupWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return CHALLENGE_CUP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function championsCupWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return CHAMPIONS_CUP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function rugbyChampionshipWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return RUGBY_CHAMPIONSHIP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function currieCupWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return CURRIE_CUP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function sixNationsWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return SIX_NATIONS_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function rugbyWorldCupWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return RUGBY_WORLD_CUP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function rugbyEuropeChampionshipWikipediaSeasonUrls(): Array<{
  startYear: number;
  url: string;
  winner: string;
}> {
  return RUGBY_EUROPE_CHAMPIONSHIP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function endOfYearInternationalsWikipediaSeasonUrls(): Array<{
  startYear: number;
  url: string;
  winner: string;
}> {
  return END_OF_YEAR_INTERNATIONALS_SEASONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function autumnNationsCupWikipediaSeasonUrls(): Array<{
  startYear: number;
  url: string;
  winner: string;
}> {
  return AUTUMN_NATIONS_CUP_SEASONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function top14WikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return TOP_14_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function superRugbyWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return SUPER_RUGBY_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function rfuChampionshipWikipediaSeasonUrls(): Array<{ startYear: number; url: string; winner: string }> {
  return RFU_CHAMPIONSHIP_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
    startYear: e.startYear,
    url: e.wikipediaUrl!,
    winner: e.winner,
  }));
}

export function wikipediaSeasonImportPresets(
  competitionSlug: string,
): Array<{ startYear: number; url: string; winner: string }> {
  if (competitionSlug === "challenge-cup") return challengeCupWikipediaSeasonUrls();
  if (competitionSlug === "rugby-champions-cup") return championsCupWikipediaSeasonUrls();
  if (competitionSlug === "rugby-championship") return rugbyChampionshipWikipediaSeasonUrls();
  if (competitionSlug === "currie-cup" || competitionSlug.startsWith("currie-cup")) {
    return currieCupWikipediaSeasonUrls();
  }
  if (competitionSlug === "six-nations") return sixNationsWikipediaSeasonUrls();
  if (competitionSlug === "rugby-world-cup") return rugbyWorldCupWikipediaSeasonUrls();
  if (competitionSlug === "rugby-europe-championship") {
    return rugbyEuropeChampionshipWikipediaSeasonUrls();
  }
  if (competitionSlug === "end-of-year-internationals") {
    return endOfYearInternationalsWikipediaSeasonUrls();
  }
  if (competitionSlug === "autumn-nations-cup" || competitionSlug.startsWith("autumn-nations-cup")) {
    return autumnNationsCupWikipediaSeasonUrls();
  }
  if (competitionSlug === "top-14") return top14WikipediaSeasonUrls();
  if (competitionSlug === "super-rugby") return superRugbyWikipediaSeasonUrls();
  if (competitionSlug === "championship") return rfuChampionshipWikipediaSeasonUrls();
  if (competitionSlug === "npc" || competitionSlug.startsWith("npc-")) {
    return NPC_CHAMPIONS.filter((e) => e.wikipediaUrl).map((e) => ({
      startYear: e.startYear,
      url: e.wikipediaUrl!,
      winner: e.winner,
    }));
  }
  if (competitionSlug === "nations-championship") {
    return NATIONS_CHAMPIONSHIP_SEASONS.filter((e) => e.wikipediaUrl).map((e) => ({
      startYear: e.startYear,
      url: e.wikipediaUrl!,
      winner: e.winner,
    }));
  }
  if (competitionSlug === "world-rugby-nations-cup") {
    return WORLD_RUGBY_NATIONS_CUP_SEASONS.filter((e) => e.wikipediaUrl).map((e) => ({
      startYear: e.startYear,
      url: e.wikipediaUrl!,
      winner: e.winner,
    }));
  }
  return premiershipWikipediaSeasonUrls();
}
