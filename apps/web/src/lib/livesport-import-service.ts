import { and, eq } from "drizzle-orm";
import {
  previewLiveSportTournament,
  resolveLiveSportSeasonUrl,
  type LiveSportMatchRow,
  type LiveSportStandingRow,
  type LiveSportTournamentPreview,
} from "@rugby365/import-sdk";
import { competitionSeasons, competitions, fixtures, standingRows } from "@rugby365/db";
import {
  cmsSlugFromLiveSportSlug,
  competitionTypeFromLiveSportSlug,
  liveSportDisplayName,
  liveSportPresetForSlug,
} from "./livesport-import-presets";
import type { ImportProgressReporter } from "./import-progress-types";
import { getCompetitionBySlug, upsertSeason } from "./competition-admin-service";
import { getDb } from "./db";
import { currentDomesticSeasonStartYear, parseSeasonStartYear } from "./season-label-utils";
import { resolveCompetition, resolveTeam } from "./entity-resolve-service";
import {
  createFixture,
  findFixtureByExternalMatchId,
  findFixtureBySlug,
  buildFixtureSlug,
  updateFixture,
} from "./fixture-admin-service";

export const LIVESPORT_PROVIDER = "livesport";

function livesportExternalId(matchId: string) {
  return `livesport:${matchId}`;
}

function fixtureStatus(status: LiveSportMatchRow["status"]) {
  if (status === "full_time") return "full_time";
  if (status === "live") return "live";
  return "scheduled";
}

function liveSportScoreUpdate(
  row: LiveSportMatchRow,
  existing: { homeScore: number | null; awayScore: number | null } | null,
  isResult: boolean,
) {
  if (!isResult) return {};
  return {
    homeScore: row.homeScore ?? existing?.homeScore ?? 0,
    awayScore: row.awayScore ?? existing?.awayScore ?? 0,
  };
}

function buildLiveSportFixtureSlug(home: string, away: string, kickoffAt: string | null, competitionName?: string | null) {
  return buildFixtureSlug({
    homeSlug: home,
    awaySlug: away,
    kickoffAt,
    competitionName,
    format: "teams-date",
  });
}

async function ensureCompetition(meta: LiveSportTournamentPreview["meta"]) {
  const cmsSlug = cmsSlugFromLiveSportSlug(meta.competitionSlug);
  const preset = liveSportPresetForSlug(meta.competitionSlug);
  const displayName = liveSportDisplayName(meta.competitionSlug) ?? meta.competitionName;
  const bySlug = (await getCompetitionBySlug(cmsSlug)) ?? (await getCompetitionBySlug(meta.competitionSlug));
  const competition = await resolveCompetition({
    name: displayName,
    externalProviderId: meta.tournamentId ?? bySlug?.externalProviderId ?? undefined,
    stageExternalId: meta.seasonTournamentId ?? meta.tournamentId ?? undefined,
    sourceProvider: LIVESPORT_PROVIDER,
  });
  if (!competition) throw new Error("Could not resolve competition");

  const db = getDb();
  const [updated] = await db
    .update(competitions)
    .set({
      competitionType: preset?.type ?? competitionTypeFromLiveSportSlug(meta.competitionSlug),
      slug: cmsSlug,
      planetRugbySlug: cmsSlug,
      name: displayName,
    })
    .where(eq(competitions.id, competition.id))
    .returning();

  return updated ?? competition;
}

async function upsertStandingRows(seasonId: string, rows: LiveSportStandingRow[]) {
  const db = getDb();
  await db.delete(standingRows).where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, "overall")));
  const syncedAt = new Date();
  let upserted = 0;

  for (const row of rows) {
    const team = await resolveTeam({
      name: row.teamName,
      createIfMissing: true,
      sourceProvider: LIVESPORT_PROVIDER,
    });
    if (!team) continue;

    await db.insert(standingRows).values({
      seasonId,
      teamId: team.id,
      view: "overall",
      rank: row.rank,
      played: row.played,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointsDiff: row.pointsDiff,
      bonusPoints: 0,
      points: row.points,
      form: null,
      syncedAt,
    });
    upserted += 1;
  }

  await db.update(competitionSeasons).set({ syncedAt, sourceProvider: LIVESPORT_PROVIDER }).where(eq(competitionSeasons.id, seasonId));
  return upserted;
}

