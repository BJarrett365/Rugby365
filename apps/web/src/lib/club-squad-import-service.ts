import { eq } from "drizzle-orm";
import type { ParsedClubSquadDocument, ParsedClubSquadPlayer } from "@rugby365/import-sdk";
import { players, teams } from "@rugby365/db";
import { getDb } from "./db";
import { normalizedEntityKey } from "./entity-normalize";
import { resolvePlayer } from "./entity-resolve-service";
import { upsertPlayerTeamMembership } from "./player-membership-service";
import type { SquadContext } from "./player-profile-fields";
import { createTransferRecord, resolvePremiershipSeason } from "./transfer-admin-service";
import {
  AUTO_MATCH_THRESHOLD,
  REVIEW_THRESHOLD,
  canonicalPremiershipTeamName,
  matchPlayers,
} from "./transfer-match-service";

export const EXETER_CHIEFS_SOURCE_URL = "https://www.exeterchiefs.co.uk/teams/mens";

export type ClubSquadImportOptions = {
  document: ParsedClubSquadDocument;
  clubTeamId: string;
  clubName?: string;
  seasonLabel?: string;
  sourceCheckedDate: string;
  dryRun?: boolean;
};

export type ClubSquadMatchedPlayer = {
  officialName: string;
  playerId: string;
  playerName: string;
  score: number;
  positionName: string | null;
};

export type ClubSquadUpdatedPlayer = {
  playerId: string;
  name: string;
  changes: string[];
};

export type ClubSquadConflict = {
  playerId: string;
  name: string;
  currentClub: string | null;
  currentTeamId: string | null;
  proposedClub: string;
};

export type ClubSquadTransferPreview = {
  playerId: string;
  playerName: string;
  fromClub: string | null;
  toClub: string;
  proposed: boolean;
  sourceUrl: string;
};

export type ClubSquadImportReport = {
  sourceUrl: string;
  sourceCheckedDate: string;
  clubName: string;
  seasonLabel: string;
  officialSquadCount: number;
  matchedExisting: ClubSquadMatchedPlayer[];
  playersUpdated: ClubSquadUpdatedPlayer[];
  newPlayersCreated: Array<{ name: string; positionName: string | null }>;
  clubConflicts: ClubSquadConflict[];
  missingPositions: string[];
  missingSquadNumbers: string[];
  transfersCreated: ClubSquadTransferPreview[];
  needsReview: Array<{
    officialName: string;
    reason: string;
    candidates?: Array<{ id: string; name: string; score: number }>;
  }>;
  notOnOfficialSquad: Array<{ playerId: string; name: string }>;
};

function transferNotes(sourceCheckedDate: string, sourceUrl: string, proposed: boolean): string {
  const prefix = proposed ? "Proposed arrival per official squad list (review required)." : "Listed on official squad.";
  return `${prefix} Source checked: ${sourceCheckedDate}. Source: ${sourceUrl}`;
}

function positionsDiffer(current: string | null | undefined, next: string | null): boolean {
  if (!next) return false;
  return (current ?? "").trim().toLowerCase() !== next.trim().toLowerCase();
}

