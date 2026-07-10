import {
  hemisphereLabel,
  isKnownHemisphere,
  normalizeTeamType,
  resolveHemisphereFromDb,
  teamPassesMatchType,
  type RugbyHemisphere,
} from "../team-hemisphere-utils";
import {
  addMatchToAccumulator,
  createStandingsAccumulator,
  standingOptionalFieldsFromAccumulator,
  type StandingsAccumulator,
} from "./rugby-table-metrics-service";
import type {
  HemisphereMatchType,
  HemisphereTableMode,
  RugbyScoringRules,
  RugbyTableStandingRow,
  RugbyTableView,
  TeamFixturePerspective,
} from "./table-types";

export type HemisphereBuildResult = {
  rows: RugbyTableStandingRow[];
  unknownTeamCount: number;
  excludedMatchCount: number;
  warnings: string[];
};

function winPct(won: number, played: number): number {
  if (played <= 0) return 0;
  return Math.round((won / played) * 1000) / 10;
}

function accumulatorToRow(
  acc: StandingsAccumulator,
  options: {
    rank: number;
    hemisphere?: RugbyHemisphere;
    teamId?: string;
    teamName?: string;
    rules?: RugbyScoringRules;
  },
): RugbyTableStandingRow {
  const played = acc.played;
  const pointsDiff = acc.pointsFor - acc.pointsAgainst;
  const optionalFields = standingOptionalFieldsFromAccumulator(acc, options.rules);
  return {
    rank: options.rank,
    teamId: options.teamId ?? acc.teamId,
    teamName: options.teamName ?? acc.teamName,
    played,
    won: acc.won,
    drawn: acc.drawn,
    lost: acc.lost,
    pointsFor: acc.pointsFor,
    pointsAgainst: acc.pointsAgainst,
    pointsDiff,
    ...optionalFields,
    bonusPoints: acc.bonusPoints,
    leaguePoints: acc.leaguePoints,
    winPct: winPct(acc.won, played),
    hemisphere: options.hemisphere,
  };
}

export function perspectivePassesView(
  perspective: TeamFixturePerspective,
  tableView: RugbyTableView,
): boolean {
  if (tableView === "all") return true;
  if (tableView === "home") return perspective.side === "home";
  if (tableView === "away") return perspective.side === "away";
  if (tableView === "neutral") return perspective.isNeutralVenue === true;
  return true;
}

function matchIsIncluded(
  perspective: TeamFixturePerspective,
  includeUnknown: boolean,
): boolean {
  const teamHemisphere = perspective.teamHemisphere ?? "unknown";
  const opponentHemisphere = perspective.opponentHemisphere ?? "unknown";
  if (!includeUnknown) {
    return isKnownHemisphere(teamHemisphere) && isKnownHemisphere(opponentHemisphere);
  }
  return isKnownHemisphere(teamHemisphere) || isKnownHemisphere(opponentHemisphere) || teamHemisphere === "unknown" || opponentHemisphere === "unknown";
}

export function filterHemispherePerspectives(input: {
  perspectives: TeamFixturePerspective[];
  tableView: RugbyTableView;
  matchType: HemisphereMatchType;
  includeUnknown: boolean;
}): { perspectives: TeamFixturePerspective[]; excludedMatchCount: number } {
  const seenFixtures = new Set<string>();
  const included: TeamFixturePerspective[] = [];
  let excludedMatchCount = 0;

  for (const perspective of input.perspectives) {
    if (!perspectivePassesView(perspective, input.tableView)) continue;
    if (!teamPassesMatchType(perspective.teamType, input.matchType)) continue;
    if (!matchIsIncluded(perspective, input.includeUnknown)) {
      if (!seenFixtures.has(perspective.fixtureId)) {
        seenFixtures.add(perspective.fixtureId);
        excludedMatchCount += 1;
      }
      continue;
    }
    included.push(perspective);
  }

  return { perspectives: included, excludedMatchCount };
}

