import {
  buildPlanetRugbyMatchUrl,
  combineKickoffIso,
  fetchSdmsFixtures,
  fetchSdmsResults,
  fetchSdmsSeasons,
  PlanetRugbyMatchPageAdapter,
  type SdmsFixtureRow,
} from "@rugby365/import-sdk";
import { eq } from "drizzle-orm";
import { fixtures } from "@rugby365/db";
import {
  createCompetition,
  getCompetitionById,
  getCompetitionBySlug,
  updateCompetition,
  upsertSeason,
} from "./competition-admin-service";
import { getDb } from "./db";
import { resolveTeam } from "./entity-resolve-service";
import {
  allocateUniqueFixtureSlug,
  createFixture,
  findFixtureBySdmsMatchId,
  findFixtureBySlug,
  buildFixtureSlug,
  normalizeSlug,
  updateFixture,
} from "./fixture-admin-service";
import { resolveVenue } from "./venue-admin-service";
import { syncCompetitionStandings } from "./standings-sync-service";
import { competitionTypeFromPresetSlug } from "./planet-rugby-import-presets";
import type { ImportProgressReporter } from "./import-progress-types";
import { enrichFixtureFromSdmsMatch } from "./planet-rugby-match-import-service";
import { SDMS_PROVIDER } from "./entity-resolve-service";

function sdmsStatusToFixtureStatus(status: string): string {
  if (status === "Result") return "full_time";
  if (status === "Fixture") return "scheduled";
  if (/half\s*time|halftime|^ht\b/i.test(status)) return "half_time";
  if (/live|first|second|in\s*play/i.test(status)) return "live";
  return "scheduled";
}

/** Persist SDMS scores for live/HT/FT — not only finished matches. */
function sdmsScoreFields(
  row: SdmsFixtureRow,
  existing?: { homeScore: number | null; awayScore: number | null } | null,
): { homeScore: number; awayScore: number } {
  return {
    homeScore:
      typeof row.home_team_score === "number"
        ? row.home_team_score
        : (existing?.homeScore ?? 0),
    awayScore:
      typeof row.away_team_score === "number"
        ? row.away_team_score
        : (existing?.awayScore ?? 0),
  };
}

function buildPlanetRugbyFixtureSlug(
  homeSlug: string,
  awaySlug: string,
  date: string,
  competitionName?: string | null,
): string {
  return buildFixtureSlug({
    homeSlug,
    awaySlug,
    kickoffAt: date,
    competitionName,
    format: "teams-date",
  });
}

function buildPlanetRugbyUrl(
  row: SdmsFixtureRow,
  competitionSlug: string,
  sdmsCompCode: string | null,
): string {
  return buildPlanetRugbyMatchUrl({
    match_external_id: row.match_id,
    competition_slug: competitionSlug,
    competition_external_id: row.competition_id ?? sdmsCompCode ?? "",
    home_team: row.home_team_slug,
    away_team: row.away_team_slug,
    match_date: row.date,
  });
}

