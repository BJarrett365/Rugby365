import {
  asc,
  count,
  desc,
  eq,
  inArray,
  and,
  type SQL,
} from "drizzle-orm";
import {
  players,
  squadAuditClubs,
  squadAuditJobs,
  squadAuditLog,
  squadAuditPlayers,
  teams,
} from "@rugby365/db";
import { getDb } from "./db";
import { reconcileClubSquad } from "./club-squad-import-service";
import {
  compareClubSquadToRugby365,
  summarizeSquadComparison,
  type SquadAuditGroupType,
  type SquadComparisonRow,
  type SquadConflictType,
  type SquadMatchConfidence,
} from "./club-squad-compare-service";
import { fetchClubSquadDocument } from "./club-squad-parser-registry";
import { normalizedEntityKey } from "./entity-normalize";
import { listSeasonScopedTeams } from "./season-scoped-picker-service";
import { canonicalPremiershipTeamName } from "./transfer-match-service";
import { resolvePremiershipSeason } from "./transfer-admin-service";
import { DEFAULT_PREMIERSHIP_TRANSFER_SEASON } from "./premiership-transfer-constants";
import { and, eq } from "drizzle-orm";
import { competitionSeasons } from "@rugby365/db";

export type SquadAuditClubStatus =
  | "not_started"
  | "source_added"
  | "preview_ready"
  | "needs_review"
  | "import_approved"
  | "complete"
  | "source_failed";

export type SquadAuditJobType = "preview" | "dry_run" | "import";
export type SquadAuditJobStatus = "queued" | "running" | "completed" | "failed";

const EXETER_CHIEFS_SOURCE = {
  officialSquadUrl: "https://www.exeterchiefs.co.uk/teams/mens",
  importParser: "exeter-chiefs-rsc",
  sourceType: "club_website",
};

export type SquadAuditClubSummary = {
  teamId: string;
  teamName: string;
  teamSlug: string;
  officialClubName: string;
  officialSquadUrl: string | null;
  sourceType: string;
  backupSourceType: string | null;
  importParser: string | null;
  status: SquadAuditClubStatus;
  sourceCheckedAt: string | null;
  lastSuccessfulImportAt: string | null;
  lastError: string | null;
  playersOnOfficialSource: number;
  playersInRugby365: number;
  matched: number;
  missingInRugby365: number;
  extraInRugby365: number;
  positionConflicts: number;
  clubConflicts: number;
  missingSource: boolean;
  reviewStatus: SquadAuditClubStatus;
  latestJobId: string | null;
  latestJobStatus: SquadAuditJobStatus | null;
};

export type SquadAuditPlayerRow = {
  id: string;
  jobId: string;
  teamId: string;
  playerId: string | null;
  sourcePlayerName: string | null;
  matchedPlayerName: string | null;
  position: string | null;
  secondaryPosition: string | null;
  squadNumber: number | null;
  rugby365Position: string | null;
  rugby365SquadNumber: number | null;
  rugby365Club: string | null;
  officialClub: string | null;
  matchConfidence: SquadMatchConfidence | null;
  reviewStatus: string;
  conflictType: SquadConflictType | null;
  groupType: SquadAuditGroupType;
  sourceUrl: string | null;
  sourceType: string | null;
  sourceCheckedAt: string | null;
  notes: string | null;
};

export type SquadAuditPlayerFilters = {
  teamId: string;
  jobId?: string;
  page?: number;
  pageSize?: number;
  groupType?: SquadAuditGroupType;
  reviewStatus?: string;
  matchConfidence?: SquadMatchConfidence;
  position?: string;
  conflictType?: SquadConflictType;
  sourceType?: string;
  sortBy?: "sourcePlayerName" | "matchedPlayerName" | "matchConfidence" | "groupType";
  sortDir?: "asc" | "desc";
};

function defaultPremiershipScope() {
  return resolvePremiershipAuditSeason();
}

