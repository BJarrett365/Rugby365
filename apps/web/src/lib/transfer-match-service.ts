import { normalizePlayerName, normalizedEntityKey, normalizeTeamName } from "./entity-normalize";
import { sanitizeTransferClub } from "./transfer-display";
import type { PlayerMatchCandidate } from "./transfer-types";

export const PREMIERSHIP_TEAM_ALIASES: Record<string, string> = {
  bath: "Bath Rugby",
  "bath rugby": "Bath Rugby",
  "bristol bears": "Bristol Bears",
  "bristol rugby": "Bristol Bears",
  bristol: "Bristol Bears",
  "exeter chiefs": "Exeter Chiefs",
  exeter: "Exeter Chiefs",
  gloucester: "Gloucester Rugby",
  "gloucester rugby": "Gloucester Rugby",
  harlequins: "Harlequins",
  "harlequin f.c.": "Harlequins",
  "harlequins f.c.": "Harlequins",
  "leicester tigers": "Leicester Tigers",
  leicester: "Leicester Tigers",
  "newcastle red bulls": "Newcastle Red Bulls",
  "newcastle falcons": "Newcastle Red Bulls",
  newcastle: "Newcastle Red Bulls",
  "northampton saints": "Northampton Saints",
  northampton: "Northampton Saints",
  "sale sharks": "Sale Sharks",
  sale: "Sale Sharks",
  saracens: "Saracens",
  "saracens f.c.": "Saracens",
  wasps: "Wasps",
  "london wasps": "Wasps",
  "worcester warriors": "Worcester Warriors",
  worcester: "Worcester Warriors",
  "london irish": "London Irish",
  "leeds carnegie": "Leeds Tykes",
  "leeds tykes": "Leeds Tykes",
  "yorkshire carnegie": "Leeds Tykes",
  sharks: "Sharks",
  "durban sharks": "Sharks",
};

export const AUTO_MATCH_THRESHOLD = 0.86;
export const REVIEW_THRESHOLD = 0.62;

type PlayerRow = {
  id: string;
  name: string;
  birthDate?: string | Date | null;
  nationCode?: string | null;
  countryName?: string | null;
  clubTeamId?: string | null;
  clubName?: string | null;
  positionName?: string | null;
};

type TeamRow = {
  id: string;
  name: string;
};

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i]![0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[a.length]![b.length]!;
}

function nameSimilarity(a: string, b: string): number {
  const left = normalizedEntityKey(a, "player");
  const right = normalizedEntityKey(b, "player");
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 0;
  return 1 - levenshtein(left, right) / maxLen;
}

export function canonicalPremiershipTeamName(input: string): string {
  const sanitized = sanitizeTransferClub(input) ?? input.trim();
  const trimmed = normalizeTeamName(sanitized);
  const key = trimmed.toLowerCase();
  return PREMIERSHIP_TEAM_ALIASES[key] ?? trimmed;
}

export function scorePlayerMatch(
  candidate: PlayerRow,
  input: {
    name: string;
    birthDate?: string | null;
    nationality?: string | null;
    currentTeamId?: string | null;
    currentTeamName?: string | null;
    positionName?: string | null;
  },
  teamById: Record<string, TeamRow>,
): PlayerMatchCandidate {
  const reasons: string[] = [];
  let score = nameSimilarity(candidate.name, input.name);
  if (score >= 0.99) reasons.push("Exact name match");
  else if (score >= 0.8) reasons.push("Strong fuzzy name match");

  if (input.birthDate && candidate.birthDate) {
    const left = String(candidate.birthDate).slice(0, 10);
    const right = input.birthDate.slice(0, 10);
    if (left === right) {
      score += 0.12;
      reasons.push("Date of birth match");
    } else {
      score -= 0.08;
    }
  }

  if (input.nationality) {
    const nat = input.nationality.toLowerCase();
    if (
      candidate.nationCode?.toLowerCase() === nat ||
      candidate.countryName?.toLowerCase().includes(nat)
    ) {
      score += 0.05;
      reasons.push("Nationality match");
    }
  }

  if (input.currentTeamId && candidate.clubTeamId === input.currentTeamId) {
    score += 0.08;
    reasons.push("Current team match");
  } else if (input.currentTeamName && candidate.clubName) {
    if (normalizedEntityKey(candidate.clubName, "team") === normalizedEntityKey(input.currentTeamName, "team")) {
      score += 0.06;
      reasons.push("Current club name match");
    }
  }

  if (input.positionName && candidate.positionName) {
    if (candidate.positionName.toLowerCase() === input.positionName.toLowerCase()) {
      score += 0.04;
      reasons.push("Position match");
    }
  }

  score = Math.min(1, Math.max(0, score));

  return {
    id: candidate.id,
    name: candidate.name,
    score,
    birthDate: candidate.birthDate ? String(candidate.birthDate).slice(0, 10) : null,
    nationCode: candidate.nationCode ?? null,
    clubTeamName: candidate.clubTeamId ? teamById[candidate.clubTeamId]?.name ?? candidate.clubName ?? null : candidate.clubName ?? null,
    positionName: candidate.positionName ?? null,
    reasons,
  };
}

export function matchPlayers(input: {
  name: string;
  birthDate?: string | null;
  nationality?: string | null;
  currentTeamId?: string | null;
  currentTeamName?: string | null;
  positionName?: string | null;
  candidates: PlayerRow[];
  teams: TeamRow[];
}): PlayerMatchCandidate[] {
  const teamById = Object.fromEntries(input.teams.map((team) => [team.id, team]));
  return input.candidates
    .map((candidate) =>
      scorePlayerMatch(
        candidate,
        {
          name: input.name,
          birthDate: input.birthDate,
          nationality: input.nationality,
          currentTeamId: input.currentTeamId,
          currentTeamName: input.currentTeamName,
          positionName: input.positionName,
        },
        teamById,
      ),
    )
    .filter((candidate) => candidate.score >= REVIEW_THRESHOLD)
    .sort((a, b) => b.score - a.score);
}

export function matchTeamName(
  inputName: string,
  teams: TeamRow[],
  options?: { createAlias?: boolean },
): { teamId: string | null; teamName: string | null; matched: boolean; inputName: string } {
  const canonical = canonicalPremiershipTeamName(inputName);
  const key = normalizedEntityKey(canonical, "team");
  const exact = teams.find((team) => normalizedEntityKey(team.name, "team") === key);
  if (exact) {
    return { teamId: exact.id, teamName: exact.name, matched: true, inputName };
  }

  if (options?.createAlias) {
    const fuzzy = teams
      .map((team) => ({
        team,
        score: nameSimilarity(team.name, canonical),
      }))
      .filter((row) => row.score >= 0.82)
      .sort((a, b) => b.score - a.score)[0];
    if (fuzzy) {
      return {
        teamId: fuzzy.team.id,
        teamName: fuzzy.team.name,
        matched: true,
        inputName,
      };
    }
  }

  return { teamId: null, teamName: canonical, matched: false, inputName };
}

export function normalizeTransferPlayerName(name: string): string {
  return normalizePlayerName(name);
}
