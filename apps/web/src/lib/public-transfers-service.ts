/**
 * Public transfers browse — read-only lean rows from player_transfers.
 */
import { and, asc, desc, eq, ilike, inArray, ne, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitionSeasons,
  competitions,
  playerImages,
  playerRatings,
  playerTransfers,
  players,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { resolvePremiershipSeason } from "./transfer-admin-service";
import {
  sanitizeTransferClub,
  sanitizeTransferPlayerName,
  transferClubLabel,
  transferMarketDealDetail,
} from "./transfer-display";
import {
  TRANSFER_MOVEMENT_TYPES,
  movementTypeLabel,
  type TransferMovementType,
} from "./transfer-types";
import {
  formatSeasonRangeLabel,
  normalizeSeasonLabel,
  parseSeasonStartYear,
  currentDomesticSeasonStartYear,
} from "./season-label-utils";
import { pickDefaultSeasonForPicker } from "./season-list-utils";
import { listSeasonsForPicker } from "./competition-admin-service";
import { isJunkTeamName, isJunkTeamSlug } from "./entity-normalize";
import { isRealCompareRosterTeamName } from "./compare-roster-team-name";
import {
  dedupeNamedOptionsByName,
  dedupeSeasonsByCompetitionAndYear,
  expandTransferSearchTerms,
  filterTransferClubGroups,
  sortSeasonsGroupedByCompetition,
} from "./public-transfers-filter-utils";
import { canonicalCompetitionDisplayName, dedupeCompetitionsByName as dedupeCompetitionPickerRows } from "./competition-list-utils";
import {
  isInternationalTeamId,
  isPlaceholderNationCode,
  loadTeamClassificationContext,
  resolveDisplayNation,
  type TeamClassificationContext,
} from "./international-team-classify";
import { rankingCountryFlagUrl } from "./player-ranking-engine";
import {
  DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
  PREMIERSHIP_TRANSFERS_WIKI_URL,
} from "./premiership-transfer-constants";

export type PublicTransferRow = {
  id: string;
  playerId: string;
  playerSlug: string;
  playerName: string;
  playerImageUrl: string | null;
  positionName: string | null;
  playerRating: number | null;
  internationalStatus: string | null;
  nationCode: string | null;
  nationFlagUrl: string | null;
  movementType: string;
  movementLabel: string;
  dealDetail: string | null;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromLabel: string;
  toLabel: string;
  fromTeamImageUrl: string | null;
  toTeamImageUrl: string | null;
  effectiveDate: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  competitionId: string | null;
  competitionName: string | null;
};

export type PublicTransferFilters = {
  seasonId?: string | null;
  competitionId?: string | null;
  teamId?: string | null;
  /** Substring match on from/to club names (e.g. "Bulls"). */
  teamQuery?: string | null;
  movementType?: string | null;
  search?: string | null;
  sortDir?: "asc" | "desc" | null;
  page?: number | null;
  pageSize?: number | null;
};

export type PublicTransferTeamGroup = {
  teamId: string;
  teamName: string;
  teamImageUrl: string | null;
  in: PublicTransferRow[];
  out: PublicTransferRow[];
};

/** Crest for a transfer from/to cell — skip released/retired placeholders. */
export function transferClubImageUrl(
  label: string,
  teamImageUrl: string | null | undefined,
  teamName?: string | null,
): string | null {
  const text = label.trim();
  if (!text || /^(—|-|released|retired)$/i.test(text)) return null;
  return teamImageUrl?.trim() || rankingCountryFlagUrl(teamName || text) || null;
}
export function resolveTransferPosition(
  transferPosition: string | null | undefined,
  playerPosition: string | null | undefined,
): string | null {
  const a = transferPosition?.trim();
  if (a) return a;
  const b = playerPosition?.trim();
  return b || null;
}

async function loadTransferHeadshots(
  rows: Array<{
    playerId: string;
    playerName?: string | null;
    playerImageUrl: string | null;
    primaryImageId?: string | null;
  }>,
): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const row of rows) {
    if (row.playerImageUrl?.trim()) found.set(row.playerId, row.playerImageUrl.trim());
  }
  const missing = [...new Set(rows.map((row) => row.playerId).filter((id) => !found.has(id)))];
  if (!missing.length) return found;

  const db = getDb();
  const primaryIds = [
    ...new Set(rows.map((row) => row.primaryImageId).filter((id): id is string => Boolean(id))),
  ];
  if (primaryIds.length) {
    const primaryRows = await db
      .select({ id: playerImages.id, playerId: playerImages.playerId, imageUrl: playerImages.imageUrl })
      .from(playerImages)
      .where(inArray(playerImages.id, primaryIds));
    for (const img of primaryRows) {
      if (img.imageUrl && !found.has(img.playerId)) found.set(img.playerId, img.imageUrl);
    }
  }

  const stillMissing = missing.filter((id) => !found.has(id));
  if (!stillMissing.length) return found;

  const gallery = await db
    .select({
      playerId: playerImages.playerId,
      imageUrl: playerImages.imageUrl,
    })
    .from(playerImages)
    .where(
      and(
        inArray(playerImages.playerId, stillMissing),
        not(inArray(playerImages.status, ["rejected", "incorrect_player", "removed"])),
        or(
          eq(playerImages.status, "approved"),
          inArray(playerImages.sourceProvider, ["wikipedia", "wikimedia", "name_twin", "alamy", "commons"]),
          eq(playerImages.confidence, "high"),
          and(eq(playerImages.sourceProvider, "planet_rugby"), eq(playerImages.confidence, "medium")),
        ),
      ),
    );
  for (const img of gallery) {
    if (img.imageUrl && !found.has(img.playerId)) found.set(img.playerId, img.imageUrl);
  }

  const unnamedMissing = stillMissing.filter((id) => !found.has(id));
  if (!unnamedMissing.length) return found;

  const names = [
    ...new Set(
      rows
        .filter((row) => unnamedMissing.includes(row.playerId) && row.playerName?.trim())
        .map((row) => row.playerName!.trim()),
    ),
  ];
  if (!names.length) return found;

  const twins = await db
    .select({ name: players.name, imageUrl: players.imageUrl })
    .from(players)
    .where(and(inArray(players.name, names), sql`coalesce(${players.imageUrl}, '') <> ''`));
  const urlByName = new Map<string, string>();
  for (const twin of twins) {
    if (twin.imageUrl?.trim() && !urlByName.has(twin.name)) urlByName.set(twin.name, twin.imageUrl.trim());
  }
  for (const row of rows) {
    if (found.has(row.playerId) || !row.playerName?.trim()) continue;
    const url = urlByName.get(row.playerName.trim());
    if (url) found.set(row.playerId, url);
  }

  return found;
}

