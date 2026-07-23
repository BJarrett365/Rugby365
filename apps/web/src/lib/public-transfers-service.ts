/**
 * Public transfers browse — read-only lean rows from player_transfers.
 */
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  competitionSeasons,
  competitions,
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
} from "./transfer-display";
import { movementTypeLabel, type TransferMovementType } from "./transfer-types";
import {
  formatSeasonRangeLabel,
  normalizeSeasonLabel,
  parseSeasonStartYear,
} from "./season-label-utils";
import { pickDefaultSeasonForPicker } from "./season-list-utils";
import { listSeasonsForPicker } from "./competition-admin-service";
import { listSeasonScopedTeams } from "./season-scoped-picker-service";
import {
  isInternationalTeamId,
  loadTeamClassificationContext,
  resolveDisplayNation,
  type TeamClassificationContext,
} from "./international-team-classify";
import {
  DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
  PREMIERSHIP_TRANSFERS_WIKI_URL,
} from "./premiership-transfer-constants";

export type PublicTransferRow = {
  id: string;
  playerId: string;
  playerSlug: string;
  playerName: string;
  positionName: string | null;
  playerRating: number | null;
  internationalStatus: string | null;
  movementType: string;
  movementLabel: string;
  fromTeamId: string | null;
  toTeamId: string | null;
  fromLabel: string;
  toLabel: string;
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
  movementType?: string | null;
  search?: string | null;
  sortDir?: "asc" | "desc" | null;
  page?: number | null;
  pageSize?: number | null;
};

export type PublicTransferTeamGroup = {
  teamId: string;
  teamName: string;
  in: PublicTransferRow[];
  out: PublicTransferRow[];
};

