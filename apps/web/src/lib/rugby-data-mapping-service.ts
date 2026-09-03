import { and, eq, like } from "drizzle-orm";
import { competitions, dataIntegrationConflicts, teams } from "@rugby365/db";
import { getDb } from "./db";
import { resolveCompetition, resolveTeam } from "./entity-resolve-service";
import { normalizedEntityKey } from "./entity-normalize";
import {
  confirmMapping,
  getConfirmedMapping,
  getProviderMapping,
  listProviderMappings,
  markMappingConflict,
  resolveSeasonLabelFromApi,
  suggestMapping,
} from "./provider-mapping-service";
import {
  PROVIDER_RUGBY_DATA,
  type MappingEntityType,
  type MappingStatus,
} from "./provider-mapping-types";

export type MappingListFilters = {
  entityType?: MappingEntityType;
  status?: MappingStatus | MappingStatus[];
  limit?: number;
};

export async function listRugbyDataMappings(filters: MappingListFilters = {}) {
  const statuses = filters.status
    ? Array.isArray(filters.status)
      ? filters.status
      : [filters.status]
    : undefined;

  const rows = await listProviderMappings({
    provider: PROVIDER_RUGBY_DATA,
    entityType: filters.entityType,
    status: statuses?.[0],
    limit: filters.limit ?? 200,
  });

  if (!statuses || statuses.length <= 1) return rows;
  return rows.filter((row) => statuses.includes(row.status as MappingStatus));
}

export async function mapRugbyDataCompetition(input: {
  leagueId: number | string;
  name: string;
  seasonLabel?: string | null;
  country?: string | null;
  allowCreate?: boolean;
  jobId?: string;
}): Promise<{ competitionId: string | null; mappingStatus: MappingStatus; created: boolean }> {
  const desiredBaseCompetitionSlug = (() => {
    const lower = input.name.toLowerCase();
    // Rugby Data naming overlap guard:
    // "Autumn Nations Cup" must never map to "World Rugby Nations Cup" (and vice versa).
    if (lower.includes("autumn") && lower.includes("nations") && lower.includes("cup")) {
      return "autumn-nations-cup";
    }
    if (lower.includes("nations cup") && !lower.includes("autumn")) {
      return "world-rugby-nations-cup";
    }
    return null;
  })();

  const resolveByDesiredBaseSlug = async (baseSlug: string) => {
    const db = getDb();
    const candidates = await db
      .select()
      .from(competitions)
      .where(like(competitions.slug, `${baseSlug}%`));
    if (!candidates.length) return null;
    const nonLegacy = candidates.filter((c) => !c.slug.includes("__legacy__"));
    return nonLegacy[0] ?? candidates[0] ?? null;
  };

  const externalId = String(input.leagueId);
  const existing = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "competition",
    externalId,
  });
  if (existing?.rugby365Id) {
    if (desiredBaseCompetitionSlug) {
      const db = getDb();
      const [mappedCompetition] = await db
        .select()
        .from(competitions)
        .where(eq(competitions.id, existing.rugby365Id))
        .limit(1);

      const mappedSlug = mappedCompetition?.slug ?? "";
      const wantsAutumn = desiredBaseCompetitionSlug === "autumn-nations-cup";
      const wantsWorldNationsCup = desiredBaseCompetitionSlug === "world-rugby-nations-cup";
      const isAutumnMapped = mappedSlug.startsWith("autumn-nations-cup");
      const isWorldMapped = mappedSlug.startsWith("world-rugby-nations-cup");

      const mismatch =
        (wantsAutumn && !isAutumnMapped) || (wantsWorldNationsCup && !isWorldMapped);

      if (mismatch) {
        const corrected = await resolveByDesiredBaseSlug(desiredBaseCompetitionSlug);
        if (corrected?.id) {
          await confirmMapping({
            provider: PROVIDER_RUGBY_DATA,
            entityType: "competition",
            externalId,
            rugby365Id: corrected.id,
            rugby365Name: corrected.name,
            confirmedBy: "rugby_data_mapping",
            notes: "Auto-correct competition mapping for Autumn Nations Cup vs Nations Cup overlap",
          });
          return { competitionId: corrected.id, mappingStatus: "confirmed", created: false };
        }
      }
    }

    return { competitionId: existing.rugby365Id, mappingStatus: "confirmed", created: false };
  }

  const db = getDb();
  const allCompetitions = await db.select().from(competitions);
  const nameKey = normalizedEntityKey(input.name, "competition");
  const nameMatches = allCompetitions.filter(
    (row) => normalizedEntityKey(row.name, "competition") === nameKey,
  );

  if (nameMatches.length === 1) {
    const competition = nameMatches[0]!;
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId,
      rugby365Id: competition.id,
      rugby365Name: competition.name,
      confirmedBy: "rugby_data_mapping",
      notes: "Unique normalized name match",
    });
    return { competitionId: competition.id, mappingStatus: "confirmed", created: false };
  }

  if (nameMatches.length > 1) {
    await markMappingConflict({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId,
      conflictStatus: "ambiguous_competition_name",
      notes: `${nameMatches.length} competitions share name ${input.name}`,
    });
    if (input.jobId) {
      await queueMappingConflict({
        jobId: input.jobId,
        entityType: "competition",
        field: "name",
        primaryValue: input.name,
        secondaryValue: nameMatches.map((row) => row.name),
      });
    }
    return { competitionId: null, mappingStatus: "conflict", created: false };
  }

  if (input.allowCreate === false) {
    const { mapping } = await suggestMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "competition",
      externalId,
      externalName: input.name,
      confidenceInput: {
        entityType: "competition",
        normalisedNameMatch: true,
        candidateCount: 0,
      },
    });
    return { competitionId: null, mappingStatus: mapping.status as MappingStatus, created: false };
  }

  const competition = await resolveCompetition({
    name: input.name,
    externalProviderId: externalId,
    sourceProvider: PROVIDER_RUGBY_DATA,
  });
  if (!competition) {
    return { competitionId: null, mappingStatus: "unmapped", created: false };
  }

  await confirmMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "competition",
    externalId,
    rugby365Id: competition.id,
    rugby365Name: competition.name,
    confirmedBy: "rugby_data_import",
    notes: input.country ? `Country: ${input.country}` : undefined,
  });

  if (input.seasonLabel) {
    const seasonExternalId = `${externalId}:${input.seasonLabel}`;
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "season",
      externalId: seasonExternalId,
      rugby365Id: competition.id,
      rugby365Name: resolveSeasonLabelFromApi(input.seasonLabel) ?? input.seasonLabel,
      confirmedBy: "rugby_data_import",
    });
  }

  const created =
    competition.externalProviderId === externalId &&
    competition.sourceProvider === PROVIDER_RUGBY_DATA;

  return {
    competitionId: competition.id,
    mappingStatus: "confirmed",
    created,
  };
}