export async function reconcileClubSquad(
  options: ClubSquadImportOptions,
): Promise<ClubSquadImportReport> {
  const db = getDb();
  const dryRun = options.dryRun ?? true;
  const clubName = options.clubName ?? options.document.clubName;
  const seasonLabel = options.seasonLabel ?? "2026–27";
  const { season, competition } = await resolvePremiershipSeason(seasonLabel);

  const allPlayers = await db.select().from(players);
  const allTeams = await db.select().from(teams);
  const teamById = Object.fromEntries(allTeams.map((team) => [team.id, team]));

  const report: ClubSquadImportReport = {
    sourceUrl: options.document.sourceUrl,
    sourceCheckedDate: options.sourceCheckedDate,
    clubName,
    seasonLabel,
    officialSquadCount: options.document.players.length,
    matchedExisting: [],
    playersUpdated: [],
    newPlayersCreated: [],
    clubConflicts: [],
    missingPositions: [],
    missingSquadNumbers: [],
    transfersCreated: [],
    needsReview: [],
    notOnOfficialSquad: [],
  };

  const squadContext: SquadContext = {
    kind: "club",
    teamId: options.clubTeamId,
    teamName: clubName,
  };

  const matchedPlayerIds = new Set<string>();

  for (const entry of options.document.players) {
    if (!entry.positionName) {
      report.missingPositions.push(entry.name);
    }
    if (entry.squadNumber == null) {
      report.missingSquadNumbers.push(entry.name);
    }

    const candidates = matchPlayers({
      name: entry.name,
      positionName: entry.positionName ?? undefined,
      currentTeamId: options.clubTeamId,
      currentTeamName: clubName,
      candidates: allPlayers,
      teams: allTeams,
    });

    const best = candidates[0];
    if (!best || best.score < REVIEW_THRESHOLD) {
      report.newPlayersCreated.push({ name: entry.name, positionName: entry.positionName });
      if (!dryRun) {
        await resolvePlayer({
          name: entry.name,
          positionName: entry.positionName ?? undefined,
          clubName,
          clubTeamId: options.clubTeamId,
          squadContext,
          createIfMissing: true,
          skipArchiveEnrich: true,
          sourceProvider: "club_website",
        });
      }
      continue;
    }

    if (best.score < AUTO_MATCH_THRESHOLD) {
      report.needsReview.push({
        officialName: entry.name,
        reason: "Ambiguous player match — manual review required before linking.",
        candidates: candidates.slice(0, 3).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          score: candidate.score,
        })),
      });
      continue;
    }

    const officialKey = normalizedEntityKey(entry.name, "player");
    const matchedKey = normalizedEntityKey(best.name, "player");
    if (officialKey !== matchedKey && best.score < 0.95) {
      report.needsReview.push({
        officialName: entry.name,
        reason: `Name mismatch with top candidate (${best.name}, ${Math.round(best.score * 100)}%).`,
        candidates: candidates.slice(0, 3).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          score: candidate.score,
        })),
      });
      continue;
    }

    const existing = allPlayers.find((player) => player.id === best.id);
    if (!existing) continue;

    matchedPlayerIds.add(existing.id);
    report.matchedExisting.push({
      officialName: entry.name,
      playerId: existing.id,
      playerName: existing.name,
      score: best.score,
      positionName: entry.positionName,
    });

    const currentClubTeam = existing.clubTeamId ? teamById[existing.clubTeamId] : null;
    const currentClubLabel =
      currentClubTeam?.name ?? existing.clubName ?? null;
    const atTargetClub =
      existing.clubTeamId === options.clubTeamId ||
      (currentClubLabel != null &&
        normalizedEntityKey(canonicalPremiershipTeamName(currentClubLabel), "team") ===
          normalizedEntityKey(clubName, "team"));
    const hasOtherClub =
      existing.clubTeamId != null &&
      existing.clubTeamId !== options.clubTeamId &&
      !atTargetClub;

    const changes: string[] = [];

    if (hasOtherClub) {
      report.clubConflicts.push({
        playerId: existing.id,
        name: existing.name,
        currentClub: currentClubLabel,
        currentTeamId: existing.clubTeamId,
        proposedClub: clubName,
      });
      report.transfersCreated.push({
        playerId: existing.id,
        playerName: existing.name,
        fromClub: currentClubLabel,
        toClub: clubName,
        proposed: true,
        sourceUrl: options.document.sourceUrl,
      });

      if (positionsDiffer(existing.positionName, entry.positionName)) {
        changes.push(`position: ${existing.positionName ?? "—"} → ${entry.positionName}`);
      }

      if (changes.length) {
        report.playersUpdated.push({ playerId: existing.id, name: existing.name, changes });
      }

      if (!dryRun) {
        if (positionsDiffer(existing.positionName, entry.positionName) && entry.positionName) {
          await db
            .update(players)
            .set({ positionName: entry.positionName })
            .where(eq(players.id, existing.id));
        }
        await createTransferRecord({
          playerId: existing.id,
          fromTeamId: existing.clubTeamId ?? undefined,
          toTeamId: options.clubTeamId,
          fromClub: currentClubLabel ?? undefined,
          toClub: clubName,
          transferType: "club",
          movementType: "permanent",
          seasonId: season.id,
          competitionId: competition.id,
          positionName: entry.positionName ?? undefined,
          effectiveDate: options.sourceCheckedDate,
          sourceProvider: "club_website",
          sourceUrl: options.document.sourceUrl,
          importKey: `club-squad:${seasonLabel}:${normalizedEntityKey(clubName, "team")}:proposed:${normalizedEntityKey(entry.name, "player")}`,
          notes: transferNotes(options.sourceCheckedDate, options.document.sourceUrl, true),
          updatePlayerAssignment: false,
        });
      }
      continue;
    }

    if (positionsDiffer(existing.positionName, entry.positionName) && entry.positionName) {
      changes.push(`position: ${existing.positionName ?? "—"} → ${entry.positionName}`);
    }
    if (!atTargetClub || existing.clubTeamId !== options.clubTeamId) {
      changes.push(`club: ${currentClubLabel ?? "—"} → ${clubName}`);
    }
    if (entry.squadNumber != null && existing.squadNumber !== entry.squadNumber) {
      changes.push(`squad number: ${existing.squadNumber ?? "—"} → ${entry.squadNumber}`);
    }

    if (changes.length) {
      report.playersUpdated.push({ playerId: existing.id, name: existing.name, changes });
    }

    if (!dryRun) {
      await resolvePlayer({
        name: existing.name,
        positionName: entry.positionName ?? undefined,
        clubName,
        clubTeamId: options.clubTeamId,
        squadContext,
        createIfMissing: false,
        skipArchiveEnrich: true,
        sourceProvider: "club_website",
      });
      if (entry.squadNumber != null) {
        await db.update(players).set({ squadNumber: entry.squadNumber }).where(eq(players.id, existing.id));
      }
      await upsertPlayerTeamMembership({
        playerId: existing.id,
        teamId: options.clubTeamId,
        seasonId: season.id,
        competitionId: competition.id,
        status: "active",
        startDate: options.sourceCheckedDate,
        sourceProvider: "club_website",
        sourceUrl: options.document.sourceUrl,
        notes: transferNotes(options.sourceCheckedDate, options.document.sourceUrl, false),
      });
    }
  }

  const currentClubPlayers = allPlayers.filter((player) => player.clubTeamId === options.clubTeamId);
  for (const player of currentClubPlayers) {
    if (!matchedPlayerIds.has(player.id)) {
      report.notOnOfficialSquad.push({ playerId: player.id, name: player.name });
    }
  }

  return report;
}

