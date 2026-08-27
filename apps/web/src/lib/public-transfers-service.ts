/**
 * Public transfers browse — read-only lean rows from player_transfers.
 */
import { and, asc, desc, eq, ilike, ne, not, or, sql } from "drizzle-orm";
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
import {
  TRANSFER_MOVEMENT_TYPES,
  movementTypeLabel,
  type TransferMovementType,
} from "./transfer-types";
import {
  formatSeasonRangeLabel,
  normalizeSeasonLabel,
  parseSeasonStartYear,
} from "./season-label-utils";
import { pickDefaultSeasonForPicker } from "./season-list-utils";
import { listSeasonsForPicker } from "./competition-admin-service";
import { isJunkTeamName, isJunkTeamSlug } from "./entity-normalize";
import { isRealCompareRosterTeamName } from "./compare-roster-team-name";
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
    toLabel:
      input.movementType === "released" &&
      !transferClubLabel(input.toTeamName, sanitizeTransferClub(input.toClub))
        ? "Released"
        : transferClubLabel(input.toTeamName, sanitizeTransferClub(input.toClub)) ||
          (input.movementType === "retirement" ? "Retired" : "—"),
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
  const rows = await db
    .select({ id: competitions.id, name: competitions.name, slug: competitions.slug })
    .from(competitions)
    .where(not(sql`${competitions.slug} like '%\\_\\_legacy\\_\\_%'`))
    .orderBy(asc(competitions.name));

  return [...rows].sort((a, b) => {
    if (a.id === preferredCompetitionId) return -1;
    if (b.id === preferredCompetitionId) return 1;
    if (a.slug === "premiership") return -1;
    if (b.slug === "premiership") return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Every real club/nation in the DB — not limited to season standings or transfer rows. */
async function listClubsForTransferFilters() {
  const db = getDb();
  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      sourceProvider: teams.sourceProvider,
    })
    .from(teams)
    .where(
      and(
        ne(teams.sourceProvider, "sync-repair"),
        not(sql`${teams.slug} like 'orphan-%'`),
      ),
    )
    .orderBy(asc(teams.name));

  return teamRows
    .filter(
      (t) =>
        !isJunkTeamSlug(t.slug) &&
        !isJunkTeamName(t.name) &&
        isRealCompareRosterTeamName(t.name),
    )
    .filter((t) => {
      const name = t.name.trim();
      // Import debris that slipped past slug/name junk checks.
      if (name.length < 2) return false;
      if (/^[,;/|-]+$/.test(name)) return false;
      if (/^,\s*/.test(name) && name.length < 8) return false;
      return true;
    })
    .map((t) => ({ id: t.id, name: t.name }));
}

async function listSeasonsForTransferFilters(competitionId: string | null) {
  if (competitionId) {
    return listSeasonsForPicker(competitionId);
  }

  // All competitions: load non-deprecated seasons with their competition id.
  const db = getDb();
  const { decorateSeasonPickerRows, dedupeSeasonsByYear } = await import("./season-list-utils");
  const rows = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      competitionId: competitionSeasons.competitionId,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.isDeprecated, false))
    .orderBy(desc(competitionSeasons.year), asc(competitionSeasons.label));

  return decorateSeasonPickerRows(
    dedupeSeasonsByYear(
      rows.map((row) => ({
        ...row,
        year: row.year ?? parseSeasonStartYear(row.label) ?? 0,
      })),
    ),
    new Date(),
    "club",
  );
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
  seasonRows = [...seasonRows].sort((a, b) => b.year - a.year);

  // For Premiership, guarantee Wiki current season is in the list
  if (compId === defaults.competitionId && !seasonRows.some((s) => s.year === defaults.seasonYear)) {
    const { upsertSeason } = await import("./competition-admin-service");
    await upsertSeason({
      competitionId: compId,
      label: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
      isActive: true,
    });
    seasonRows = [...(await listSeasonsForTransferFilters(compId))].sort((a, b) => b.year - a.year);
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
      const competitionName = competitionId
        ? competitionNameById.get(competitionId) ?? null
        : null;
      const baseLabel = s.displayLabel || s.label;
      return {
        id: s.id,
        label: s.label,
        displayLabel:
          !compId && competitionName ? `${competitionName} · ${baseLabel}` : baseLabel,
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
  const internationalTeamFilter =
    Boolean(teamId) && isInternationalTeamId(teamClassification, teamId);

  // National sides are not Premiership clubs — ignore competition/season when filtering by them.
  if (internationalTeamFilter) {
    seasonId = null;
    competitionId = null;
  }

  const conditions = [];
  if (seasonId) conditions.push(eq(playerTransfers.seasonId, seasonId));
  if (competitionId) conditions.push(eq(playerTransfers.competitionId, competitionId));
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