export async function mapRugbyDataTeam(input: {
  externalTeamId: number | string;
  name: string;
  competitionId?: string | null;
  imageUrl?: string | null;
  jobId?: string;
}): Promise<{ teamId: string | null; mappingStatus: MappingStatus; created: boolean }> {
  const externalId = String(input.externalTeamId);
  const existing = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "team",
    externalId,
  });
  if (existing?.rugby365Id) {
    return { teamId: existing.rugby365Id, mappingStatus: "confirmed", created: false };
  }

  const db = getDb();
  const allTeams = await db.select().from(teams);
  const nameKey = normalizedEntityKey(input.name, "team");
  const nameMatches = allTeams.filter((row) => normalizedEntityKey(row.name, "team") === nameKey);

  if (nameMatches.length > 1) {
    await markMappingConflict({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "team",
      externalId,
      conflictStatus: "ambiguous_team_name",
      notes: `${nameMatches.length} teams named ${input.name}`,
    });
    return { teamId: null, mappingStatus: "conflict", created: false };
  }

  const team = await resolveTeam({
    name: input.name,
    externalProviderId: externalId,
    createIfMissing: true,
    sourceProvider: PROVIDER_RUGBY_DATA,
    imageUrl: input.imageUrl,
  });
  if (!team) return { teamId: null, mappingStatus: "unmapped", created: false };

  const { mapping, autoConfirmEligible } = await suggestMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "team",
    externalId,
    externalName: input.name,
    rugby365Id: team.id,
    rugby365Name: team.name,
    confidenceInput: {
      entityType: "team",
      exactExternalIdMatch: team.externalProviderId === externalId,
      normalisedNameMatch: nameMatches.length === 1,
      nameUniqueInScope: nameMatches.length <= 1,
      sameCompetition: Boolean(input.competitionId),
      candidateCount: nameMatches.length,
    },
  });

  if (autoConfirmEligible || nameMatches.length === 1 || team.externalProviderId === externalId) {
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "team",
      externalId,
      rugby365Id: team.id,
      rugby365Name: team.name,
      confirmedBy: "rugby_data_mapping",
    });
    return { teamId: team.id, mappingStatus: "confirmed", created: true };
  }

  return { teamId: team.id, mappingStatus: mapping.status as MappingStatus, created: true };
}

