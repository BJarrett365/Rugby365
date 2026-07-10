import { and, eq, gte, lt, sql } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { getDb } from "./db";
import { deleteFixture, findFixtureByExternalMatchId } from "./fixture-admin-service";
import { pickCanonicalFixture, type FixtureDedupeRow } from "./fixture-dedupe-service";
import {
  enrichFixtureFromSdmsMatch,
} from "./planet-rugby-match-import-service";
import {
  importFromPlanetRugbyTournamentUrl,
  importPlanetRugbyCompetition,
} from "./planet-rugby-import-service";
import { PLANET_RUGBY_LEAGUE_PRESETS } from "./planet-rugby-import-presets";
import { canonicalPremiershipTeamName } from "./transfer-match-service";

export type RoundEnrichmentAudit = {
  round: string;
  total: number;
  withPlanetRugbyUrl: number;
  withSquads: number;
  withEvents: number;
  complete: number;
};

export type PremiershipSeasonEnrichAudit = {
  seasonLabel: string;
  competitionId: string;
  totalFixtures: number;
  completedFixtures: number;
  fullyEnriched: number;
  missingEnrichment: number;
  rounds: RoundEnrichmentAudit[];
  gaps: Array<{
    id: string;
    slug: string;
    round: string | null;
    planetRugbyUrl: string | null;
    externalMatchId: string | null;
    squadCount: number;
    eventCount: number;
  }>;
};

function seasonKickoffBounds(seasonLabel: string): { start: Date; end: Date } {
  const startYear = Number.parseInt(seasonLabel.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) throw new Error(`Invalid season label: ${seasonLabel}`);
  return {
    start: new Date(Date.UTC(startYear, 8, 1)),
    end: new Date(Date.UTC(startYear + 1, 6, 1)),
  };
}

function canonicalFixtureDayKey(
  kickoffAt: Date | null,
  homeName: string,
  awayName: string,
): string | null {
  if (!kickoffAt) return null;
  const day = kickoffAt.toISOString().slice(0, 10);
  const home = canonicalPremiershipTeamName(homeName).toLowerCase();
  const away = canonicalPremiershipTeamName(awayName).toLowerCase();
  return `${day}:${home}:${away}`;
}

export async function auditPremiershipSeasonEnrichment(
  seasonLabel: string,
  competitionId?: string,
): Promise<PremiershipSeasonEnrichAudit> {
  const db = getDb();
  const { start, end } = seasonKickoffBounds(seasonLabel);

  let compId = competitionId;
  if (!compId) {
    const { getCompetitionBySlug } = await import("./competition-admin-service");
    const comp = await getCompetitionBySlug("premiership");
    if (!comp) throw new Error("Premiership competition not found");
    compId = comp.id;
  }

  const rows = await db
    .select({
      fixture: fixtures,
      homeName: teams.name,
    })
    .from(fixtures)
    .innerJoin(teams, eq(fixtures.homeTeamId, teams.id))
    .where(
      and(
        eq(fixtures.competitionId, compId),
        gte(fixtures.kickoffAt, start),
        lt(fixtures.kickoffAt, end),
      ),
    );

  const awayTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const awayById = Object.fromEntries(awayTeams.map((row) => [row.id, row.name]));

  const enrichedRows = await Promise.all(
    rows.map(async (row) => {
      const awayName = row.fixture.awayTeamId ? awayById[row.fixture.awayTeamId] ?? "Unknown" : "Unknown";
      const [squadRow] = await db.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM fixture_players WHERE fixture_id = ${row.fixture.id}
      `);
      const [eventRow] = await db.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM match_events WHERE fixture_id = ${row.fixture.id}
      `);
      const squadCount = Number(squadRow?.count ?? 0);
      const eventCount = Number(eventRow?.count ?? 0);
      const complete =
        Boolean(row.fixture.planetRugbyUrl) && squadCount > 0 && eventCount > 0;
      return {
        fixture: row.fixture,
        homeName: row.homeName,
        awayName,
        squadCount,
        eventCount,
        complete,
      };
    }),
  );

  const roundMap = new Map<string, RoundEnrichmentAudit>();
  const gaps: PremiershipSeasonEnrichAudit["gaps"] = [];

  for (const row of enrichedRows) {
    const round = row.fixture.round ?? "(none)";
    const bucket =
      roundMap.get(round) ??
      ({
        round,
        total: 0,
        withPlanetRugbyUrl: 0,
        withSquads: 0,
        withEvents: 0,
        complete: 0,
      } satisfies RoundEnrichmentAudit);
    bucket.total += 1;
    if (row.fixture.planetRugbyUrl) bucket.withPlanetRugbyUrl += 1;
    if (row.squadCount > 0) bucket.withSquads += 1;
    if (row.eventCount > 0) bucket.withEvents += 1;
    if (row.complete) bucket.complete += 1;
    roundMap.set(round, bucket);

    if (
      row.fixture.status === "full_time" &&
      (!row.fixture.planetRugbyUrl || row.squadCount === 0 || row.eventCount === 0)
    ) {
      gaps.push({
        id: row.fixture.id,
        slug: row.fixture.slug,
        round: row.fixture.round,
        planetRugbyUrl: row.fixture.planetRugbyUrl,
        externalMatchId: row.fixture.externalMatchId,
        squadCount: row.squadCount,
        eventCount: row.eventCount,
      });
    }
  }

  const rounds = [...roundMap.values()].sort((a, b) => {
    const roundNum = (label: string) => {
      const match = label.match(/Round\s+(\d+)/i);
      return match ? Number.parseInt(match[1]!, 10) : 999;
    };
    return roundNum(a.round) - roundNum(b.round) || a.round.localeCompare(b.round);
  });

  const completedFixtures = enrichedRows.filter((row) => row.fixture.status === "full_time").length;
  const fullyEnriched = enrichedRows.filter((row) => row.complete).length;

  return {
    seasonLabel,
    competitionId: compId,
    totalFixtures: enrichedRows.length,
    completedFixtures,
    fullyEnriched,
    missingEnrichment: gaps.length,
    rounds,
    gaps,
  };
}

