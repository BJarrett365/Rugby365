#!/usr/bin/env npx tsx
/**
 * Full Premiership season mapping audit — read-only.
 *
 * Usage: npx tsx scripts/audit-premiership-seasons.ts [--json]
 */
import { and, eq, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures, standingRows, teams } from "@rugby365/db";
import {
  dedupeSeasonsByYear,
  type SeasonPickerRow,
} from "../apps/web/src/lib/season-list-utils";
import {
  formatSeasonRangeLabel,
  kickoffInSeason,
  parseSeasonStartYear,
} from "../apps/web/src/lib/season-label-utils";
import { PREMIERSHIP_CHAMPIONS } from "../apps/web/src/lib/competition-champions-catalog";
import { isPlayoffRound } from "@rugby365/import-sdk";
import { getCompetitionBySlug, reportDuplicateCompetitionSeasons } from "../apps/web/src/lib/competition-admin-service";
import { getDb } from "../apps/web/src/lib/db";

const COMPETITION_SLUG = "premiership";
const asJson = process.argv.includes("--json");

type SeasonAuditRow = {
  startYear: number;
  label: string;
  expectedChampion: string;
  canonicalSeasonId: string | null;
  canonicalSlug: string | null;
  duplicateSeasonIds: string[];
  deprecatedSeasonIds: string[];
  standingsRows: number;
  standingsTeams: number;
  playedMin: number | null;
  playedMax: number | null;
  playedMismatch: boolean;
  regularFixtures: number;
  playoffFixtures: number;
  completedRegular: number;
  completedPlayoff: number;
  fixturesWithAttendance: number;
  snapshotSeasonMismatches: number;
  calendarYearLeakFixtures: number;
  status: "ok" | "warn" | "fail" | "missing";
  issues: string[];
};

function expectedGamesForSeason(startYear: number, teamCount: number): number | null {
  if (teamCount < 2) return null;
  // Standard double round-robin when all teams play each other home and away
  return (teamCount - 1) * 2;
}