async function upsertLiveSportMatch(
  row: LiveSportMatchRow,
  competition: { id: string; name: string },
  seasonId: string,
) {
  const homeTeam = await resolveTeam({
    name: row.homeTeam,
    createIfMissing: true,
    sourceProvider: LIVESPORT_PROVIDER,
  });
  const awayTeam = await resolveTeam({
    name: row.awayTeam,
    createIfMissing: true,
    sourceProvider: LIVESPORT_PROVIDER,
  });
  if (!homeTeam || !awayTeam) {
    return { outcome: "skipped" as const, matchId: row.matchId };
  }

  const externalMatchId = livesportExternalId(row.matchId);
  const status = fixtureStatus(row.status);
  const slug = buildLiveSportFixtureSlug(row.homeTeam, row.awayTeam, row.kickoffAt, competition.name);
  const existing =
    (await findFixtureByExternalMatchId(externalMatchId)) ?? (await findFixtureBySlug(slug));
  const isResult = status === "full_time";

  if (existing) {
    await updateFixture(existing.id, {
      competitionId: competition.id,
      competitionName: competition.name,
      kickoffAt: row.kickoffAt,
      status,
      externalMatchId,
      round: row.round ?? undefined,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    });

    const db = getDb();
    await db
      .update(fixtures)
      .set({
        ...liveSportScoreUpdate(row, existing, isResult),
        providerSnapshot: {
          livesport: {
            matchId: row.matchId,
            sourceUrl: row.sourceUrl,
            seasonId,
          },
        },
      })
      .where(eq(fixtures.id, existing.id));

    return { outcome: "updated" as const, fixtureId: existing.id, matchId: row.matchId };
  }

  await createFixture({
    slug,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    competitionId: competition.id,
    competitionName: competition.name,
    kickoffAt: row.kickoffAt,
    status,
    externalMatchId,
    round: row.round,
  });

  const created = await findFixtureByExternalMatchId(externalMatchId);
  if (created && isResult) {
    const db = getDb();
    await db
      .update(fixtures)
      .set({
        ...liveSportScoreUpdate(row, created, isResult),
        providerSnapshot: {
          livesport: {
            matchId: row.matchId,
            sourceUrl: row.sourceUrl,
            seasonId,
          },
        },
      })
      .where(eq(fixtures.id, created.id));
  } else if (created) {
    const db = getDb();
    await db
      .update(fixtures)
      .set({
        providerSnapshot: {
          livesport: {
            matchId: row.matchId,
            sourceUrl: row.sourceUrl,
            seasonId,
          },
        },
      })
      .where(eq(fixtures.id, created.id));
  }

  return { outcome: "created" as const, fixtureId: created?.id, matchId: row.matchId };
}

export async function previewLiveSportImport(sourceUrl: string, seasonLabel?: string) {
  return previewLiveSportTournament(sourceUrl, { seasonLabel });
}

export async function importFromLiveSportTournamentUrl(
  sourceUrl: string,
  options: {
    seasonLabel?: string;
    importFixtures?: boolean;
    importResults?: boolean;
    syncStandings?: boolean;
    onProgress?: ImportProgressReporter;
  } = {},
) {
  options.onProgress?.({
    phase: "download",
    message: "Downloading season data from LiveSport…",
    progress: 8,
  });
  const preview = await previewLiveSportTournament(sourceUrl, {
    seasonLabel: options.seasonLabel,
  });

  const competition = await ensureCompetition(preview.meta);
  const seasonStartYear = parseSeasonStartYear(preview.meta.seasonLabel);
  const isCurrentSeason =
    seasonStartYear != null && seasonStartYear === currentDomesticSeasonStartYear();
  const season = await upsertSeason({
    competitionId: competition.id,
    label: preview.meta.seasonLabel,
    isActive: isCurrentSeason,
  });

  const importFixtures = options.importFixtures ?? true;
  const importResults = options.importResults ?? true;
  const syncStandings = options.syncStandings ?? true;

  const selectedMatches = preview.matches.filter((row) => {
    if (row.status === "full_time") return importResults;
    return importFixtures;
  });
  const matchTotal = selectedMatches.length;

  const fixtureResults = [];
  for (const [index, row] of selectedMatches.entries()) {
    if (options.onProgress && (index === 0 || index % 10 === 0 || index === matchTotal - 1)) {
      options.onProgress({
        phase: "matches",
        message:
          matchTotal > 0
            ? `Saving matches (${index + 1} of ${matchTotal})…`
            : "Saving matches…",
        progress: matchTotal > 0 ? 15 + Math.round((index / matchTotal) * 70) : 40,
        matchesProcessed: index + 1,
        matchesTotal: matchTotal,
        seasonLabel: preview.meta.seasonLabel,
      });
    }
    fixtureResults.push(await upsertLiveSportMatch(row, competition, season.id));
  }

  options.onProgress?.({
    phase: "standings",
    message: "Building league table from results…",
    progress: 90,
    seasonLabel: preview.meta.seasonLabel,
  });

  const standingsRows = syncStandings
    ? await upsertStandingRows(season.id, preview.standings)
    : 0;

  options.onProgress?.({
    phase: "complete",
    message: "Import complete",
    progress: 100,
    seasonLabel: preview.meta.seasonLabel,
  });

  return {
    competitionId: competition.id,
    competitionSlug: competition.slug,
    seasonId: season.id,
    competitionName: competition.name,
    seasonLabel: preview.meta.seasonLabel,
    sourceUrl: preview.meta.sourceUrl,
    matchesSeen: preview.matches.length,
    created: fixtureResults.filter((row) => row.outcome === "created").length,
    updated: fixtureResults.filter((row) => row.outcome === "updated").length,
    skipped: fixtureResults.filter((row) => row.outcome === "skipped").length,
    standingsRows,
    fixtureCount: preview.matches.filter((row) => row.status !== "full_time").length,
    resultCount: preview.matches.filter((row) => row.status === "full_time").length,
    tableRowCount: preview.standings.length,
  };
}

export { resolveLiveSportSeasonUrl };
