import type { ParsedClubSquadDocument, ParsedClubSquadPlayer } from "@rugby365/import-sdk";
import { normalizedEntityKey } from "./entity-normalize";
import {
  AUTO_MATCH_THRESHOLD,
  REVIEW_THRESHOLD,
  canonicalPremiershipTeamName,
  matchPlayers,
} from "./transfer-match-service";

export type SquadMatchConfidence = "high" | "medium" | "low";

export type SquadAuditGroupType =
  | "matched"
  | "missing_in_rugby365"
  | "extra_in_rugby365"
  | "conflicting";

export type SquadConflictType =
  | "current_club_conflict"
  | "position_conflict"
  | "duplicate_player"
  | "missing_player"
  | "extra_player"
  | "missing_source"
  | "missing_squad_number"
  | "possible_departure"
  | "possible_arrival"
  | "name_mismatch"
  | "academy_senior_mismatch";

export type SquadComparisonRow = {
  sourcePlayerName: string | null;
  matchedPlayerName: string | null;
  playerId: string | null;
  position: string | null;
  secondaryPosition: string | null;
  squadNumber: number | null;
  rugby365Position: string | null;
  rugby365SquadNumber: number | null;
  rugby365Club: string | null;
  officialClub: string;
  matchConfidence: SquadMatchConfidence | null;
  matchScore: number | null;
  conflictType: SquadConflictType | null;
  groupType: SquadAuditGroupType;
  sourceUrl: string;
  sourceType: string;
  notes: string | null;
};

type PlayerRow = {
  id: string;
  name: string;
  birthDate?: string | Date | null;
  nationCode?: string | null;
  countryName?: string | null;
  clubTeamId?: string | null;
  clubName?: string | null;
  positionName?: string | null;
  squadNumber?: number | null;
};

type TeamRow = {
  id: string;
  name: string;
};

export function scoreToMatchConfidence(score: number | null): SquadMatchConfidence | null {
  if (score == null) return "low";
  if (score >= AUTO_MATCH_THRESHOLD) return "high";
  if (score >= REVIEW_THRESHOLD) return "medium";
  return "low";
}

function positionsDiffer(current: string | null | undefined, next: string | null): boolean {
  if (!next) return false;
  return (current ?? "").trim().toLowerCase() !== next.trim().toLowerCase();
}

function splitPositions(positionName: string | null): { primary: string | null; secondary: string | null } {
  if (!positionName) return { primary: null, secondary: null };
  const parts = positionName.split("/").map((part) => part.trim()).filter(Boolean);
  return {
    primary: parts[0] ?? null,
    secondary: parts[1] ?? null,
  };
}

function resolveClubLabel(
  player: PlayerRow,
  teamById: Record<string, TeamRow>,
): string | null {
  if (player.clubTeamId && teamById[player.clubTeamId]) {
    return teamById[player.clubTeamId]!.name;
  }
  return player.clubName ?? null;
}

function atTargetClub(
  player: PlayerRow,
  clubTeamId: string,
  clubName: string,
  teamById: Record<string, TeamRow>,
): boolean {
  const currentClubLabel = resolveClubLabel(player, teamById);
  return (
    player.clubTeamId === clubTeamId ||
    (currentClubLabel != null &&
      normalizedEntityKey(canonicalPremiershipTeamName(currentClubLabel), "team") ===
        normalizedEntityKey(clubName, "team"))
  );
}

function buildOfficialRowBase(
  entry: ParsedClubSquadPlayer,
  clubName: string,
  document: ParsedClubSquadDocument,
  sourceType: string,
): Pick<
  SquadComparisonRow,
  | "sourcePlayerName"
  | "position"
  | "secondaryPosition"
  | "squadNumber"
  | "officialClub"
  | "sourceUrl"
  | "sourceType"
> {
  const { primary, secondary } = splitPositions(entry.positionName);
  return {
    sourcePlayerName: entry.name,
    position: primary,
    secondaryPosition: secondary,
    squadNumber: entry.squadNumber,
    officialClub: clubName,
    sourceUrl: document.sourceUrl,
    sourceType,
  };
}