function sortBreakdownRows(rows: RugbyTableStandingRow[]): RugbyTableStandingRow[] {
  const sorted = [...rows].sort((a, b) => {
    const aWin = a.winPct ?? 0;
    const bWin = b.winPct ?? 0;
    if (bWin !== aWin) return bWin - aWin;
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    const aTries = a.triesFor ?? 0;
    const bTries = b.triesFor ?? 0;
    if (bTries !== aTries) return bTries - aTries;
    return a.teamName.localeCompare(b.teamName);
  });
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

function sortSummaryRows(
  rows: RugbyTableStandingRow[],
  includeUnknown: boolean,
): RugbyTableStandingRow[] {
  const order: RugbyHemisphere[] = includeUnknown
    ? ["northern", "southern", "unknown"]
    : ["northern", "southern"];
  const byHemisphere = new Map(rows.map((row) => [row.hemisphere, row]));
  return order
    .map((hemisphere, index) => {
      const row = byHemisphere.get(hemisphere);
      if (!row) return null;
      return { ...row, rank: index + 1 };
    })
    .filter((row): row is RugbyTableStandingRow => row != null);
}

export function countUnknownTeams(perspectives: TeamFixturePerspective[]): number {
  const unknown = new Set<string>();
  for (const perspective of perspectives) {
    if ((perspective.teamHemisphere ?? "unknown") === "unknown") {
      unknown.add(perspective.teamId);
    }
    if ((perspective.opponentHemisphere ?? "unknown") === "unknown") {
      unknown.add(perspective.opponentId);
    }
  }
  return unknown.size;
}

export function buildHemisphereTable(input: {
  perspectives: TeamFixturePerspective[];
  mode: HemisphereTableMode;
  tableView: RugbyTableView;
  matchType: HemisphereMatchType;
  includeUnknown: boolean;
  rules: RugbyScoringRules;
}): HemisphereBuildResult {
  const warnings: string[] = [];
  const unknownTeamCount = countUnknownTeams(input.perspectives);
  if (unknownTeamCount > 0 && !input.includeUnknown) {
    warnings.push(
      unknownTeamCount === 1
        ? "1 team is missing hemisphere values and is excluded from this table."
        : `${unknownTeamCount} teams are missing hemisphere values and are excluded from this table.`,
    );
  }

  const { perspectives, excludedMatchCount } = filterHemispherePerspectives({
    perspectives: input.perspectives,
    tableView: input.tableView,
    matchType: input.matchType,
    includeUnknown: input.includeUnknown,
  });

  if (input.mode === "breakdown") {
    const byTeam = new Map<string, StandingsAccumulator>();
    for (const perspective of perspectives) {
      const acc = byTeam.get(perspective.teamId) ?? createStandingsAccumulator(perspective.teamId, perspective.teamName);
      addMatchToAccumulator(acc, perspective, input.rules);
      byTeam.set(perspective.teamId, acc);
    }

    const rows = sortBreakdownRows(
      [...byTeam.entries()].map(([teamId, acc]) => {
        const sample = perspectives.find((row) => row.teamId === teamId);
        return accumulatorToRow(acc, {
          rank: 0,
          hemisphere: sample?.teamHemisphere ?? "unknown",
          rules: input.rules,
        });
      }),
    );

    return { rows, unknownTeamCount, excludedMatchCount, warnings };
  }

  const byHemisphere = new Map<RugbyHemisphere, StandingsAccumulator>();
  for (const perspective of perspectives) {
    const hemisphere = perspective.teamHemisphere ?? "unknown";
    if (!input.includeUnknown && !isKnownHemisphere(hemisphere)) continue;
    const key = hemisphere;
    const acc =
      byHemisphere.get(key) ??
      createStandingsAccumulator(`hemisphere:${key}`, hemisphereLabel(key));
    addMatchToAccumulator(acc, perspective, input.rules);
    byHemisphere.set(key, acc);
  }

  const rows = sortSummaryRows(
    [...byHemisphere.entries()].map(([hemisphere, acc]) =>
      accumulatorToRow(acc, {
        rank: 0,
        hemisphere,
        teamId: `hemisphere:${hemisphere}`,
        teamName: hemisphereLabel(hemisphere),
        rules: input.rules,
      }),
    ),
    input.includeUnknown,
  );

  return { rows, unknownTeamCount, excludedMatchCount, warnings };
}

export function assessHemisphereConfidence(input: {
  perspectives: TeamFixturePerspective[];
  rows: RugbyTableStandingRow[];
  unknownTeamCount: number;
}): "high" | "medium" | "low" {
  if (input.rows.length === 0) return "low";
  const teamCount = new Set(input.perspectives.map((row) => row.teamId)).size;
  const unknownRatio = teamCount > 0 ? input.unknownTeamCount / teamCount : 1;
  const triesMissing = input.perspectives.some(
    (row) => row.triesFor == null || row.triesAgainst == null,
  );

  if (input.unknownTeamCount === 0 && !triesMissing) return "high";
  if (unknownRatio >= 0.5 || input.rows.length === 0) return "low";
  if (input.unknownTeamCount > 0 || triesMissing) return "medium";
  return "high";
}

export function teamMetaFromDbRow(row: {
  hemisphere?: string | null;
  teamType?: string | null;
  countryName?: string | null;
  region?: string | null;
}) {
  return {
    hemisphere: resolveHemisphereFromDb(row.hemisphere),
    teamType: normalizeTeamType(row.teamType),
    countryName: row.countryName ?? null,
    region: row.region ?? null,
  };
}
