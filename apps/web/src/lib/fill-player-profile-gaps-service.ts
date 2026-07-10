import { and, eq, isNull, or, sql } from "drizzle-orm";
import { playerRatings, players } from "@rugby365/db";
import { mapEntitiesFromMatches } from "./entity-admin-service";
import { getDb } from "./db";
import {
  fillAllNationalitiesFromBirthPlace,
  fillAllPositionsFromSquads,
  repairAllPlayerProfilesFromSquads,
  backfillAllPlayerProfilesFromEventPayloads,
} from "./player-profile-fields";
import { batchCalculateAllPlayerRatings } from "./player-ratings-batch-service";
import { enrichAllPlayersFromWikipedia } from "./player-wikipedia-enrich";

export type PlayerProfileGapStats = {
  total: number;
  withClub: number;
  withNation: number;
  withPosition: number;
  withRating: number;
  missingClub: number;
  missingNation: number;
  missingPosition: number;
  missingRating: number;
};

export async function getPlayerProfileGapStats(): Promise<PlayerProfileGapStats> {
  const db = getDb();
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withClub: sql<number>`count(*) filter (where ${players.clubTeamId} is not null or (${players.clubName} is not null and ${players.clubName} != ''))::int`,
      withNation: sql<number>`count(*) filter (where ${players.internationalTeamId} is not null or (${players.countryName} is not null and ${players.countryName} != ''))::int`,
      withPosition: sql<number>`count(*) filter (where ${players.positionName} is not null and ${players.positionName} != '')::int`,
      withRating: sql<number>`count(*) filter (where exists (select 1 from ${playerRatings} pr where pr.player_id = ${players.id} and pr.player_rating is not null))::int`,
    })
    .from(players);

  const total = row?.total ?? 0;
  return {
    total,
    withClub: row?.withClub ?? 0,
    withNation: row?.withNation ?? 0,
    withPosition: row?.withPosition ?? 0,
    withRating: row?.withRating ?? 0,
    missingClub: total - (row?.withClub ?? 0),
    missingNation: total - (row?.withNation ?? 0),
    missingPosition: total - (row?.withPosition ?? 0),
    missingRating: total - (row?.withRating ?? 0),
  };
}

export type FillPlayerProfileGapsOptions = {
  mapFromMatches?: boolean;
  repairFromSquads?: boolean;
  fillPositionsFromSquads?: boolean;
  backfillFromEvents?: boolean;
  fillNationalityFromBirthPlace?: boolean;
  wikipedia?: boolean | { onlyIncomplete?: boolean; onlyMissing?: boolean; limit?: number; delayMs?: number };
  calculateRatings?: boolean | { onlyMissing?: boolean; limit?: number };
  onProgress?: (message: string) => void;
};

export type FillPlayerProfileGapsResult = {
  before: PlayerProfileGapStats;
  after: PlayerProfileGapStats;
  mapFromMatches?: Awaited<ReturnType<typeof mapEntitiesFromMatches>>;
  repairFromSquads?: { repaired: number; total: number };
  backfillFromEvents?: { updated: number; total: number };
  fillPositionsFromSquads?: { filled: number; total: number };
  fillNationalityFromBirthPlace?: { filled: number; total: number };
  wikipedia?: Awaited<ReturnType<typeof enrichAllPlayersFromWikipedia>>;
  calculateRatings?: Awaited<ReturnType<typeof batchCalculateAllPlayerRatings>>;
};