export async function upsertSdmsFixtureRow(
  row: SdmsFixtureRow,
  competition: {
    id: string;
    name: string;
    planetRugbySlug: string | null;
    sdmsCompCode: string | null;
  },
): Promise<{ outcome: "created" | "updated" | "skipped"; fixtureId?: string; matchId: string }> {
  const homeTeam = await resolveTeam({
    name: row.home_team_name,
    externalProviderId: row.home_team_id,
    createIfMissing: true,
    sourceProvider: SDMS_PROVIDER,
    imageUrl: row.home_team_icon,
  });
  const awayTeam = await resolveTeam({
    name: row.away_team_name,
    externalProviderId: row.away_team_id,
    createIfMissing: true,
    sourceProvider: SDMS_PROVIDER,
    imageUrl: row.away_team_icon,
  });
  if (!homeTeam || !awayTeam) return { outcome: "skipped", matchId: row.match_id };

  const compSlug = competition.planetRugbySlug ?? "competition";
  const planetRugbyUrl = buildPlanetRugbyUrl(row, compSlug, competition.sdmsCompCode);
  const kickoffAt = combineKickoffIso(row.date, row.time);
  const status = sdmsStatusToFixtureStatus(row.status);
  const slug = buildPlanetRugbyFixtureSlug(
    row.home_team_slug,
    row.away_team_slug,
    row.date,
    row.competition_name ?? competition.name,
  );

  if (row.venue) {
    await resolveVenue({
      name: row.venue,
      createIfMissing: true,
      teamId: homeTeam.id,
    });
  }

  let existing = await findFixtureBySdmsMatchId(row.match_id);
  if (!existing) {
    existing = await findFixtureBySlug(slug);
  }

  if (existing) {
    // SDMS import always owns the Planet Rugby external id for this match.
    await updateFixture(existing.id, {
      competitionId: competition.id,
      competitionName: competition.name,
      kickoffAt,
      status,
      planetRugbyUrl,
      externalMatchId: row.match_id,
      round: row.round ?? undefined,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    });

    const db = getDb();
    await db
      .update(fixtures)
      .set({
        ...sdmsScoreFields(row, existing),
        venueName: row.venue ?? existing.venueName,
        round: row.round ?? existing.round,
        externalMatchId: row.match_id,
      })
      .where(eq(fixtures.id, existing.id));

    return { outcome: "updated", fixtureId: existing.id, matchId: row.match_id };
  }

  const uniqueSlug = await allocateUniqueFixtureSlug(slug);
  const created = await createFixture({
    slug: uniqueSlug,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    competitionId: competition.id,
    competitionName: competition.name,
    kickoffAt,
    status,
    planetRugbyUrl,
    externalMatchId: row.match_id,
    round: row.round ?? null,
  });

  const db = getDb();
  await db
    .update(fixtures)
    .set({
      ...sdmsScoreFields(row),
      venueName: row.venue ?? null,
    })
    .where(eq(fixtures.id, created.id));

  return { outcome: "created", fixtureId: created.id, matchId: row.match_id };
}

export type PlanetRugbyImportResult = {
  competitionId: string;
  seasonLabel: string;
  created: number;
  updated: number;
  skipped: number;
  standingsRows?: number;
  matchDetailsEnriched?: number;
  matchDetailsFailed?: number;
};

export type PlanetRugbyAllSeasonsImportResult = {
  competitionId: string;
  competitionSlug: string;
  seasonsImported: number;
  seasons: PlanetRugbyImportResult[];
  totals: {
    created: number;
    updated: number;
    skipped: number;
    matchDetailsEnriched: number;
    matchDetailsFailed: number;
  };
};

function sumSeasonTotals(seasons: PlanetRugbyImportResult[]) {
  return seasons.reduce(
    (acc, s) => ({
      created: acc.created + s.created,
      updated: acc.updated + s.updated,
      skipped: acc.skipped + s.skipped,
      matchDetailsEnriched: acc.matchDetailsEnriched + (s.matchDetailsEnriched ?? 0),
      matchDetailsFailed: acc.matchDetailsFailed + (s.matchDetailsFailed ?? 0),
    }),
    { created: 0, updated: 0, skipped: 0, matchDetailsEnriched: 0, matchDetailsFailed: 0 },
  );
}