export function compareClubSquadToRugby365(input: {
  document: ParsedClubSquadDocument;
  clubTeamId: string;
  clubName: string;
  sourceType: string;
  allPlayers: PlayerRow[];
  allTeams: TeamRow[];
}): SquadComparisonRow[] {
  const rows: SquadComparisonRow[] = [];
  const teamById = Object.fromEntries(input.allTeams.map((team) => [team.id, team]));
  const matchedPlayerIds = new Set<string>();

  for (const entry of input.document.players) {
    const base = buildOfficialRowBase(entry, input.clubName, input.document, input.sourceType);
    const candidates = matchPlayers({
      name: entry.name,
      positionName: entry.positionName ?? undefined,
      currentTeamId: input.clubTeamId,
      currentTeamName: input.clubName,
      candidates: input.allPlayers,
      teams: input.allTeams,
    });

    const best = candidates[0];
    const score = best?.score ?? null;
    const confidence = scoreToMatchConfidence(score);

    if (!best || score == null || score < REVIEW_THRESHOLD) {
      rows.push({
        ...base,
        matchedPlayerName: null,
        playerId: null,
        rugby365Position: null,
        rugby365SquadNumber: null,
        rugby365Club: null,
        matchConfidence: "low",
        matchScore: score,
        conflictType: "missing_player",
        groupType: "missing_in_rugby365",
        notes: "No confident Rugby365 match — create or link manually.",
      });
      continue;
    }

    if (score < AUTO_MATCH_THRESHOLD) {
      rows.push({
        ...base,
        matchedPlayerName: best.name,
        playerId: best.id,
        rugby365Position: input.allPlayers.find((player) => player.id === best.id)?.positionName ?? null,
        rugby365SquadNumber:
          input.allPlayers.find((player) => player.id === best.id)?.squadNumber ?? null,
        rugby365Club: resolveClubLabel(
          input.allPlayers.find((player) => player.id === best.id) ?? { id: best.id, name: best.name },
          teamById,
        ),
        matchConfidence: confidence,
        matchScore: score,
        conflictType: "name_mismatch",
        groupType: "conflicting",
        notes: `Ambiguous match (${Math.round(score * 100)}%) — review required.`,
      });
      continue;
    }

    const existing = input.allPlayers.find((player) => player.id === best.id);
    if (!existing) continue;

    const officialKey = normalizedEntityKey(entry.name, "player");
    const matchedKey = normalizedEntityKey(existing.name, "player");
    if (officialKey !== matchedKey && score < 0.95) {
      rows.push({
        ...base,
        matchedPlayerName: existing.name,
        playerId: existing.id,
        rugby365Position: existing.positionName ?? null,
        rugby365SquadNumber: existing.squadNumber ?? null,
        rugby365Club: resolveClubLabel(existing, teamById),
        matchConfidence: confidence,
        matchScore: score,
        conflictType: "name_mismatch",
        groupType: "conflicting",
        notes: `Official name differs from Rugby365 (${Math.round(score * 100)}%).`,
      });
      continue;
    }

    matchedPlayerIds.add(existing.id);
    const rugby365Club = resolveClubLabel(existing, teamById);
    const atClub = atTargetClub(existing, input.clubTeamId, input.clubName, teamById);
    const hasOtherClub =
      existing.clubTeamId != null && existing.clubTeamId !== input.clubTeamId && !atClub;
    const positionConflict = positionsDiffer(existing.positionName, entry.positionName);
    const conflicts: SquadConflictType[] = [];
    if (hasOtherClub) conflicts.push("current_club_conflict");
    if (positionConflict) conflicts.push("position_conflict");
    if (entry.squadNumber == null) conflicts.push("missing_squad_number");

    if (hasOtherClub) {
      rows.push({
        ...base,
        matchedPlayerName: existing.name,
        playerId: existing.id,
        rugby365Position: existing.positionName ?? null,
        rugby365SquadNumber: existing.squadNumber ?? null,
        rugby365Club,
        matchConfidence: confidence,
        matchScore: score,
        conflictType: positionConflict ? "position_conflict" : "current_club_conflict",
        groupType: "conflicting",
        notes: `Listed at ${rugby365Club ?? "another club"} in Rugby365.`,
      });
      continue;
    }

    if (positionConflict) {
      rows.push({
        ...base,
        matchedPlayerName: existing.name,
        playerId: existing.id,
        rugby365Position: existing.positionName ?? null,
        rugby365SquadNumber: existing.squadNumber ?? null,
        rugby365Club,
        matchConfidence: confidence,
        matchScore: score,
        conflictType: "position_conflict",
        groupType: "conflicting",
        notes: `Position differs: ${existing.positionName ?? "—"} vs ${entry.positionName ?? "—"}.`,
      });
      continue;
    }

    rows.push({
      ...base,
      matchedPlayerName: existing.name,
      playerId: existing.id,
      rugby365Position: existing.positionName ?? null,
      rugby365SquadNumber: existing.squadNumber ?? null,
      rugby365Club,
      matchConfidence: confidence,
      matchScore: score,
      conflictType: entry.squadNumber == null ? "missing_squad_number" : null,
      groupType: "matched",
      notes: null,
    });
  }

  const currentClubPlayers = input.allPlayers.filter((player) => player.clubTeamId === input.clubTeamId);
  for (const player of currentClubPlayers) {
    if (matchedPlayerIds.has(player.id)) continue;
    rows.push({
      sourcePlayerName: null,
      matchedPlayerName: player.name,
      playerId: player.id,
      position: null,
      secondaryPosition: null,
      squadNumber: null,
      rugby365Position: player.positionName ?? null,
      rugby365SquadNumber: player.squadNumber ?? null,
      rugby365Club: resolveClubLabel(player, teamById),
      officialClub: input.clubName,
      matchConfidence: null,
      matchScore: null,
      conflictType: "possible_departure",
      groupType: "extra_in_rugby365",
      sourceUrl: input.document.sourceUrl,
      sourceType: input.sourceType,
      notes: "On Rugby365 squad but not on official source.",
    });
  }

  return rows;
}

export function summarizeSquadComparison(rows: SquadComparisonRow[]) {
  const byGroup = (group: SquadAuditGroupType) => rows.filter((row) => row.groupType === group);
  const arrivals = byGroup("missing_in_rugby365").length;
  const departures = byGroup("extra_in_rugby365").length;
  return {
    officialCount: rows.filter((row) => row.sourcePlayerName).length,
    rugby365Count: rows.filter((row) => row.playerId && row.groupType !== "missing_in_rugby365").length,
    matched: byGroup("matched").length,
    missingInRugby365: arrivals,
    extraInRugby365: departures,
    arrivalsFound: arrivals,
    departuresFound: departures,
    positionConflicts: rows.filter((row) => row.conflictType === "position_conflict").length,
    clubConflicts: rows.filter((row) => row.conflictType === "current_club_conflict").length,
    needsReview: rows.filter(
      (row) => row.matchConfidence === "medium" || row.matchConfidence === "low" || row.groupType === "conflicting",
    ).length,
  };
}