async function attachMissingClubCrests(rows: PublicTransferRow[]): Promise<PublicTransferRow[]> {
  const missing = new Set<string>();
  for (const row of rows) {
    if (!row.fromTeamImageUrl && row.fromLabel && !/^(—|-|released|retired)$/i.test(row.fromLabel)) {
      missing.add(row.fromLabel);
    }
    if (!row.toTeamImageUrl && row.toLabel && !/^(—|-|released|retired)$/i.test(row.toLabel)) {
      missing.add(row.toLabel);
    }
  }
  if (!missing.size) return rows;

  const db = getDb();
  const found = await db
    .select({ name: teams.name, imageUrl: teams.imageUrl })
    .from(teams)
    .where(inArray(teams.name, [...missing]));
  const byName = new Map<string, string>();
  for (const team of found) {
    if (team.imageUrl?.trim() && !byName.has(team.name)) byName.set(team.name, team.imageUrl.trim());
  }
  if (!byName.size) return rows;

  return rows.map((row) => ({
    ...row,
    fromTeamImageUrl: row.fromTeamImageUrl || byName.get(row.fromLabel) || null,
    toTeamImageUrl: row.toTeamImageUrl || byName.get(row.toLabel) || null,
  }));
}

/**
 * International status from the player database (same rules as Players CMS).
 * Uses nation code, linked international team, then validated country name.
 */
export function resolvePlayerInternationalStatus(
  ctx: TeamClassificationContext,
  player: {
    nationCode?: string | null;
    countryName?: string | null;
    clubName?: string | null;
    internationalTeamId?: string | null;
    internationalTeamName?: string | null;
  },
): string | null {
  const internationalTeamName =
    player.internationalTeamId && isInternationalTeamId(ctx, player.internationalTeamId)
      ? player.internationalTeamName?.trim() || null
      : null;

  return resolveDisplayNation(ctx, {
    nationCode: player.nationCode ?? null,
    countryName: player.countryName ?? null,
    clubName: player.clubName ?? null,
    internationalTeamId: player.internationalTeamId ?? null,
    internationalTeamName,
  });
}