export async function removeCanonicalAliasFixtureDuplicates(
  seasonLabel: string,
  competitionId?: string,
  options?: { dryRun?: boolean },
): Promise<{ removed: number; kept: number }> {
  const db = getDb();
  const dryRun = options?.dryRun ?? false;
  const { start, end } = seasonKickoffBounds(seasonLabel);

  let compId = competitionId;
  if (!compId) {
    const { getCompetitionBySlug } = await import("./competition-admin-service");
    compId = (await getCompetitionBySlug("premiership"))?.id;
  }
  if (!compId) throw new Error("Premiership competition not found");

  const rows = await db
    .select({
      fixture: fixtures,
      homeName: teams.name,
    })
    .from(fixtures)
    .innerJoin(teams, eq(fixtures.homeTeamId, teams.id))
    .where(
      and(
        eq(fixtures.competitionId, compId),
        gte(fixtures.kickoffAt, start),
        lt(fixtures.kickoffAt, end),
      ),
    );

  const awayTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const awayById = Object.fromEntries(awayTeams.map((row) => [row.id, row.name]));

  const groups = new Map<string, Array<FixtureDedupeRow & { homeName: string; awayName: string }>>();
  for (const row of rows) {
    const awayName = row.fixture.awayTeamId ? awayById[row.fixture.awayTeamId] ?? "Unknown" : "Unknown";
    const key = canonicalFixtureDayKey(row.fixture.kickoffAt, row.homeName, awayName);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push({
      ...(row.fixture as FixtureDedupeRow),
      homeName: row.homeName,
      awayName,
    });
    groups.set(key, bucket);
  }

  let removed = 0;
  let kept = 0;
  for (const candidates of groups.values()) {
    if (candidates.length < 2) continue;
    const keeper = pickCanonicalFixture(candidates);
    kept += 1;
    for (const loser of candidates) {
      if (loser.id === keeper.id) continue;
      removed += 1;
      if (!dryRun) await deleteFixture(loser.id);
    }
  }

  return { removed, kept };
}

export async function enrichPremiershipSeasonGaps(
  seasonLabel: string,
  competitionId?: string,
): Promise<{ enriched: number; failed: number; skipped: number }> {
  const audit = await auditPremiershipSeasonEnrichment(seasonLabel, competitionId);
  let enriched = 0;
  let failed = 0;
  let skipped = 0;

  for (const gap of audit.gaps) {
    const matchId = gap.externalMatchId?.trim();
    if (!matchId || matchId.includes(":")) {
      skipped += 1;
      continue;
    }
    try {
      const fixture = await findFixtureByExternalMatchId(matchId);
      if (!fixture) {
        skipped += 1;
        continue;
      }
      await enrichFixtureFromSdmsMatch(fixture.id, matchId, {
        planetRugbyUrl: gap.planetRugbyUrl ?? fixture.planetRugbyUrl ?? undefined,
      });
      enriched += 1;
    } catch {
      failed += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return { enriched, failed, skipped };
}

export async function importAndEnrichPremiershipSeason(
  seasonLabel: string,
  options?: {
    tournamentUrl?: string;
    syncStandings?: boolean;
    removeAliasDuplicates?: boolean;
    onProgress?: (message: string) => void;
  },
) {
  const preset = PLANET_RUGBY_LEAGUE_PRESETS.find((row) => row.slug === "premiership");
  const tournamentUrl =
    options?.tournamentUrl ?? preset?.url ?? "https://www.planetrugby.com/tournament/premiership/results";

  options?.onProgress?.(`Importing ${seasonLabel} fixtures, results and match details from Planet Rugby…`);
  const importResult = await importFromPlanetRugbyTournamentUrl(tournamentUrl, {
    seasonLabel,
    importFixtures: true,
    importResults: true,
    syncStandings: options?.syncStandings ?? true,
    importMatchDetails: true,
    onProgress: (event) => options?.onProgress?.(event.message),
  });

  let aliasCleanup = { removed: 0, kept: 0 };
  if (options?.removeAliasDuplicates !== false) {
    options?.onProgress?.("Removing canonical alias duplicate fixtures…");
    aliasCleanup = await removeCanonicalAliasFixtureDuplicates(
      seasonLabel,
      "competitionId" in importResult ? importResult.competitionId : undefined,
    );
  }

  options?.onProgress?.("Enriching any remaining season gaps…");
  const gapFill = await enrichPremiershipSeasonGaps(
    seasonLabel,
    "competitionId" in importResult ? importResult.competitionId : undefined,
  );

  const audit = await auditPremiershipSeasonEnrichment(
    seasonLabel,
    "competitionId" in importResult ? importResult.competitionId : undefined,
  );

  return {
    importResult,
    aliasCleanup,
    gapFill,
    audit,
  };
}

export async function reimportPremiershipSeasonFromSdms(
  seasonLabel: string,
  options?: { importMatchDetails?: boolean },
) {
  return importPlanetRugbyCompetition({
    competitionSlug: "premiership",
    seasonLabel,
    importFixtures: true,
    importResults: true,
    syncStandings: true,
    importMatchDetails: options?.importMatchDetails ?? true,
  });
}
