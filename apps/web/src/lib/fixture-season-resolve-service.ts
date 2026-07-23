import { and, eq } from "drizzle-orm";
import { competitionSeasons, competitions } from "@rugby365/db";
import { getDb } from "./db";
import { getConfirmedMapping } from "./provider-mapping-service";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";
import {
  formatSeasonLabelForKind,
  resolveFixtureSeason,
  seasonKindFromCompetitionType,
  type FixtureSeasonResolveResult,
  type SeasonCandidate,
  type SeasonKind,
} from "./fixture-season-resolve";
import { upsertSeason } from "./competition-admin-service";

export async function listSeasonCandidatesForCompetition(
  competitionId: string,
): Promise<SeasonCandidate[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: competitionSeasons.id,
      competitionId: competitionSeasons.competitionId,
      label: competitionSeasons.label,
      year: competitionSeasons.year,
      isDeprecated: competitionSeasons.isDeprecated,
      isActive: competitionSeasons.isActive,
    })
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competitionId));

  return rows;
}

export async function getCompetitionSeasonKind(competitionId: string): Promise<SeasonKind> {
  const db = getDb();
  const [row] = await db
    .select({ competitionType: competitions.competitionType })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  return seasonKindFromCompetitionType(row?.competitionType);
}

/**
 * Resolve a fixture season for a competition + kickoff.
 * Does not create seasons unless `createIfMissing` is true and confidence path is unique.
 */
export async function resolveFixtureSeasonForCompetition(input: {
  competitionId: string;
  kickoffAt: Date | string | null | undefined;
  providerSeasonLabel?: string | null;
  confirmedProviderSeasonId?: string | null;
  rugbyDataExternalSeasonId?: string | null;
  createIfMissing?: boolean;
  seasonKind?: SeasonKind;
}): Promise<FixtureSeasonResolveResult> {
  const seasonKind = input.seasonKind ?? (await getCompetitionSeasonKind(input.competitionId));

  let confirmedMappingSeasonId: string | null = null;
  if (input.rugbyDataExternalSeasonId?.trim()) {
    const mapping = await getConfirmedMapping({
      provider: PROVIDER_RUGBY_DATA,
      entityType: "season",
      externalId: String(input.rugbyDataExternalSeasonId),
    });
    if (mapping?.rugby365Id) confirmedMappingSeasonId = mapping.rugby365Id;
  }

  let candidates = await listSeasonCandidatesForCompetition(input.competitionId);
  let result = resolveFixtureSeason({
    competitionId: input.competitionId,
    kickoffAt: input.kickoffAt,
    seasonKind,
    confirmedMappingSeasonId,
    confirmedProviderSeasonId: input.confirmedProviderSeasonId,
    providerSeasonLabel: input.providerSeasonLabel,
    candidates,
  });

  if (
    result.status === "SEASON_UNMAPPED" &&
    result.startYear != null &&
    input.createIfMissing &&
    input.kickoffAt
  ) {
    const created = await upsertSeason({
      competitionId: input.competitionId,
      label: formatSeasonLabelForKind(result.startYear, seasonKind),
      seasonKind,
    });
    candidates = await listSeasonCandidatesForCompetition(input.competitionId);
    result = resolveFixtureSeason({
      competitionId: input.competitionId,
      kickoffAt: input.kickoffAt,
      seasonKind,
      confirmedMappingSeasonId,
      confirmedProviderSeasonId: input.confirmedProviderSeasonId,
      providerSeasonLabel: input.providerSeasonLabel,
      candidates,
    });
    if (!result.seasonId && created?.id) {
      return {
        ...result,
        seasonId: created.id,
        label: created.label,
        startYear: created.year,
        confidence: 75,
        reason: "created_season_from_kickoff",
        needsReview: false,
        status: "resolved",
        candidateIds: [created.id],
        seasonKind,
      };
    }
  }

  return result;
}

export async function assertSeasonBelongsToCompetition(
  seasonId: string,
  competitionId: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ id: competitionSeasons.id })
    .from(competitionSeasons)
    .where(
      and(
        eq(competitionSeasons.id, seasonId),
        eq(competitionSeasons.competitionId, competitionId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Season does not belong to the fixture competition");
}