function mapRow(
  input: {
    id: string;
    playerId: string;
    playerSlug: string;
    playerName: string;
    playerImageUrl: string | null;
    transferPositionName: string | null;
    playerPositionName: string | null;
    playerRating: number | null;
    internationalTeamId: string | null;
    internationalTeamName: string | null;
    nationCode: string | null;
    countryName: string | null;
    clubName: string | null;
    movementType: string;
    notes: string | null;
    fromTeamId: string | null;
    toTeamId: string | null;
    fromTeamName: string | null;
    toTeamName: string | null;
    fromTeamImageUrl: string | null;
    toTeamImageUrl: string | null;
    fromClub: string | null;
    toClub: string | null;
    effectiveDate: Date | null;
    seasonId: string | null;
    seasonLabel: string | null;
    competitionId: string | null;
    competitionName: string | null;
  },
  teamClassification: TeamClassificationContext,
): PublicTransferRow {
  const rating =
    input.playerRating != null && Number.isFinite(input.playerRating)
      ? Math.round(input.playerRating)
      : null;
  const internationalStatus = resolvePlayerInternationalStatus(teamClassification, {
    nationCode: input.nationCode,
    countryName: input.countryName,
    clubName: input.clubName,
    internationalTeamId: input.internationalTeamId,
    internationalTeamName: input.internationalTeamName,
  });
  const fromLabel = transferClubLabel(input.fromTeamName, sanitizeTransferClub(input.fromClub)) || "—";
  const toLabel =
    input.movementType === "released" &&
    !transferClubLabel(input.toTeamName, sanitizeTransferClub(input.toClub))
      ? "Released"
      : transferClubLabel(input.toTeamName, sanitizeTransferClub(input.toClub)) ||
        (input.movementType === "retirement" ? "Retired" : "—");
  const nationCode = isPlaceholderNationCode(input.nationCode) ? null : input.nationCode;
  return {
    id: input.id,
    playerId: input.playerId,
    playerSlug: input.playerSlug,
    playerName: sanitizeTransferPlayerName(input.playerName),
    playerImageUrl: input.playerImageUrl?.trim() || null,
    positionName: resolveTransferPosition(input.transferPositionName, input.playerPositionName),
    playerRating: rating,
    internationalStatus,
    nationCode,
    nationFlagUrl: rankingCountryFlagUrl(internationalStatus, nationCode),
    movementType: input.movementType,
    movementLabel: movementTypeLabel(input.movementType),
    dealDetail: transferMarketDealDetail(input.notes),
    fromTeamId: input.fromTeamId,
    toTeamId: input.toTeamId,
    fromLabel,
    toLabel,
    fromTeamImageUrl: transferClubImageUrl(fromLabel, input.fromTeamImageUrl, input.fromTeamName),
    toTeamImageUrl: transferClubImageUrl(toLabel, input.toTeamImageUrl, input.toTeamName),
    effectiveDate: input.effectiveDate?.toISOString() ?? null,
    seasonId: input.seasonId,
    seasonLabel: input.seasonLabel,
    competitionId: input.competitionId,
    competitionName: input.competitionName,
  };
}