async function resolvePremiershipAuditSeason(seasonLabel = DEFAULT_PREMIERSHIP_TRANSFER_SEASON) {
  const db = getDb();
  const { season, competition } = await resolvePremiershipSeason(seasonLabel);
  if (!season.isDeprecated) {
    return { season, competition };
  }

  const [canonical] = await db
    .select()
    .from(competitionSeasons)
    .where(
      and(
        eq(competitionSeasons.competitionId, competition.id),
        eq(competitionSeasons.label, seasonLabel),
        eq(competitionSeasons.isDeprecated, false),
      ),
    )
    .limit(1);
  if (canonical) return { season: canonical, competition };

  const [active] = await db
    .select()
    .from(competitionSeasons)
    .where(
      and(eq(competitionSeasons.competitionId, competition.id), eq(competitionSeasons.isDeprecated, false)),
    )
    .orderBy(desc(competitionSeasons.year))
    .limit(1);
  if (!active) throw new Error("No canonical Premiership season found");
  return { season: active, competition };
}

async function resolvePremiershipScopeIds() {
  const { season, competition } = await resolvePremiershipAuditSeason();
  return { seasonId: season.id, competitionId: competition.id };
}

function exeterSeedForTeam(teamName: string) {
  if (normalizedEntityKey(canonicalPremiershipTeamName(teamName), "team") === normalizedEntityKey("Exeter Chiefs", "team")) {
    return EXETER_CHIEFS_SOURCE;
  }
  return null;
}

async function appendAuditLog(input: {
  teamId: string;
  jobId?: string;
  action: string;
  userLabel?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
}) {
  const db = getDb();
  await db.insert(squadAuditLog).values({
    teamId: input.teamId,
    jobId: input.jobId ?? null,
    action: input.action,
    userLabel: input.userLabel ?? "system",
    beforeValue: input.beforeValue ?? null,
    afterValue: input.afterValue ?? null,
  });
}

export async function syncPremiershipAuditClubs(): Promise<{ synced: number }> {
  const db = getDb();
  const { seasonId, competitionId } = await resolvePremiershipScopeIds();
  const { teams: seasonTeams } = await listSeasonScopedTeams({ competitionId, seasonId });

  let synced = 0;
  for (const team of seasonTeams) {
    const seed = exeterSeedForTeam(team.name);
    const [existing] = await db
      .select()
      .from(squadAuditClubs)
      .where(eq(squadAuditClubs.teamId, team.id))
      .limit(1);

    if (existing) {
      if (seed && !existing.officialSquadUrl) {
        await db
          .update(squadAuditClubs)
          .set({
            officialSquadUrl: seed.officialSquadUrl,
            importParser: seed.importParser,
            sourceType: seed.sourceType,
            status: "source_added",
            updatedAt: new Date(),
          })
          .where(eq(squadAuditClubs.teamId, team.id));
      }
      synced += 1;
      continue;
    }

    await db.insert(squadAuditClubs).values({
      teamId: team.id,
      officialClubName: team.name,
      competitionId,
      seasonId,
      officialSquadUrl: seed?.officialSquadUrl ?? null,
      importParser: seed?.importParser ?? null,
      sourceType: seed?.sourceType ?? "club_website",
      status: seed ? "source_added" : "not_started",
    });
    synced += 1;
  }

  return { synced };
}

async function countRugby365Squad(teamId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: count() })
    .from(players)
    .where(eq(players.clubTeamId, teamId));
  return Number(row?.total ?? 0);
}

async function latestJobForTeam(teamId: string) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(squadAuditJobs)
    .where(eq(squadAuditJobs.teamId, teamId))
    .orderBy(desc(squadAuditJobs.createdAt))
    .limit(1);
  return job ?? null;
}