export async function importPlanetRugbyCompetition(input: {
  competitionId?: string;
  competitionSlug?: string;
  seasonLabel?: string;
  importFixtures?: boolean;
  importResults?: boolean;
  syncStandings?: boolean;
  importMatchDetails?: boolean;
  onProgress?: ImportProgressReporter;
  seasonIndex?: number;
  seasonTotal?: number;
}): Promise<PlanetRugbyImportResult> {
  const report = input.onProgress;
  const competition =
    (input.competitionId ? await getCompetitionById(input.competitionId) : null) ??
    (input.competitionSlug ? await getCompetitionBySlug(input.competitionSlug) : null);

  if (!competition) throw new Error("Competition not found");
  if (!competition.sdmsCompCode) {
    throw new Error("Competition has no SDMS comp code. Set it on the league edit page.");
  }

  const seasons = await fetchSdmsSeasons(competition.sdmsCompCode);
  const seasonLabel =
    input.seasonLabel ??
    seasons?.activeSeason ??
    seasons?.currentSeason ??
    seasons?.seasons?.at(-1);
  if (!seasonLabel) throw new Error("Could not resolve active season from SDMS.");

  report?.({
    phase: "season",
    message: `Downloading ${seasonLabel} data from SDMS…`,
    progress: 8,
    seasonLabel,
    seasonIndex: input.seasonIndex,
    seasonTotal: input.seasonTotal,
  });

  await upsertSeason({
    competitionId: competition.id,
    label: seasonLabel,
    isActive: seasonLabel === (seasons?.activeSeason ?? seasons?.currentSeason),
  });

  const importFixtures = input.importFixtures === true;
  const importResults = input.importResults === true;
  const rows: SdmsFixtureRow[] = [];

  if (importResults) {
    report?.({
      phase: "download",
      message: `Downloading ${seasonLabel} results from SDMS…`,
      progress: 12,
      seasonLabel,
      seasonIndex: input.seasonIndex,
      seasonTotal: input.seasonTotal,
    });
    const results = await fetchSdmsResults(competition.sdmsCompCode, seasonLabel);
    if (results?.length) rows.push(...results);
  }
  if (importFixtures) {
    report?.({
      phase: "download",
      message: `Downloading ${seasonLabel} fixtures from SDMS…`,
      progress: 16,
      seasonLabel,
      seasonIndex: input.seasonIndex,
      seasonTotal: input.seasonTotal,
    });
    const fixtures = await fetchSdmsFixtures(competition.sdmsCompCode, seasonLabel);
    if (fixtures?.length) rows.push(...fixtures);
  }

  const byMatchId = new Map<string, SdmsFixtureRow>();
  for (const row of rows) {
    byMatchId.set(row.match_id, row);
  }
  const matchRows = [...byMatchId.values()];
  const matchTotal = matchRows.length;

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let matchDetailsEnriched = 0;
  let matchDetailsFailed = 0;
  const importMatchDetails = input.importMatchDetails === true;
  const compSlug = competition.planetRugbySlug ?? "competition";

  for (const [index, row] of matchRows.entries()) {
    if (report && (index === 0 || index % 5 === 0 || index === matchTotal - 1)) {
      const matchProgress = matchTotal > 0 ? 20 + Math.round((index / matchTotal) * 65) : 50;
      report({
        phase: "matches",
        message:
          matchTotal > 0
            ? `Saving matches for ${seasonLabel} (${index + 1} of ${matchTotal})…`
            : `Saving matches for ${seasonLabel}…`,
        progress: matchProgress,
        seasonLabel,
        seasonIndex: input.seasonIndex,
        seasonTotal: input.seasonTotal,
        matchesProcessed: index + 1,
        matchesTotal: matchTotal,
      });
    }

    const result = await upsertSdmsFixtureRow(row, competition);
    if (result.outcome === "created") created += 1;
    else if (result.outcome === "updated") updated += 1;
    else skipped += 1;

    if (
      importMatchDetails &&
      result.fixtureId &&
      row.status === "Result"
    ) {
      try {
        await enrichFixtureFromSdmsMatch(result.fixtureId, result.matchId, {
          planetRugbyUrl: buildPlanetRugbyUrl(row, compSlug, competition.sdmsCompCode),
          // Reconcile SDMS events so conversions/tries are not stuck on legacy index ids.
          replaceEvents: true,
        });
        matchDetailsEnriched += 1;
      } catch {
        matchDetailsFailed += 1;
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  let standingsRows: number | undefined;
  if (input.syncStandings !== false) {
    report?.({
      phase: "standings",
      message: `Syncing ${seasonLabel} league table…`,
      progress: 90,
      seasonLabel,
      seasonIndex: input.seasonIndex,
      seasonTotal: input.seasonTotal,
    });
    const sync = await syncCompetitionStandings(competition.id, seasonLabel);
    standingsRows = sync.rowsUpserted;
  }

  report?.({
    phase: "season-complete",
    message: `Finished ${seasonLabel}`,
    progress: input.seasonTotal ? undefined : 98,
    seasonLabel,
    seasonIndex: input.seasonIndex,
    seasonTotal: input.seasonTotal,
  });

  return {
    competitionId: competition.id,
    seasonLabel,
    created,
    updated,
    skipped,
    standingsRows,
    matchDetailsEnriched: importMatchDetails ? matchDetailsEnriched : undefined,
    matchDetailsFailed: importMatchDetails ? matchDetailsFailed : undefined,
  };
}

export async function importPlanetRugbyAllSeasons(input: {
  competitionId?: string;
  competitionSlug?: string;
  importFixtures?: boolean;
  importResults?: boolean;
  syncStandings?: boolean;
  importMatchDetails?: boolean;
  seasonLabels?: string[];
  onProgress?: ImportProgressReporter;
}): Promise<PlanetRugbyAllSeasonsImportResult> {
  const competition =
    (input.competitionId ? await getCompetitionById(input.competitionId) : null) ??
    (input.competitionSlug ? await getCompetitionBySlug(input.competitionSlug) : null);

  if (!competition) throw new Error("Competition not found");
  if (!competition.sdmsCompCode) {
    throw new Error("Competition has no SDMS comp code. Set it on the league edit page.");
  }

  const seasonInfo = await fetchSdmsSeasons(competition.sdmsCompCode);
  const labels =
    input.seasonLabels?.length
      ? input.seasonLabels
      : (seasonInfo?.seasons ?? []).filter(Boolean);
  if (labels.length === 0) throw new Error("No SDMS seasons found for this competition.");

  const seasons: PlanetRugbyImportResult[] = [];
  const seasonTotal = labels.length;
  for (const [index, seasonLabel] of labels.entries()) {
    input.onProgress?.({
      phase: "season",
      message: `Starting season ${seasonLabel} (${index + 1} of ${seasonTotal})…`,
      progress: Math.round((index / seasonTotal) * 100),
      seasonLabel,
      seasonIndex: index + 1,
      seasonTotal,
    });
    const result = await importPlanetRugbyCompetition({
      competitionId: competition.id,
      seasonLabel,
      importFixtures: input.importFixtures,
      importResults: input.importResults,
      syncStandings: input.syncStandings,
      importMatchDetails: input.importMatchDetails,
      onProgress: input.onProgress,
      seasonIndex: index + 1,
      seasonTotal,
    });
    seasons.push(result);
  }

  input.onProgress?.({
    phase: "complete",
    message: `Imported ${seasonTotal} seasons`,
    progress: 100,
    seasonTotal,
  });

  return {
    competitionId: competition.id,
    competitionSlug: competition.slug,
    seasonsImported: seasons.length,
    seasons,
    totals: sumSeasonTotals(seasons),
  };
}

export async function importFromPlanetRugbyTournamentUrl(
  tournamentUrl: string,
  options: {
    seasonLabel?: string;
    importFixtures?: boolean;
    importResults?: boolean;
    syncStandings?: boolean;
    importMatchDetails?: boolean;
    importAllSeasons?: boolean;
    onProgress?: ImportProgressReporter;
  } = {},
): Promise<
  (PlanetRugbyImportResult & { competitionSlug: string }) | (PlanetRugbyAllSeasonsImportResult & { competitionSlug: string })
> {
  const adapter = new PlanetRugbyMatchPageAdapter();
  options.onProgress?.({
    phase: "preview",
    message: "Reading tournament page and SDMS metadata…",
    progress: 3,
  });
  const preview = await adapter.adaptTournamentPage(tournamentUrl, { enrichSdms: true });

  if (!preview.sdmsCompCode) {
    throw new Error("Could not read SDMS comp code from tournament page.");
  }

  let competition = await getCompetitionBySlug(preview.competitionSlug);
  const compType = competitionTypeFromPresetSlug(preview.competitionSlug);
  if (!competition) {
    competition = await createCompetition({
      name: preview.competitionName,
      slug: preview.competitionSlug,
      sdmsCompCode: preview.sdmsCompCode,
      planetRugbySlug: preview.competitionSlug,
      competitionType: compType,
    });
  } else if (!competition.sdmsCompCode) {
    competition = await updateCompetition(competition.id, {
      sdmsCompCode: preview.sdmsCompCode,
      planetRugbySlug: preview.competitionSlug,
    });
  }

  const importFixtures = options.importFixtures === true;
  const importResults = options.importResults === true;
  const syncStandings = options.syncStandings !== false;
  const importMatchDetails =
    options.importMatchDetails ?? (importResults && importFixtures);

  if (options.importAllSeasons) {
    const result = await importPlanetRugbyAllSeasons({
      competitionId: competition.id,
      importFixtures,
      importResults,
      syncStandings,
      importMatchDetails,
      onProgress: options.onProgress,
    });
    return { ...result, competitionSlug: preview.competitionSlug };
  }

  const result = await importPlanetRugbyCompetition({
    competitionId: competition.id,
    seasonLabel: options.seasonLabel ?? preview.activeSeason ?? undefined,
    importFixtures,
    importResults,
    syncStandings,
    importMatchDetails,
    onProgress: options.onProgress,
  });

  options.onProgress?.({
    phase: "complete",
    message: "Import complete",
    progress: 100,
  });

  return { ...result, competitionSlug: preview.competitionSlug };
}