export async function getPublicTransferDefaults() {
  // Latest Wiki window: List_of_2026–27_Premiership_Rugby_transfers
  const wikiSeasonLabel = DEFAULT_PREMIERSHIP_TRANSFER_SEASON;
  const preferredYear = parseSeasonStartYear(wikiSeasonLabel) ?? 2026;
  const preferredNormalized = normalizeSeasonLabel(wikiSeasonLabel) ?? wikiSeasonLabel;

  const { competition, season: wikiSeason } = await resolvePremiershipSeason(wikiSeasonLabel);

  // Same force-path as admin Transfers setup — guarantee 2026–27 is pickable
  const { upsertSeason } = await import("./competition-admin-service");
  await upsertSeason({
    competitionId: competition.id,
    label: wikiSeasonLabel,
    isActive: true,
  });

  let seasonRows = await listSeasonsForPicker(competition.id);
  if (!seasonRows.some((s) => s.year === preferredYear)) {
    await upsertSeason({
      competitionId: competition.id,
      label: wikiSeasonLabel,
      isActive: true,
    });
    seasonRows = await listSeasonsForPicker(competition.id);
  }

  const byWikiWindow =
    seasonRows.find((s) => s.year === preferredYear) ??
    (wikiSeason ? seasonRows.find((s) => s.id === wikiSeason.id) : null) ??
    seasonRows.find((s) => s.label === wikiSeasonLabel) ??
    seasonRows.find((s) => normalizeSeasonLabel(s.label) === preferredNormalized) ??
    seasonRows.find((s) => s.displayLabel === formatSeasonRangeLabel(preferredYear));

  const defaultSeason =
    byWikiWindow ?? pickDefaultSeasonForPicker(seasonRows) ?? seasonRows[0] ?? null;

  return {
    competitionId: competition.id,
    competitionName: competition.name,
    seasonId: defaultSeason?.id ?? wikiSeason?.id ?? null,
    seasonLabel:
      defaultSeason?.displayLabel ||
      defaultSeason?.label ||
      wikiSeason?.label ||
      wikiSeasonLabel,
    seasonYear: preferredYear,
    wikiUrl: PREMIERSHIP_TRANSFERS_WIKI_URL,
  };
}

async function loadCompetitionLineage() {
  const db = getDb();
  const rows = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
    .from(competitions);
  const idsByKey = new Map<string, string[]>();
  const keyById = new Map<string, string>();
  const bestByKey = new Map<string, { id: string; name: string; slug: string }>();

  for (const row of rows) {
    const key = canonicalCompetitionDisplayName(row.name).toLowerCase();
    keyById.set(row.id, key);
    const list = idsByKey.get(key) ?? [];
    list.push(row.id);
    idsByKey.set(key, list);
    const current = bestByKey.get(key);
    const displayName = canonicalCompetitionDisplayName(row.name);
    if (!current) {
      bestByKey.set(key, { id: row.id, name: displayName, slug: row.slug });
      continue;
    }
    const currentLegacy = current.slug.includes("__legacy__");
    const rowLegacy = row.slug.includes("__legacy__");
    if (currentLegacy && !rowLegacy) {
      bestByKey.set(key, { id: row.id, name: displayName, slug: row.slug });
    }
  }

  const siblingIdsById = new Map<string, string[]>();
  const canonicalNameById = new Map<string, string>();
  const canonicalSlugById = new Map<string, string>();
  const canonicalIdById = new Map<string, string>();
  for (const [id, key] of keyById) {
    siblingIdsById.set(id, idsByKey.get(key) ?? [id]);
    const best = bestByKey.get(key);
    canonicalNameById.set(id, best?.name ?? "");
    canonicalSlugById.set(id, best?.slug ?? "");
    canonicalIdById.set(id, best?.id ?? id);
  }
  return { siblingIdsById, canonicalNameById, canonicalSlugById, canonicalIdById };
}