export async function mapRugbyDataPlayer(input: {
  externalPlayerId: number | string;
  name: string;
  teamId?: string | null;
  positionName?: string | null;
  /** Bind this CMS player when names match, so hydrates do not create duplicates. */
  preferPlayerId?: string;
}): Promise<{ playerId: string | null; mappingStatus: MappingStatus }> {
  const externalId = String(input.externalPlayerId);
  const existing = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "player",
    externalId,
  });
  if (existing?.rugby365Id) {
    return { playerId: existing.rugby365Id, mappingStatus: "confirmed" };
  }

  let preferId = input.preferPlayerId ?? null;
  if (preferId) {
    const { players } = await import("@rugby365/db");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const [preferred] = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(eq(players.id, preferId))
      .limit(1);
    const { namesLikelyMatch } = await import("./player-profile-enrichment-service");
    if (!preferred || !namesLikelyMatch(preferred.name, input.name)) {
      preferId = null;
    }
  }

  const { resolvePlayer } = await import("./entity-resolve-service");
  const player = preferId
    ? { id: preferId, name: input.name, externalProviderId: externalId }
    : await resolvePlayer({
        name: input.name,
        externalProviderId: externalId,
        positionName: input.positionName ?? undefined,
        clubTeamId: input.teamId ?? undefined,
        createIfMissing: true,
        sourceProvider: PROVIDER_RUGBY_DATA,
      });
  if (!player) return { playerId: null, mappingStatus: "unmapped" };

  const { mapping, autoConfirmEligible } = await suggestMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "player",
    externalId,
    externalName: input.name,
    rugby365Id: player.id,
    rugby365Name: player.name,
    confidenceInput: {
      entityType: "player",
      exactExternalIdMatch: player.externalProviderId === externalId,
      normalisedNameMatch: true,
      nameUniqueInScope: true,
      positionMatch: Boolean(input.positionName),
      candidateCount: 1,
    },
  });

  if (autoConfirmEligible) {
    await confirmMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "player",
      externalId,
      rugby365Id: player.id,
      rugby365Name: player.name,
      confirmedBy: "rugby_data_mapping",
    });
    return { playerId: player.id, mappingStatus: "confirmed" };
  }

  return { playerId: player.id, mappingStatus: mapping.status as MappingStatus };
}

export async function confirmRugbyDataMapping(input: {
  entityType: MappingEntityType;
  externalId: string;
  rugby365Id: string;
  rugby365Name?: string | null;
  confirmedBy?: string;
  notes?: string;
}) {
  return confirmMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: input.entityType,
    externalId: input.externalId,
    rugby365Id: input.rugby365Id,
    rugby365Name: input.rugby365Name,
    confirmedBy: input.confirmedBy ?? "admin",
    notes: input.notes,
  });
}

export async function ignoreRugbyDataMapping(input: {
  entityType: MappingEntityType;
  externalId: string;
  notes?: string;
  userLabel?: string;
}) {
  const { ignoreMapping } = await import("./provider-mapping-service");
  return ignoreMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: input.entityType,
    externalId: input.externalId,
    notes: input.notes,
    userLabel: input.userLabel ?? "admin",
  });
}

export async function getRugbyDataMappingSummary() {
  const { countMappingsByStatus } = await import("./provider-mapping-service");
  const rows = await countMappingsByStatus(PROVIDER_RUGBY_DATA);
  const summary: Record<string, number> = {};
  for (const row of rows) {
    summary[row.status] = row.count;
  }
  return summary;
}

async function queueMappingConflict(input: {
  jobId?: string;
  entityType: string;
  entityId?: string | null;
  field: string;
  primaryValue: unknown;
  secondaryValue: unknown;
}) {
  const db = getDb();
  await db.insert(dataIntegrationConflicts).values({
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    field: input.field,
    primaryValue: input.primaryValue,
    secondaryValue: input.secondaryValue,
    currentValue: input.primaryValue,
    primaryProvider: PROVIDER_RUGBY_DATA,
    secondaryProvider: PROVIDER_RUGBY_DATA,
    suggestedAction: "manual_review",
    status: "open",
    jobId: input.jobId ?? null,
  });
}

export async function linkRugbyDataMatchMapping(input: {
  externalMatchId: string;
  fixtureId: string;
  fixtureName?: string | null;
}) {
  const mapping = await getProviderMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    externalId: input.externalMatchId,
  });
  if (mapping?.status === "confirmed" && mapping.rugby365Id === input.fixtureId) {
    return mapping;
  }
  return confirmMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "match",
    externalId: input.externalMatchId,
    rugby365Id: input.fixtureId,
    rugby365Name: input.fixtureName ?? undefined,
    confirmedBy: "rugby_data_import",
  });
}

export async function findCompetitionForLeague(leagueId: number | string): Promise<string | null> {
  const mapped = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "competition",
    externalId: String(leagueId),
  });
  return mapped?.rugby365Id ?? null;
}

export async function findTeamForRugbyDataId(teamId: number | string): Promise<string | null> {
  const mapped = await getConfirmedMapping({
    provider: PROVIDER_RUGBY_DATA,
    entityType: "team",
    externalId: String(teamId),
  });
  if (mapped?.rugby365Id) return mapped.rugby365Id;

  const db = getDb();
  const [byExternal] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.externalProviderId, String(teamId)))
    .limit(1);
  return byExternal?.id ?? null;
}

export async function listOpenMappingConflicts(limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(dataIntegrationConflicts)
    .where(and(eq(dataIntegrationConflicts.status, "open"), eq(dataIntegrationConflicts.primaryProvider, PROVIDER_RUGBY_DATA)))
    .limit(limit);
}