async function main() {
  const competition = await getCompetitionBySlug(COMPETITION_SLUG);
  if (!competition) {
    console.error(`Competition not found: ${COMPETITION_SLUG}`);
    process.exit(1);
  }

  const db = getDb();
  const allSeasonRows = await db
    .select()
    .from(competitionSeasons)
    .where(eq(competitionSeasons.competitionId, competition.id))
    .orderBy(sql`${competitionSeasons.year} desc`);

  const duplicates = await reportDuplicateCompetitionSeasons(competition.id);

  const allFixtures = await db
    .select({
      id: fixtures.id,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
      round: fixtures.round,
      attendance: fixtures.attendance,
      providerSnapshot: fixtures.providerSnapshot,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(fixtures)
    .where(eq(fixtures.competitionId, competition.id));

  const teamNames = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamById = Object.fromEntries(teamNames.map((t) => [t.id, t.name]));

  const audits: SeasonAuditRow[] = [];

  for (const champion of [...PREMIERSHIP_CHAMPIONS].sort((a, b) => b.startYear - a.startYear)) {
    const startYear = champion.startYear;
    const label = formatSeasonRangeLabel(startYear);
    const issues: string[] = [];

    const seasonRecords = allSeasonRows.filter(
      (row) => (row.year ?? parseSeasonStartYear(row.label)) === startYear,
    );
    const activeRecords = seasonRecords.filter((row) => !row.isDeprecated);
    const deprecatedRecords = seasonRecords.filter((row) => row.isDeprecated);

    const deduped = dedupeSeasonsByYear(
      activeRecords.map((row) => ({
        id: row.id,
        label: row.label,
        year: row.year ?? startYear,
        competitionId: competition.id,
        isActive: row.isActive,
      })) satisfies SeasonPickerRow[],
    );
    const canonical = deduped[0] ?? null;
    const canonicalRecord = canonical
      ? seasonRecords.find((row) => row.id === canonical.id) ?? null
      : null;

    if (seasonRecords.length === 0) {
      issues.push("No season record in database");
    }
    if (activeRecords.length > 1) {
      issues.push(
        `${activeRecords.length} active season records for ${label}: ${activeRecords.map((r) => `${r.label}(${r.slug})`).join(", ")}`,
      );
    }
    if (deprecatedRecords.length > 0) {
      issues.push(
        `${deprecatedRecords.length} deprecated record(s): ${deprecatedRecords.map((r) => r.id).join(", ")}`,
      );
    }

    let standingsRows = 0;
    let playedValues: number[] = [];
    if (canonical) {
      const rows = await db
        .select({
          played: standingRows.played,
          rank: standingRows.rank,
          teamId: standingRows.teamId,
        })
        .from(standingRows)
        .where(
          and(eq(standingRows.seasonId, canonical.id), eq(standingRows.view, "overall")),
        );
      standingsRows = rows.length;
      playedValues = rows.map((r) => r.played).filter((p) => p > 0);

      // Standings on non-canonical seasons
      for (const row of activeRecords) {
        if (row.id === canonical.id) continue;
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(standingRows)
          .where(eq(standingRows.seasonId, row.id));
        const count = Number(countRow?.count ?? 0);
        if (count > 0) {
          issues.push(`${count} standings rows still on duplicate season ${row.label} (${row.id})`);
        }
      }
    } else {
      // Orphan standings on any record for this year
      for (const row of seasonRecords) {
        const [countRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(standingRows)
          .where(eq(standingRows.seasonId, row.id));
        const count = Number(countRow?.count ?? 0);
        if (count > 0) {
          issues.push(`${count} standings on non-canonical season ${row.label} (${row.id})`);
        }
      }
    }

    const seasonFixtures = allFixtures.filter(
      (f) => f.kickoffAt && kickoffInSeason(f.kickoffAt, startYear),
    );
    const regularFixtures = seasonFixtures.filter((f) => !isPlayoffRound(f.round));
    const playoffFixtures = seasonFixtures.filter((f) => isPlayoffRound(f.round));
    const completedRegular = regularFixtures.filter((f) => f.status === "full_time").length;
    const completedPlayoff = playoffFixtures.filter((f) => f.status === "full_time").length;
    const fixturesWithAttendance = seasonFixtures.filter((f) => f.attendance != null && f.attendance > 0).length;

    // Fixtures assigned to wrong snapshot seasonId
    let snapshotSeasonMismatches = 0;
    if (canonical) {
      for (const f of seasonFixtures) {
        const snap = f.providerSnapshot as { livesport?: { seasonId?: string } } | null;
        const snapSeasonId = snap?.livesport?.seasonId;
        if (snapSeasonId && snapSeasonId !== canonical.id) snapshotSeasonMismatches += 1;
      }
    }

    // Calendar-year filter would leak wrong-season fixtures
    const calendarYearLeakFixtures = allFixtures.filter((f) => {
      if (!f.kickoffAt) return false;
      const calYear = f.kickoffAt.getFullYear();
      if (calYear !== startYear && calYear !== startYear + 1) return false;
      return !kickoffInSeason(f.kickoffAt, startYear);
    }).length;

    const playedMin = playedValues.length ? Math.min(...playedValues) : null;
    const playedMax = playedValues.length ? Math.max(...playedValues) : null;
    const playedMismatch = playedMin != null && playedMax != null && playedMin !== playedMax;

    const expectedGames = expectedGamesForSeason(startYear, standingsRows);
    if (standingsRows === 0) issues.push("No standings rows");
    if (standingsRows > 0 && standingsRows < 10) issues.push(`Only ${standingsRows} teams in table`);
    if (playedMismatch) issues.push(`Games played range ${playedMin}–${playedMax}`);
    if (expectedGames != null && playedMax != null && playedMax < expectedGames) {
      issues.push(`Expected ~${expectedGames} games per team, max played is ${playedMax}`);
    }
    if (regularFixtures.length === 0) issues.push("No regular-season fixtures in kickoff window");
    if (playoffFixtures.length === 0 && startYear <= 2024) {
      issues.push("No playoff fixtures detected");
    }
    if (snapshotSeasonMismatches > 0) {
      issues.push(`${snapshotSeasonMismatches} fixtures have provider snapshot seasonId mismatch`);
    }
    if (calendarYearLeakFixtures > 0) {
      issues.push(`${calendarYearLeakFixtures} fixtures in calendar overlap but outside season window`);
    }

    const dupGroup = duplicates.find((d) => d.year === startYear);
    if (dupGroup && dupGroup.seasons.length > 1) {
      issues.push(
        `Duplicate group: ${dupGroup.seasons.map((s) => `${s.label}/${s.slug} standings=${s.standingsCount}`).join("; ")}`,
      );
    }

    let status: SeasonAuditRow["status"] = "ok";
    if (seasonRecords.length === 0 || standingsRows === 0) status = "missing";
    else if (issues.length > 0) status = playedMismatch || standingsRows < 10 ? "fail" : "warn";

    audits.push({
      startYear,
      label,
      expectedChampion: champion.winner,
      canonicalSeasonId: canonical?.id ?? null,
      canonicalSlug: canonicalRecord?.slug ?? null,
      duplicateSeasonIds: activeRecords.filter((r) => r.id !== canonical?.id).map((r) => r.id),
      deprecatedSeasonIds: deprecatedRecords.map((r) => r.id),
      standingsRows,
      standingsTeams: standingsRows,
      playedMin,
      playedMax,
      playedMismatch,
      regularFixtures: regularFixtures.length,
      playoffFixtures: playoffFixtures.length,
      completedRegular,
      completedPlayoff,
      fixturesWithAttendance,
      snapshotSeasonMismatches,
      calendarYearLeakFixtures,
      status,
      issues,
    });
  }

  const summary = {
    competition: { id: competition.id, slug: competition.slug, name: competition.name },
    totalSeasonRecords: allSeasonRows.length,
    activeSeasonRecords: allSeasonRows.filter((r) => !r.isDeprecated).length,
    deprecatedSeasonRecords: allSeasonRows.filter((r) => r.isDeprecated).length,
    duplicateGroups: duplicates.length,
    totalFixtures: allFixtures.length,
    seasonsAudited: audits.length,
    statusCounts: {
      ok: audits.filter((a) => a.status === "ok").length,
      warn: audits.filter((a) => a.status === "warn").length,
      fail: audits.filter((a) => a.status === "fail").length,
      missing: audits.filter((a) => a.status === "missing").length,
    },
    schemaGaps: {
      competitionSeasonsHasWinnerField: false,
      fixturesHasSeasonIdFk: false,
      standingRowsHasPointsDeduction: false,
      winnerStoredInDatabase: false,
    },
    audits,
    duplicateDetails: duplicates,
    allSeasonRecords: allSeasonRows.map((r) => ({
      id: r.id,
      label: r.label,
      slug: r.slug,
      year: r.year,
      isActive: r.isActive,
      isDeprecated: r.isDeprecated,
      sourceProvider: r.sourceProvider,
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`\n# Premiership Rugby Season Audit\n`);
  console.log(`Competition: ${competition.name} (${competition.id})`);
  console.log(`Season records: ${summary.totalSeasonRecords} (${summary.activeSeasonRecords} active, ${summary.deprecatedSeasonRecords} deprecated)`);
  console.log(`Duplicate year groups: ${summary.duplicateGroups}`);
  console.log(`Total fixtures (all seasons): ${summary.totalFixtures}\n`);

  console.log(`## Schema notes`);
  console.log(`- competition_seasons.champion_team_id + wikipedia_source_url (populated by Wikipedia import)`);
  console.log(`- fixtures.season_id + fixtures.stage (regular | semi_final | final)`);
  console.log(`- standing_rows includes try_bonus_points / losing_bonus_points / points_deduction\n`);

  console.log(
    `| Season | Teams | P range | Regular Fx | Playoff Fx | Attendance | Champion (expected) | Status |`,
  );
  console.log(`| ------ | ----: | ------- | ---------: | ---------: | ---------: | ------------------- | ------ |`);
  for (const row of audits) {
    const pRange =
      row.playedMin != null && row.playedMax != null ? `${row.playedMin}–${row.playedMax}` : "—";
    console.log(
      `| ${row.label} | ${row.standingsTeams} | ${pRange} | ${row.completedRegular}/${row.regularFixtures} | ${row.completedPlayoff}/${row.playoffFixtures} | ${row.fixturesWithAttendance} | ${row.expectedChampion} | ${row.status.toUpperCase()} |`,
    );
  }

  console.log(`\n## Per-season issues\n`);
  for (const row of audits.filter((a) => a.issues.length > 0)) {
    console.log(`### ${row.label}`);
    if (row.canonicalSeasonId) console.log(`Canonical: ${row.canonicalSeasonId} (${row.canonicalSlug})`);
    for (const issue of row.issues) console.log(`- ${issue}`);
    console.log("");
  }

  if (duplicates.length > 0) {
    console.log(`## Duplicate season groups\n`);
    for (const group of duplicates) {
      console.log(`**${group.canonicalLabel}** (year ${group.year})`);
      for (const s of group.seasons) {
        console.log(`  - ${s.label} / ${s.slug} — id=${s.id}, standings=${s.standingsCount}, deprecated=${s.isDeprecated}, score=${s.score}`);
      }
      console.log("");
    }
  }

  console.log(`## All season records in DB\n`);
  for (const r of summary.allSeasonRecords) {
    console.log(
      `- ${r.label} (${r.slug}) year=${r.year} active=${r.isActive} deprecated=${r.isDeprecated} id=${r.id} provider=${r.sourceProvider}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