async function listCompetitionsForTransferFilters(preferredCompetitionId: string) {
  const db = getDb();
  const idRows = await db.execute(sql<{ id: string }>`
    select distinct competition_id as id
    from (
      select competition_id from player_transfers where competition_id is not null
      union
      select cs.competition_id
      from player_transfers t
      join competition_seasons cs on cs.id = t.season_id
      union
      select cs.competition_id
      from standing_rows sr
      join competition_seasons cs on cs.id = sr.season_id
    ) x
    where competition_id is not null
  `);
  const ids = [...new Set(idRows.map((row) => row.id).filter(Boolean))];
  if (!ids.length) return [];

  const rows = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
    .from(competitions)
    .where(inArray(competitions.id, ids));

  const unique = dedupeCompetitionPickerRows(rows);
  return [...unique].sort((a, b) => {
    if (a.id === preferredCompetitionId) return -1;
    if (b.id === preferredCompetitionId) return 1;
    if (a.slug === "premiership") return -1;
    if (b.slug === "premiership") return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Clubs/nations that actually appear on a transfer row. */
async function listClubsForTransferFilters() {
  const db = getDb();
  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
    })
    .from(teams)
    .where(
      and(
        ne(teams.sourceProvider, "sync-repair"),
        not(sql`${teams.slug} like 'orphan-%'`),
        sql`${teams.id} in (
          select from_team_id from player_transfers where from_team_id is not null
          union
          select to_team_id from player_transfers where to_team_id is not null
        )`,
      ),
    )
    .orderBy(asc(teams.name));

  return dedupeNamedOptionsByName(
    teamRows
      .filter(
        (t) =>
          !isJunkTeamSlug(t.slug) &&
          !isJunkTeamName(t.name) &&
          isRealCompareRosterTeamName(t.name),
      )
      .filter((t) => {
        const name = t.name.trim();
        if (name.length < 2) return false;
        if (/^[,;/|-]+$/.test(name)) return false;
        if (/^,\s*/.test(name) && name.length < 8) return false;
        return true;
      })
      .map((t) => ({ id: t.id, name: t.name })),
  );
}

async function listSeasonsForTransferFilters(competitionId: string | null) {
  const db = getDb();
  const lineage = await loadCompetitionLineage();
  const siblingIds = competitionId ? lineage.siblingIdsById.get(competitionId) ?? [competitionId] : null;
  const conditions = [eq(competitionSeasons.isDeprecated, false)];
  if (siblingIds?.length) {
    conditions.push(inArray(competitionSeasons.competitionId, siblingIds));
  } else {
    const dataCompIds = await db.execute(sql<{ id: string }>`
      select distinct competition_id as id
      from (
        select competition_id from player_transfers where competition_id is not null
        union
        select cs.competition_id
        from player_transfers t
        join competition_seasons cs on cs.id = t.season_id
        union
        select cs.competition_id
        from standing_rows sr
        join competition_seasons cs on cs.id = sr.season_id
      ) x
      where competition_id is not null
    `);
    const allowed = [
      ...new Set(
        dataCompIds.flatMap((row) => lineage.siblingIdsById.get(row.id) ?? [row.id]),
      ),
    ];
    if (!allowed.length) return [];
    conditions.push(inArray(competitionSeasons.competitionId, allowed));
  }

  const rows = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      competitionId: competitionSeasons.competitionId,
      isActive: competitionSeasons.isActive,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(and(...conditions));

  const dataSeasonIds = await db.execute(sql<{ id: string }>`
    select season_id as id from player_transfers where season_id is not null
    union
    select season_id as id from standing_rows
  `);
  const hasData = new Set(dataSeasonIds.map((row) => row.id));
  const currentYear = currentDomesticSeasonStartYear();

  const mapped = rows
    .map((row) => {
      const year = row.year ?? parseSeasonStartYear(row.label) ?? 0;
      const label = normalizeSeasonLabel(row.label) ?? formatSeasonRangeLabel(year);
      const canonicalName = lineage.canonicalNameById.get(row.competitionId) || row.competitionName;
      const canonicalSlug = lineage.canonicalSlugById.get(row.competitionId) || row.competitionSlug;
      const canonicalCompetitionId = lineage.canonicalIdById.get(row.competitionId) || row.competitionId;
      return {
        ...row,
        year,
        label,
        displayLabel: label,
        competitionId: canonicalCompetitionId,
        competitionName: canonicalName,
        competitionSlug: canonicalSlug,
      };
    })
    .filter((row) => row.year <= currentYear || hasData.has(row.id));

  return sortSeasonsGroupedByCompetition(dedupeSeasonsByCompetitionAndYear(mapped));
}

export async function getPublicTransferFilterOptions(input?: {
  competitionId?: string | null;
  seasonId?: string | null;
}) {
  const defaults = await getPublicTransferDefaults();
  // Empty string means "All competitions" — do not force Premiership.
  const requestedComp = input?.competitionId;
  const allCompetitions = requestedComp === "" || requestedComp === null;
  const compId = allCompetitions
    ? null
    : requestedComp?.trim() || defaults.competitionId;

  let seasonRows = await listSeasonsForTransferFilters(compId);

  // For Premiership, guarantee Wiki current season is in the list
  if (compId === defaults.competitionId && !seasonRows.some((s) => s.year === defaults.seasonYear)) {
    const { upsertSeason } = await import("./competition-admin-service");
    await upsertSeason({
      competitionId: compId,
      label: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
      isActive: true,
    });
    seasonRows = await listSeasonsForTransferFilters(compId);
  }

  let seasonId = input?.seasonId?.trim() || null;
  if (seasonId && !seasonRows.some((s) => s.id === seasonId)) {
    seasonId = null; // stale URL / deleted season
  }
  // Only auto-pick a season when a competition is selected and caller didn't clear season.
  const seasonExplicitlyCleared = input?.seasonId === "" || input?.seasonId === null;
  if (!seasonId && !seasonExplicitlyCleared && !allCompetitions && compId === defaults.competitionId) {
    seasonId = defaults.seasonId;
  } else if (!seasonId && !seasonExplicitlyCleared && !allCompetitions) {
    const preferredYear = defaults.seasonYear;
    seasonId =
      seasonRows.find((s) => s.year === preferredYear)?.id ??
      pickDefaultSeasonForPicker(seasonRows)?.id ??
      seasonRows[0]?.id ??
      null;
  }

  const [competitionRows, teamRows] = await Promise.all([
    listCompetitionsForTransferFilters(defaults.competitionId),
    listClubsForTransferFilters(),
  ]);

  const competitionNameById = new Map(competitionRows.map((c) => [c.id, c.name]));

  return {
    defaults: {
      competitionId: defaults.competitionId,
      seasonId: defaults.seasonId,
      seasonLabel: defaults.seasonLabel,
      seasonYear: defaults.seasonYear,
      wikiUrl: defaults.wikiUrl,
    },
    competitions: competitionRows.map((c) => ({ id: c.id, name: c.name })),
    seasons: seasonRows.map((s) => {
      const competitionId = s.competitionId ?? compId ?? "";
      const competitionName = s.competitionName ?? (competitionId ? competitionNameById.get(competitionId) ?? null : null);
      const baseLabel = s.displayLabel || s.label;
      return {
        id: s.id,
        label: s.label,
        displayLabel: baseLabel,
        year: s.year,
        competitionId,
        competitionName,
      };
    }),
    teams: teamRows,
    selectedCompetitionId: compId,
    selectedSeasonId: seasonId,
    movementTypes: [...TRANSFER_MOVEMENT_TYPES] as TransferMovementType[],
  };
}

export async function listPublicTransfers(filters: PublicTransferFilters = {}) {
  const db = getDb();
  // Explicit null/empty = All; only use Premiership defaults when the filter key is omitted.
  let seasonId =
    filters.seasonId === undefined
      ? (await getPublicTransferDefaults()).seasonId
      : filters.seasonId?.trim() || null;
  let competitionId =
    filters.competitionId === undefined
      ? (await getPublicTransferDefaults()).competitionId
      : filters.competitionId?.trim() || null;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 200));
  const offset = (page - 1) * pageSize;
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

  const fromTeam = alias(teams, "public_transfer_from_team");
  const toTeam = alias(teams, "public_transfer_to_team");
  const intlTeam = alias(teams, "public_transfer_intl_team");

  const teamClassification = await loadTeamClassificationContext();
  const teamId = filters.teamId?.trim() || null;
  const teamQuery = filters.teamQuery?.trim() || null;
  const internationalTeamFilter =
    Boolean(teamId) && isInternationalTeamId(teamClassification, teamId);

  // National sides are not Premiership clubs — ignore competition/season when filtering by them.
  if (internationalTeamFilter) {
    seasonId = null;
    competitionId = null;
  }

  const conditions = [];
  const lineage =
    seasonId || competitionId ? await loadCompetitionLineage() : null;
  if (seasonId) {
    const [picked] = await db
      .select({
        id: competitionSeasons.id,
        year: competitionSeasons.year,
        competitionId: competitionSeasons.competitionId,
      })
      .from(competitionSeasons)
      .where(eq(competitionSeasons.id, seasonId))
      .limit(1);
    const siblingCompIds = picked
      ? lineage?.siblingIdsById.get(picked.competitionId) ?? [picked.competitionId]
      : [];
    const twinIds = picked
      ? (
          await db
            .select({ id: competitionSeasons.id })
            .from(competitionSeasons)
            .where(
              and(
                inArray(competitionSeasons.competitionId, siblingCompIds),
                eq(competitionSeasons.year, picked.year ?? 0),
                eq(competitionSeasons.isDeprecated, false),
              ),
            )
        ).map((row) => row.id)
      : [seasonId];
    conditions.push(inArray(playerTransfers.seasonId, twinIds.length ? twinIds : [seasonId]));
  }
  if (competitionId) {
    const siblingIds = lineage?.siblingIdsById.get(competitionId) ?? [competitionId];
    const siblingSeasons = await db
      .select({ id: competitionSeasons.id })
      .from(competitionSeasons)
      .where(inArray(competitionSeasons.competitionId, siblingIds));
    const seasonIds = siblingSeasons.map((row) => row.id);
    const competitionMatch = [
      inArray(playerTransfers.competitionId, siblingIds),
      ...(seasonIds.length ? [inArray(playerTransfers.seasonId, seasonIds)] : []),
    ];
    const clause = or(...competitionMatch);
    if (clause) conditions.push(clause);
  }
  if (filters.movementType?.trim()) {
    conditions.push(eq(playerTransfers.movementType, filters.movementType.trim()));
  }
  if (teamId) {
    if (internationalTeamFilter) {
      conditions.push(
        or(
          eq(players.internationalTeamId, teamId),
          eq(playerTransfers.fromTeamId, teamId),
          eq(playerTransfers.toTeamId, teamId),
        ),
      );
    } else {
      conditions.push(
        or(eq(playerTransfers.fromTeamId, teamId), eq(playerTransfers.toTeamId, teamId)),
      );
    }
  } else if (teamQuery) {
    const q = `%${teamQuery.replace(/[%_]/g, " ")}%`;
    conditions.push(
      or(
        ilike(playerTransfers.fromClub, q),
        ilike(playerTransfers.toClub, q),
        ilike(fromTeam.name, q),
        ilike(toTeam.name, q),
      ),
    );
  }
  if (filters.search?.trim()) {
    const { phrases, codes } = expandTransferSearchTerms(filters.search);
    const searchParts = [
      ...phrases.flatMap((term) => {
        const q = `%${term.replace(/[%_]/g, " ")}%`;
        return [
          ilike(players.name, q),
          ilike(players.countryName, q),
          ilike(players.nationCode, q),
          ilike(players.clubName, q),
          ilike(intlTeam.name, q),
          ilike(playerTransfers.fromClub, q),
          ilike(playerTransfers.toClub, q),
          ilike(fromTeam.name, q),
          ilike(toTeam.name, q),
        ];
      }),
      ...codes.map((code) => sql`upper(coalesce(${players.nationCode}, '')) = ${code}`),
    ];
    const searchClause = or(...searchParts);
    if (searchClause) conditions.push(searchClause);
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const orderBy =
    sortDir === "asc"
      ? asc(playerTransfers.effectiveDate)
      : desc(playerTransfers.effectiveDate);

  const displayRating = sql<number | null>`coalesce(${playerRatings.manualOverrideRating}, ${playerRatings.playerRating})`;
  const playerImage = sql<string | null>`coalesce(${players.imageUrl}, ${players.badgeImageUrl})`;

  const base = db
    .select({
      id: playerTransfers.id,
      playerId: playerTransfers.playerId,
      playerSlug: players.slug,
      playerName: players.name,
      playerImageUrl: playerImage,
      primaryImageId: players.primaryImageId,
      transferPositionName: playerTransfers.positionName,
      playerPositionName: players.positionName,
      playerRating: displayRating,
      internationalTeamId: players.internationalTeamId,
      internationalTeamName: intlTeam.name,
      nationCode: players.nationCode,
      countryName: players.countryName,
      clubName: players.clubName,
      movementType: playerTransfers.movementType,
      notes: playerTransfers.notes,
      fromTeamId: playerTransfers.fromTeamId,
      toTeamId: playerTransfers.toTeamId,
      fromTeamName: fromTeam.name,
      toTeamName: toTeam.name,
      fromTeamImageUrl: fromTeam.imageUrl,
      toTeamImageUrl: toTeam.imageUrl,
      fromClub: playerTransfers.fromClub,
      toClub: playerTransfers.toClub,
      effectiveDate: playerTransfers.effectiveDate,
      seasonId: playerTransfers.seasonId,
      seasonLabel: competitionSeasons.label,
      competitionId: playerTransfers.competitionId,
      competitionName: competitions.name,
    })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .leftJoin(playerRatings, eq(players.id, playerRatings.playerId))
    .leftJoin(intlTeam, eq(players.internationalTeamId, intlTeam.id))
    .leftJoin(fromTeam, eq(playerTransfers.fromTeamId, fromTeam.id))
    .leftJoin(toTeam, eq(playerTransfers.toTeamId, toTeam.id))
    .leftJoin(competitionSeasons, eq(playerTransfers.seasonId, competitionSeasons.id))
    .leftJoin(competitions, eq(playerTransfers.competitionId, competitions.id));

  const rows = await (whereClause ? base.where(whereClause) : base)
    .orderBy(orderBy, asc(players.name))
    .limit(pageSize)
    .offset(offset);

  const countQuery = db
    .select({ value: sql<number>`count(*)::int` })
    .from(playerTransfers)
    .innerJoin(players, eq(playerTransfers.playerId, players.id))
    .leftJoin(intlTeam, eq(players.internationalTeamId, intlTeam.id))
    .leftJoin(fromTeam, eq(playerTransfers.fromTeamId, fromTeam.id))
    .leftJoin(toTeam, eq(playerTransfers.toTeamId, toTeam.id));

  const [countRow] = await (whereClause ? countQuery.where(whereClause) : countQuery);
  const total = Number(countRow?.value ?? 0);

  const mapped = rows.map((row) =>
    mapRow(
      {
        id: row.id,
        playerId: row.playerId,
        playerSlug: row.playerSlug,
        playerName: row.playerName,
        playerImageUrl: row.playerImageUrl,
        transferPositionName: row.transferPositionName,
        playerPositionName: row.playerPositionName,
        playerRating: row.playerRating,
        internationalTeamId: row.internationalTeamId,
        internationalTeamName: row.internationalTeamName,
        nationCode: row.nationCode,
        countryName: row.countryName,
        clubName: row.clubName,
        movementType: row.movementType,
        notes: row.notes,
        fromTeamId: row.fromTeamId,
        toTeamId: row.toTeamId,
        fromTeamName: row.fromTeamName,
        toTeamName: row.toTeamName,
        fromTeamImageUrl: row.fromTeamImageUrl,
        toTeamImageUrl: row.toTeamImageUrl,
        fromClub: row.fromClub,
        toClub: row.toClub,
        effectiveDate: row.effectiveDate,
        seasonId: row.seasonId,
        seasonLabel: row.seasonLabel,
        competitionId: row.competitionId,
        competitionName: row.competitionName,
      },
      teamClassification,
    ),
  );

  const headshots = await loadTransferHeadshots(rows);
  const transfers = await attachMissingClubCrests(
    mapped.map((row) => ({
      ...row,
      playerImageUrl: row.playerImageUrl || headshots.get(row.playerId) || null,
    })),
  );

  return {
    transfers,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    seasonId,
    competitionId,
  };
}

