import { and, eq } from "drizzle-orm";
import {
  fetchSdmsSeasons,
  fetchSdmsTable,
  type StandingView as SdmsView,
} from "@rugby365/import-sdk";
import { competitionSeasons, standingRows } from "@rugby365/db";
import {
  getCompetitionById,
  normalizeCompetitionSeasonLabels,
  upsertSeason,
  type StandingView,
} from "./competition-admin-service";
import { getDb } from "./db";
import { resolveTeam } from "./entity-resolve-service";
import { parseSeasonStartYear } from "./season-label-utils";

const VIEWS: StandingView[] = ["overall", "home", "away"];

export async function syncSeasonStandings(
  seasonId: string,
  views: StandingView[] = VIEWS,
): Promise<{ rowsUpserted: number; views: StandingView[] }> {
  const db = getDb();
  const [season] = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.id, seasonId))
    .limit(1);
  if (!season) throw new Error("Season not found");

  const competition = await getCompetitionById(season.competitionId);
  if (!competition?.sdmsCompCode) {
    throw new Error("Competition has no SDMS comp code — add one on the competition edit page.");
  }

  let rowsUpserted = 0;
  const syncedAt = new Date();

  for (const view of views) {
    const sdmsRows = await fetchSdmsTable(
      competition.sdmsCompCode,
      season.label,
      view as SdmsView,
    );
    if (!sdmsRows?.length) continue;

    await db
      .delete(standingRows)
      .where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, view)));

    for (const row of sdmsRows) {
      const team = await resolveTeam({
        name: row.team_name,
        externalProviderId: row.team_id,
        createIfMissing: true,
      });
      if (!team) continue;

      await db.insert(standingRows).values({
        seasonId,
        teamId: team.id,
        view,
        rank: row.rank,
        played: row.played,
        won: row.won,
        draw: row.draw,
        lost: row.lost,
        pointsFor: row.for ?? 0,
        pointsAgainst: row.against ?? 0,
        pointsDiff: row.points_diff,
        bonusPoints: row.bonus_points ?? 0,
        points: row.points,
        form:
          row.try_bonus_points != null || row.losing_bonus_points != null
            ? JSON.stringify({
                tbp: row.try_bonus_points ?? 0,
                lbp: row.losing_bonus_points ?? 0,
                lf: row.last_five ?? null,
              })
            : row.last_five ?? null,
        syncedAt,
      });
      rowsUpserted += 1;
    }
  }

  await db
    .update(competitionSeasons)
    .set({ syncedAt })
    .where(eq(competitionSeasons.id, seasonId));

  return { rowsUpserted, views };
}

export async function syncCompetitionSeasonsFromSdms(competitionId: string) {
  const competition = await getCompetitionById(competitionId);
  if (!competition?.sdmsCompCode) {
    throw new Error("Competition has no SDMS comp code.");
  }

  const info = await fetchSdmsSeasons(competition.sdmsCompCode);
  if (!info?.seasons.length) throw new Error("No seasons returned from SDMS.");

  const activeLabel = info.activeSeason ?? info.currentSeason ?? info.seasons.at(-1)!;
  const upserted = [];

  for (const label of info.seasons) {
    const season = await upsertSeason({
      competitionId,
      label,
      isActive: label === activeLabel,
    });
    upserted.push(season);
  }

  await normalizeCompetitionSeasonLabels(competitionId);

  return { seasons: upserted, activeLabel };
}

export async function syncCompetitionStandings(
  competitionId: string,
  seasonLabel?: string,
): Promise<{ seasonId: string; rowsUpserted: number }> {
  const { seasons, activeLabel } = await syncCompetitionSeasonsFromSdms(competitionId);
  const label = seasonLabel ?? activeLabel;
  const targetYear = parseSeasonStartYear(label);
  const season =
    seasons.find((s) => s.label === label) ??
    (targetYear != null
      ? seasons.find((s) => (s.year ?? parseSeasonStartYear(s.label)) === targetYear)
      : null);
  if (!season) throw new Error(`Season ${label} not found after sync.`);

  const result = await syncSeasonStandings(season.id);
  return { seasonId: season.id, rowsUpserted: result.rowsUpserted };
}