export async function listSquadAuditClubSummaries(): Promise<SquadAuditClubSummary[]> {
  const db = getDb();
  await syncPremiershipAuditClubs();

  const rows = await db
    .select({
      teamId: squadAuditClubs.teamId,
      officialClubName: squadAuditClubs.officialClubName,
      officialSquadUrl: squadAuditClubs.officialSquadUrl,
      sourceType: squadAuditClubs.sourceType,
      backupSourceType: squadAuditClubs.backupSourceType,
      importParser: squadAuditClubs.importParser,
      status: squadAuditClubs.status,
      sourceCheckedAt: squadAuditClubs.sourceCheckedAt,
      lastSuccessfulImportAt: squadAuditClubs.lastSuccessfulImportAt,
      lastError: squadAuditClubs.lastError,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(squadAuditClubs)
    .innerJoin(teams, eq(squadAuditClubs.teamId, teams.id))
    .orderBy(asc(teams.name));

  const summaries: SquadAuditClubSummary[] = [];
  for (const row of rows) {
    const job = await latestJobForTeam(row.teamId);
    const report = (job?.report ?? {}) as Record<string, number>;
    const rugby365Count = await countRugby365Squad(row.teamId);
    summaries.push({
      teamId: row.teamId,
      teamName: row.teamName,
      teamSlug: row.teamSlug,
      officialClubName: row.officialClubName,
      officialSquadUrl: row.officialSquadUrl,
      sourceType: row.sourceType,
      backupSourceType: row.backupSourceType,
      importParser: row.importParser,
      status: row.status as SquadAuditClubStatus,
      sourceCheckedAt: row.sourceCheckedAt?.toISOString() ?? null,
      lastSuccessfulImportAt: row.lastSuccessfulImportAt?.toISOString() ?? null,
      lastError: row.lastError,
      playersOnOfficialSource: Number(report.officialCount ?? job?.totalPlayers ?? 0),
      playersInRugby365: rugby365Count,
      matched: Number(report.matched ?? job?.matched ?? 0),
      missingInRugby365: Number(report.missingInRugby365 ?? 0),
      extraInRugby365: Number(report.extraInRugby365 ?? rugby365Count - Number(report.matched ?? 0)),
      positionConflicts: Number(report.positionConflicts ?? 0),
      clubConflicts: Number(report.clubConflicts ?? 0),
      missingSource: !row.officialSquadUrl,
      reviewStatus: row.status as SquadAuditClubStatus,
      latestJobId: job?.id ?? null,
      latestJobStatus: (job?.status as SquadAuditJobStatus | undefined) ?? null,
    });
  }

  return summaries;
}

export async function getSquadAuditClub(teamId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      club: squadAuditClubs,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(squadAuditClubs)
    .innerJoin(teams, eq(squadAuditClubs.teamId, teams.id))
    .where(eq(squadAuditClubs.teamId, teamId))
    .limit(1);
  if (!row) return null;
  const job = await latestJobForTeam(teamId);
  const summary = await listSquadAuditClubSummaries();
  const clubSummary = summary.find((entry) => entry.teamId === teamId) ?? null;
  return {
    ...row.club,
    teamName: row.teamName,
    teamSlug: row.teamSlug,
    summary: clubSummary,
    latestJob: job,
  };
}

export async function saveSquadAuditClubSource(
  teamId: string,
  input: {
    officialSquadUrl?: string | null;
    sourceType?: string;
    backupSourceType?: string | null;
    importParser?: string | null;
    notes?: string | null;
    userLabel?: string;
  },
) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(squadAuditClubs)
    .where(eq(squadAuditClubs.teamId, teamId))
    .limit(1);
  if (!existing) throw new Error("Club audit record not found — sync clubs first");

  const nextUrl = input.officialSquadUrl ?? existing.officialSquadUrl;
  const nextStatus: SquadAuditClubStatus =
    nextUrl && (input.importParser ?? existing.importParser) ? "source_added" : existing.status as SquadAuditClubStatus;

  await db
    .update(squadAuditClubs)
    .set({
      officialSquadUrl: input.officialSquadUrl === undefined ? existing.officialSquadUrl : input.officialSquadUrl,
      sourceType: input.sourceType ?? existing.sourceType,
      backupSourceType:
        input.backupSourceType === undefined ? existing.backupSourceType : input.backupSourceType,
      importParser: input.importParser === undefined ? existing.importParser : input.importParser,
      notes: input.notes === undefined ? existing.notes : input.notes,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(squadAuditClubs.teamId, teamId));

  await appendAuditLog({
    teamId,
    action: "source_saved",
    userLabel: input.userLabel,
    beforeValue: {
      officialSquadUrl: existing.officialSquadUrl,
      importParser: existing.importParser,
      sourceType: existing.sourceType,
    },
    afterValue: {
      officialSquadUrl: nextUrl,
      importParser: input.importParser ?? existing.importParser,
      sourceType: input.sourceType ?? existing.sourceType,
    },
  });

  return getSquadAuditClub(teamId);
}

function mapComparisonToInsert(
  row: SquadComparisonRow,
  jobId: string,
  teamId: string,
  sourceCheckedAt: Date,
) {
  return {
    jobId,
    teamId,
    playerId: row.playerId,
    sourcePlayerName: row.sourcePlayerName ?? row.matchedPlayerName ?? "Unknown",
    matchedPlayerName: row.matchedPlayerName,
    position: row.position,
    secondaryPosition: row.secondaryPosition,
    squadNumber: row.squadNumber,
    rugby365Position: row.rugby365Position,
    rugby365SquadNumber: row.rugby365SquadNumber,
    rugby365Club: row.rugby365Club,
    officialClub: row.officialClub,
    matchConfidence: row.matchConfidence,
    reviewStatus:
      row.matchConfidence === "high" && row.groupType === "matched" ? "auto_approved" : "pending",
    conflictType: row.conflictType,
    groupType: row.groupType,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType,
    sourceCheckedAt,
    notes: row.notes,
  };
}

async function persistComparisonRows(
  jobId: string,
  teamId: string,
  rows: SquadComparisonRow[],
  sourceCheckedAt: Date,
) {
  const db = getDb();
  await db.delete(squadAuditPlayers).where(eq(squadAuditPlayers.jobId, jobId));
  if (!rows.length) return;
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((row) =>
      mapComparisonToInsert(row, jobId, teamId, sourceCheckedAt),
    );
    await db.insert(squadAuditPlayers).values(chunk);
  }
}

export async function enqueueSquadAuditJob(input: {
  teamId: string;
  jobType: SquadAuditJobType;
  userLabel?: string;
}) {
  const db = getDb();
  const club = await getSquadAuditClub(input.teamId);
  if (!club) throw new Error("Club not found in squad audit");

  const [job] = await db
    .insert(squadAuditJobs)
    .values({
      teamId: input.teamId,
      seasonId: club.seasonId,
      sourceUrl: club.officialSquadUrl,
      jobType: input.jobType,
      status: "queued",
    })
    .returning();

  void runSquadAuditJob(job!.id, input.userLabel).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Squad audit job failed";
    await db
      .update(squadAuditJobs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(squadAuditJobs.id, job!.id));
    await db
      .update(squadAuditClubs)
      .set({ status: "source_failed", lastError: message, updatedAt: new Date() })
      .where(eq(squadAuditClubs.teamId, input.teamId));
  });

  return job!;
}