export async function fillPlayerProfileGaps(
  options: FillPlayerProfileGapsOptions = {},
): Promise<FillPlayerProfileGapsResult> {
  const log = options.onProgress ?? (() => {});
  const before = await getPlayerProfileGapStats();
  const result: FillPlayerProfileGapsResult = { before, after: before };

  if (options.mapFromMatches !== false) {
    log("Mapping players, squads and events from fixtures…");
    result.mapFromMatches = await mapEntitiesFromMatches();
    log(
      `Mapped fixtures: ${result.mapFromMatches.squadsSynced} squads, ${result.mapFromMatches.profilesRepaired} profiles repaired`,
    );
  }

  if (options.repairFromSquads !== false) {
    log("Repairing club and international links from squad history…");
    result.repairFromSquads = await repairAllPlayerProfilesFromSquads();
    log(`Repaired ${result.repairFromSquads.repaired}/${result.repairFromSquads.total} player profiles`);
  }

  if (options.fillPositionsFromSquads !== false) {
    log("Filling positions from fixture lineups…");
    result.fillPositionsFromSquads = await fillAllPositionsFromSquads();
    log(`Filled ${result.fillPositionsFromSquads.filled} positions from squads`);
  }

  if (options.backfillFromEvents !== false) {
    log("Backfilling club and position from match event payloads…");
    result.backfillFromEvents = await backfillAllPlayerProfilesFromEventPayloads();
    log(
      `Event payload backfill: ${result.backfillFromEvents.updated}/${result.backfillFromEvents.total} players updated`,
    );
  }

  if (options.fillNationalityFromBirthPlace !== false) {
    log("Filling nationality from birth place…");
    result.fillNationalityFromBirthPlace = await fillAllNationalitiesFromBirthPlace();
    log(`Filled ${result.fillNationalityFromBirthPlace.filled} nationalities from birth place`);
  }

  if (options.wikipedia) {
    const wikiOpts = typeof options.wikipedia === "object" ? options.wikipedia : {};
    log("Enriching players from Wikipedia…");
    result.wikipedia = await enrichAllPlayersFromWikipedia({
      onlyIncomplete: wikiOpts.onlyIncomplete ?? true,
      onlyMissing: wikiOpts.onlyMissing ?? false,
      limit: wikiOpts.limit,
      delayMs: wikiOpts.delayMs ?? 400,
      onProgress: ({ index, total, playerName, result: row }) => {
        if (index % 50 === 0 || index === total) {
          log(`[wiki ${index}/${total}] ${playerName} — ${row.enriched ? "ok" : (row.reason ?? "skip")}`);
        }
      },
    });
    log(
      `Wikipedia: ${result.wikipedia.enriched} enriched, ${result.wikipedia.skipped} skipped, ${result.wikipedia.failed} failed`,
    );

    log("Re-running squad profile repair after Wikipedia…");
    result.repairFromSquads = await repairAllPlayerProfilesFromSquads();
  }

  if (options.calculateRatings !== false) {
    const ratingOpts = typeof options.calculateRatings === "object" ? options.calculateRatings : {};
    log("Calculating Rugby365 ratings…");
    result.calculateRatings = await batchCalculateAllPlayerRatings({
      onlyMissing: ratingOpts.onlyMissing ?? true,
      onlyWithMatchData: true,
      limit: ratingOpts.limit,
      onProgress: ({ index, total, playerName }) => {
        if (index % 100 === 0 || index === total) {
          log(`[ratings ${index}/${total}] ${playerName}`);
        }
      },
    });
    log(
      `Ratings: ${result.calculateRatings.rated} rated, ${result.calculateRatings.skipped} skipped, ${result.calculateRatings.failed} failed`,
    );
  }

  result.after = await getPlayerProfileGapStats();
  return result;
}

export async function listPlayersStillMissingProfiles(limit = 20) {
  const db = getDb();
  return db
    .select({
      id: players.id,
      name: players.name,
      clubName: players.clubName,
      countryName: players.countryName,
      positionName: players.positionName,
    })
    .from(players)
    .where(
      or(
        and(isNull(players.clubTeamId), or(isNull(players.clubName), eq(players.clubName, ""))),
        or(isNull(players.countryName), eq(players.countryName, "")),
        or(isNull(players.positionName), eq(players.positionName, "")),
      ),
    )
    .limit(limit);
}