export async function resolveExeterChiefsTeam() {
  const db = getDb();
  const rows = await db.select().from(teams);
  return (
    rows.find((team) => normalizedEntityKey(team.name, "team") === normalizedEntityKey("Exeter Chiefs", "team")) ??
    rows.find((team) => team.slug.includes("exeter-chiefs")) ??
    null
  );
}

export function formatClubSquadImportReport(report: ClubSquadImportReport): string {
  const lines: string[] = [
    `# ${report.clubName} squad import (${report.seasonLabel})`,
    "",
    `Source: ${report.sourceUrl}`,
    `Source checked: ${report.sourceCheckedDate}`,
    `Official squad: ${report.officialSquadCount} players`,
    "",
    `## Matched existing (${report.matchedExisting.length})`,
  ];

  for (const row of report.matchedExisting) {
    lines.push(`- ${row.officialName} → ${row.playerName} (${Math.round(row.score * 100)}%)`);
  }

  lines.push("", `## Players updated (${report.playersUpdated.length})`);
  for (const row of report.playersUpdated) {
    lines.push(`- ${row.name}: ${row.changes.join("; ")}`);
  }

  lines.push("", `## New players (${report.newPlayersCreated.length})`);
  for (const row of report.newPlayersCreated) {
    lines.push(`- ${row.name}${row.positionName ? ` (${row.positionName})` : ""}`);
  }

  lines.push("", `## Club conflicts (${report.clubConflicts.length})`);
  for (const row of report.clubConflicts) {
    lines.push(`- ${row.name}: ${row.currentClub ?? "—"} → ${row.proposedClub} (proposed transfer, club not overwritten)`);
  }

  lines.push("", `## Transfers (${report.transfersCreated.length})`);
  for (const row of report.transfersCreated) {
    lines.push(
      `- ${row.proposed ? "[PROPOSED] " : ""}${row.playerName}: ${row.fromClub ?? "—"} → ${row.toClub} | ${row.sourceUrl}`,
    );
  }

  lines.push("", `## Missing positions (${report.missingPositions.length})`);
  if (report.missingPositions.length) {
    for (const name of report.missingPositions) lines.push(`- ${name}`);
  } else {
    lines.push("- none");
  }

  lines.push("", `## Missing squad numbers (${report.missingSquadNumbers.length})`);
  lines.push(
    report.missingSquadNumbers.length === report.officialSquadCount
      ? "- all players (no fixed squad numbers published on official list)"
      : report.missingSquadNumbers.map((name) => `- ${name}`).join("\n") || "- none",
  );

  lines.push("", `## Needs review (${report.needsReview.length})`);
  for (const row of report.needsReview) {
    lines.push(`- ${row.officialName}: ${row.reason}`);
    for (const candidate of row.candidates ?? []) {
      lines.push(`  · ${candidate.name} (${Math.round(candidate.score * 100)}%)`);
    }
  }

  lines.push("", `## Not on official squad (${report.notOnOfficialSquad.length})`);
  for (const row of report.notOnOfficialSquad) {
    lines.push(`- ${row.name}`);
  }

  return lines.join("\n");
}