/** Group transfers by club for Wikipedia-style In / Out lists. */
export function groupTransfersByTeam(
  transfers: PublicTransferRow[],
  options?: { teamId?: string | null; teamQuery?: string | null; search?: string | null },
): PublicTransferTeamGroup[] {
  const byTeam = new Map<string, PublicTransferTeamGroup>();

  function ensure(teamId: string, teamName: string, teamImageUrl: string | null) {
    const key = teamName.trim().toLowerCase() || teamId;
    let group = byTeam.get(key);
    if (!group) {
      group = { teamId, teamName, teamImageUrl, in: [], out: [] };
      byTeam.set(key, group);
    } else if (!group.teamImageUrl && teamImageUrl) {
      group.teamImageUrl = teamImageUrl;
    }
    return group;
  }

  for (const row of transfers) {
    if (row.toTeamId) {
      ensure(row.toTeamId, row.toLabel === "—" ? "Unknown club" : row.toLabel, row.toTeamImageUrl).in.push(
        row,
      );
    }
    if (row.fromTeamId) {
      ensure(
        row.fromTeamId,
        row.fromLabel === "—" ? "Unknown club" : row.fromLabel,
        row.fromTeamImageUrl,
      ).out.push(row);
    }
  }

  return filterTransferClubGroups(
    [...byTeam.values()].sort((a, b) => a.teamName.localeCompare(b.teamName)),
    options,
  );
}