export async function runSquadAuditJob(jobId: string, userLabel = "system") {
  const db = getDb();
  const [job] = await db.select().from(squadAuditJobs).where(eq(squadAuditJobs.id, jobId)).limit(1);
  if (!job) throw new Error("Job not found");

  const club = await getSquadAuditClub(job.teamId);
  if (!club) throw new Error("Club audit record not found");

  await db
    .update(squadAuditJobs)
    .set({ status: "running", startedAt: new Date(), progress: 5 })
    .where(eq(squadAuditJobs.id, jobId));

  const sourceCheckedAt = new Date();
  const sourceCheckedDate = sourceCheckedAt.toISOString().slice(0, 10);

  try {
    if (!club.officialSquadUrl) {
      throw new Error("Official squad URL is not configured");
    }

    const document = await fetchClubSquadDocument(club.importParser, {
      sourceUrl: club.officialSquadUrl,
      clubName: club.officialClubName,
    });

    await db
      .update(squadAuditJobs)
      .set({ progress: 35, totalPlayers: document.players.length })
      .where(eq(squadAuditJobs.id, jobId));

    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(teams);
    const comparisonRows = compareClubSquadToRugby365({
      document,
      clubTeamId: job.teamId,
      clubName: club.officialClubName,
      sourceType: club.sourceType,
      allPlayers,
      allTeams,
    });
    const summary = summarizeSquadComparison(comparisonRows);

    await persistComparisonRows(jobId, job.teamId, comparisonRows, sourceCheckedAt);

    let importReport: Awaited<ReturnType<typeof reconcileClubSquad>> | null = null;
    if (job.jobType === "dry_run") {
      importReport = await reconcileClubSquad({
        document,
        clubTeamId: job.teamId,
        clubName: club.officialClubName,
        seasonLabel: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
        sourceCheckedDate,
        dryRun: true,
      });
    } else if (job.jobType === "import") {
      importReport = await reconcileClubSquad({
        document,
        clubTeamId: job.teamId,
        clubName: club.officialClubName,
        seasonLabel: DEFAULT_PREMIERSHIP_TRANSFER_SEASON,
        sourceCheckedDate,
        dryRun: false,
      });
    }

    const nextStatus: SquadAuditClubStatus =
      summary.needsReview > 0 ? "needs_review" : job.jobType === "import" ? "complete" : "preview_ready";

    await db
      .update(squadAuditJobs)
      .set({
        status: "completed",
        progress: 100,
        matched: summary.matched,
        unmatched: summary.missingInRugby365,
        conflicts: summary.positionConflicts + summary.clubConflicts,
        report: {
          ...summary,
          transferRecordsCreated: importReport?.transfersCreated.length ?? 0,
          jobType: job.jobType,
        },
        finishedAt: new Date(),
      })
      .where(eq(squadAuditJobs.id, jobId));

    await db
      .update(squadAuditClubs)
      .set({
        sourceCheckedAt: sourceCheckedAt,
        status: nextStatus,
        lastError: null,
        lastSuccessfulImportAt: job.jobType === "import" ? sourceCheckedAt : club.lastSuccessfulImportAt,
        updatedAt: new Date(),
      })
      .where(eq(squadAuditClubs.teamId, job.teamId));

    await appendAuditLog({
      teamId: job.teamId,
      jobId,
      action: job.jobType === "import" ? "import_completed" : `${job.jobType}_completed`,
      userLabel,
      afterValue: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Squad audit failed";
    await db
      .update(squadAuditJobs)
      .set({ status: "failed", error: message, finishedAt: new Date() })
      .where(eq(squadAuditJobs.id, jobId));
    await db
      .update(squadAuditClubs)
      .set({ status: "source_failed", lastError: message, updatedAt: new Date() })
      .where(eq(squadAuditClubs.teamId, job.teamId));
    await appendAuditLog({
      teamId: job.teamId,
      jobId,
      action: "job_failed",
      userLabel,
      afterValue: { error: message },
    });
    throw error;
  }
}

export async function getSquadAuditJob(jobId: string) {
  const db = getDb();
  const [job] = await db.select().from(squadAuditJobs).where(eq(squadAuditJobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function listSquadAuditPlayers(filters: SquadAuditPlayerFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let jobId = filters.jobId;
  if (!jobId) {
    const job = await latestJobForTeam(filters.teamId);
    jobId = job?.id;
  }
  if (!jobId) {
    return { rows: [] as SquadAuditPlayerRow[], page, pageSize, total: 0, totalPages: 1 };
  }

  const conditions: SQL[] = [eq(squadAuditPlayers.jobId, jobId), eq(squadAuditPlayers.teamId, filters.teamId)];
  if (filters.groupType) conditions.push(eq(squadAuditPlayers.groupType, filters.groupType));
  if (filters.reviewStatus) conditions.push(eq(squadAuditPlayers.reviewStatus, filters.reviewStatus));
  if (filters.matchConfidence) conditions.push(eq(squadAuditPlayers.matchConfidence, filters.matchConfidence));
  if (filters.position) conditions.push(eq(squadAuditPlayers.position, filters.position));
  if (filters.conflictType) conditions.push(eq(squadAuditPlayers.conflictType, filters.conflictType));
  if (filters.sourceType) conditions.push(eq(squadAuditPlayers.sourceType, filters.sourceType));

  const whereClause = and(...conditions);
  const sortColumn =
    filters.sortBy === "matchedPlayerName"
      ? squadAuditPlayers.matchedPlayerName
      : filters.sortBy === "matchConfidence"
        ? squadAuditPlayers.matchConfidence
        : filters.sortBy === "groupType"
          ? squadAuditPlayers.groupType
          : squadAuditPlayers.sourcePlayerName;
  const order = filters.sortDir === "desc" ? desc(sortColumn) : asc(sortColumn);

  const [totalRow] = await db.select({ total: count() }).from(squadAuditPlayers).where(whereClause);
  const total = Number(totalRow?.total ?? 0);
  const rows = await db
    .select()
    .from(squadAuditPlayers)
    .where(whereClause)
    .orderBy(order)
    .limit(pageSize)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      jobId: row.jobId,
      teamId: row.teamId,
      playerId: row.playerId,
      sourcePlayerName: row.sourcePlayerName,
      matchedPlayerName: row.matchedPlayerName,
      position: row.position,
      secondaryPosition: row.secondaryPosition,
      squadNumber: row.squadNumber,
      rugby365Position: row.rugby365Position,
      rugby365SquadNumber: row.rugby365SquadNumber,
      rugby365Club: row.rugby365Club,
      officialClub: row.officialClub,
      matchConfidence: row.matchConfidence as SquadMatchConfidence | null,
      reviewStatus: row.reviewStatus,
      conflictType: row.conflictType as SquadConflictType | null,
      groupType: row.groupType as SquadAuditGroupType,
      sourceUrl: row.sourceUrl,
      sourceType: row.sourceType,
      sourceCheckedAt: row.sourceCheckedAt?.toISOString() ?? null,
      notes: row.notes,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function updateSquadAuditPlayerReview(
  playerRowIds: string[],
  reviewStatus: string,
  userLabel = "admin",
) {
  const db = getDb();
  if (!playerRowIds.length) return { updated: 0 };
  await db
    .update(squadAuditPlayers)
    .set({ reviewStatus })
    .where(inArray(squadAuditPlayers.id, playerRowIds));

  const [sample] = await db
    .select({ teamId: squadAuditPlayers.teamId, jobId: squadAuditPlayers.jobId })
    .from(squadAuditPlayers)
    .where(inArray(squadAuditPlayers.id, playerRowIds))
    .limit(1);

  if (sample?.teamId) {
    await appendAuditLog({
      teamId: sample.teamId,
      jobId: sample.jobId,
      action: reviewStatus === "approved" ? "player_approved" : "player_review_updated",
      userLabel,
      afterValue: { playerRowIds, reviewStatus },
    });
    if (reviewStatus === "approved") {
      await db
        .update(squadAuditClubs)
        .set({ status: "import_approved", updatedAt: new Date() })
        .where(eq(squadAuditClubs.teamId, sample.teamId));
    }
  }

  return { updated: playerRowIds.length };
}

export async function approveHighConfidenceMatches(teamId: string, jobId: string, userLabel = "admin") {
  const db = getDb();
  const rows = await db
    .select({ id: squadAuditPlayers.id })
    .from(squadAuditPlayers)
    .where(
      and(
        eq(squadAuditPlayers.teamId, teamId),
        eq(squadAuditPlayers.jobId, jobId),
        eq(squadAuditPlayers.matchConfidence, "high"),
        eq(squadAuditPlayers.groupType, "matched"),
      ),
    );
  return updateSquadAuditPlayerReview(
    rows.map((row) => row.id),
    "approved",
    userLabel,
  );
}

export async function importApprovedSquadChanges(teamId: string, jobId: string, userLabel = "admin") {
  const db = getDb();
  const club = await getSquadAuditClub(teamId);
  if (!club?.officialSquadUrl) throw new Error("Official squad URL missing");

  const approvedCount = await db
    .select({ total: count() })
    .from(squadAuditPlayers)
    .where(
      and(
        eq(squadAuditPlayers.teamId, teamId),
        eq(squadAuditPlayers.jobId, jobId),
        eq(squadAuditPlayers.reviewStatus, "approved"),
      ),
    );
  if (!Number(approvedCount[0]?.total ?? 0)) {
    throw new Error("No approved player rows — approve changes before import");
  }

  const job = await enqueueSquadAuditJob({ teamId, jobType: "import", userLabel });
  await appendAuditLog({
    teamId,
    jobId: job.id,
    action: "import_approved_started",
    userLabel,
    afterValue: { sourceJobId: jobId },
  });
  return job;
}

export async function markSquadAuditClubComplete(teamId: string, userLabel = "admin") {
  const db = getDb();
  await db
    .update(squadAuditClubs)
    .set({ status: "complete", updatedAt: new Date() })
    .where(eq(squadAuditClubs.teamId, teamId));
  await appendAuditLog({
    teamId,
    action: "club_marked_complete",
    userLabel,
  });
  return getSquadAuditClub(teamId);
}

export async function listSquadAuditLog(teamId: string, limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(squadAuditLog)
    .where(eq(squadAuditLog.teamId, teamId))
    .orderBy(desc(squadAuditLog.createdAt))
    .limit(limit);
}

export async function resolvePremiershipCompetitionSeason() {
  const { season, competition } = await resolvePremiershipAuditSeason();
  return {
    competition: { id: competition.id, name: competition.name, slug: competition.slug },
    season: { id: season.id, label: season.label },
  };
}