/** Prefer transfer position, then player profile position. */
export function resolveTransferPosition(
  transferPosition: string | null | undefined,
  playerPosition: string | null | undefined,
): string | null {
  const a = transferPosition?.trim();
  if (a) return a;
  const b = playerPosition?.trim();
  return b || null;
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
    transferPositionName: string | null;
    playerPositionName: string | null;
    playerRating: number | null;
    internationalTeamId: string | null;
    internationalTeamName: string | null;
    nationCode: string | null;
    countryName: string | null;
    clubName: string | null;
    movementType: string;
    fromTeamId: string | null;
    toTeamId: string | null;
    fromTeamName: string | null;
    toTeamName: string | null;
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
  return {
    id: input.id,
    playerId: input.playerId,
    playerSlug: input.playerSlug,
    playerName: sanitizeTransferPlayerName(input.playerName),
    positionName: resolveTransferPosition(input.transferPositionName, input.playerPositionName),
    playerRating: rating,
    internationalStatus: resolvePlayerInternationalStatus(teamClassification, {
      nationCode: input.nationCode,
      countryName: input.countryName,
      clubName: input.clubName,
      internationalTeamId: input.internationalTeamId,
      internationalTeamName: input.internationalTeamName,
    }),
    movementType: input.movementType,
    movementLabel: movementTypeLabel(input.movementType),
    fromTeamId: input.fromTeamId,
    toTeamId: input.toTeamId,
    fromLabel: transferClubLabel(input.fromTeamName, sanitizeTransferClub(input.fromClub)) || "—",
    toLabel: transferClubLabel(input.toTeamName, sanitizeTransferClub(input.toClub)) || "—",
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

async function listCompetitionsForTransferFilters(preferredCompetitionId: string) {
  const db = getDb();
  const used = await db
    .selectDistinct({ competitionId: playerTransfers.competitionId })
    .from(playerTransfers)
    .where(sql`${playerTransfers.competitionId} is not null`);

  const ids = new Set(
    used.map((r) => r.competitionId).filter((id): id is string => Boolean(id)),
  );
  ids.add(preferredCompetitionId);

  const rows = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
    .from(competitions)
    .where(inArray(competitions.id, [...ids]))
    .orderBy(asc(competitions.name));

  return [...rows].sort((a, b) => {
    if (a.id === preferredCompetitionId) return -1;
    if (b.id === preferredCompetitionId) return 1;
    if (a.slug === "premiership") return -1;
    if (b.slug === "premiership") return 1;
    return a.name.localeCompare(b.name);
  });
}

async function listClubsForTransferFilters(competitionId: string, seasonId: string | null) {
  if (seasonId) {
    try {
      const scoped = await listSeasonScopedTeams({ competitionId, seasonId });
      if (scoped.teams.length > 0) {
        return scoped.teams.map((t) => ({ id: t.id, name: t.canonicalName || t.name }));
      }
    } catch {
      /* fall through to transfer-derived clubs */
    }
  }

  const db = getDb();
  const conditions = [eq(playerTransfers.competitionId, competitionId)];
  if (seasonId) conditions.push(eq(playerTransfers.seasonId, seasonId));

  const fromIds = await db
    .selectDistinct({ teamId: playerTransfers.fromTeamId })
    .from(playerTransfers)
    .where(and(...conditions, sql`${playerTransfers.fromTeamId} is not null`));
  const toIds = await db
    .selectDistinct({ teamId: playerTransfers.toTeamId })
    .from(playerTransfers)
    .where(and(...conditions, sql`${playerTransfers.toTeamId} is not null`));

  const ids = [
    ...new Set(
      [...fromIds, ...toIds]
        .map((r) => r.teamId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!ids.length) return [];

  const teamRows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, ids))
    .orderBy(asc(teams.name));

  return teamRows;
}

export async function getPublicTransferFilterOptions(input?: {
  competitionId?: string | null;
  seasonId?: string | null;
}) {
  const defaults = await getPublicTransferDefaults();
  const compId = input?.competitionId?.trim() || defaults.competitionId;
  let seasonRows = await listSeasonsForPicker(compId);
  seasonRows = [...seasonRows].sort((a, b) => b.year - a.year);

  // For Premiership, guarantee Wiki current season is in the list
  if (compId === defaults.competitionId && !seasonRows.some((s) => s.year === defaults.seasonYear)) {
    const { upsertSeason } = await import("./competition-admin-service");
    await upsertSeason({
      competitionId: compId,
      label: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
      isActive: true,
    });
    seasonRows = [...(await listSeasonsForPicker(compId))].sort((a, b) => b.year - a.year);
  }

  let seasonId = input?.seasonId?.trim() || null;
  if (seasonId && !seasonRows.some((s) => s.id === seasonId)) {
    seasonId = null; // stale URL / deleted season
  }
  if (!seasonId && compId === defaults.competitionId) {
    seasonId = defaults.seasonId;
  } else if (!seasonId) {
    const preferredYear = defaults.seasonYear;
    seasonId =
      seasonRows.find((s) => s.year === preferredYear)?.id ??
      pickDefaultSeasonForPicker(seasonRows)?.id ??
      seasonRows[0]?.id ??
      null;
  }

  const [competitionRows, teamRows] = await Promise.all([
    listCompetitionsForTransferFilters(defaults.competitionId),
    listClubsForTransferFilters(compId, seasonId),
  ]);

  return {
    defaults: {
      competitionId: defaults.competitionId,
      seasonId: defaults.seasonId,
      seasonLabel: defaults.seasonLabel,
      seasonYear: defaults.seasonYear,
      wikiUrl: defaults.wikiUrl,
    },
    competitions: competitionRows.map((c) => ({ id: c.id, name: c.name })),
    seasons: seasonRows.map((s) => ({
      id: s.id,
      label: s.label,
      displayLabel: s.displayLabel,
      year: s.year,
      competitionId: s.competitionId ?? compId,
    })),
    teams: teamRows,
    selectedCompetitionId: compId,
    selectedSeasonId: seasonId,
    movementTypes: [
      "permanent",
      "loan",
      "released",
      "contract_extension",
      "academy_promotion",
      "retirement",
    ] as TransferMovementType[],
  };
}

export async function listPublicTransfers(filters: PublicTransferFilters = {}) {
  const db = getDb();
  const defaults = await getPublicTransferDefaults();
  const seasonId =
    filters.seasonId === undefined
      ? defaults.seasonId
      : filters.seasonId?.trim() || null;
  const competitionId =
    filters.competitionId === undefined
      ? defaults.competitionId
      : filters.competitionId?.trim() || null;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, filters.pageSize ?? 200));
  const offset = (page - 1) * pageSize;
  const sortDir = filters.sortDir === "asc" ? "asc" : "desc";

  const fromTeam = alias(teams, "public_transfer_from_team");
  const toTeam = alias(teams, "public_transfer_to_team");
  const intlTeam = alias(teams, "public_transfer_intl_team");

  const conditions = [];
  if (seasonId) conditions.push(eq(playerTransfers.seasonId, seasonId));
  if (competitionId) conditions.push(eq(playerTransfers.competitionId, competitionId));
  if (filters.movementType?.trim()) {
    conditions.push(eq(playerTransfers.movementType, filters.movementType.trim()));
  }
  if (filters.teamId?.trim()) {
    const teamId = filters.teamId.trim();
    conditions.push(
      or(eq(playerTransfers.fromTeamId, teamId), eq(playerTransfers.toTeamId, teamId)),
    );
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(players.name, q),
        ilike(playerTransfers.fromClub, q),
        ilike(playerTransfers.toClub, q),
        ilike(fromTeam.name, q),
        ilike(toTeam.name, q),
      ),
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const orderBy =
    sortDir === "asc"
      ? asc(playerTransfers.effectiveDate)
      : desc(playerTransfers.effectiveDate);

  const displayRating = sql<number | null>`coalesce(${playerRatings.manualOverrideRating}, ${playerRatings.playerRating})`;
  const teamClassification = await loadTeamClassificationContext();

  const base = db
    .select({
      id: playerTransfers.id,
      playerId: playerTransfers.playerId,
      playerSlug: players.slug,
      playerName: players.name,
      transferPositionName: playerTransfers.positionName,
      playerPositionName: players.positionName,
      playerRating: displayRating,
      internationalTeamId: players.internationalTeamId,
      internationalTeamName: intlTeam.name,
      nationCode: players.nationCode,
      countryName: players.countryName,
      clubName: players.clubName,
      movementType: playerTransfers.movementType,
      fromTeamId: playerTransfers.fromTeamId,
      toTeamId: playerTransfers.toTeamId,
      fromTeamName: fromTeam.name,
      toTeamName: toTeam.name,
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
    .leftJoin(fromTeam, eq(playerTransfers.fromTeamId, fromTeam.id))
    .leftJoin(toTeam, eq(playerTransfers.toTeamId, toTeam.id));

  const [countRow] = await (whereClause ? countQuery.where(whereClause) : countQuery);
  const total = Number(countRow?.value ?? 0);

  const transfers = rows.map((row) =>
    mapRow(
      {
        id: row.id,
        playerId: row.playerId,
        playerSlug: row.playerSlug,
        playerName: row.playerName,
        transferPositionName: row.transferPositionName,
        playerPositionName: row.playerPositionName,
        playerRating: row.playerRating,
        internationalTeamId: row.internationalTeamId,
        internationalTeamName: row.internationalTeamName,
        nationCode: row.nationCode,
        countryName: row.countryName,
        clubName: row.clubName,
        movementType: row.movementType,
        fromTeamId: row.fromTeamId,
        toTeamId: row.toTeamId,
        fromTeamName: row.fromTeamName,
        toTeamName: row.toTeamName,
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
export function groupTransfersByTeam(transfers: PublicTransferRow[]): PublicTransferTeamGroup[] {
  const byTeam = new Map<string, PublicTransferTeamGroup>();

  function ensure(teamId: string, teamName: string) {
    let group = byTeam.get(teamId);
    if (!group) {
      group = { teamId, teamName, in: [], out: [] };
      byTeam.set(teamId, group);
    }
    return group;
  }

  for (const row of transfers) {
    if (row.toTeamId) {
      ensure(row.toTeamId, row.toLabel === "—" ? "Unknown club" : row.toLabel).in.push(row);
    }
    if (row.fromTeamId) {
      ensure(row.fromTeamId, row.fromLabel === "—" ? "Unknown club" : row.fromLabel).out.push(row);
    }
  }

  return [...byTeam.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
}
