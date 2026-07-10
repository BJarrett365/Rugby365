/**
 * Repair Wikipedia markup in player/team names and reconcile career status tags.
 *
 * Usage:
 *   npx tsx scripts/clean-transfer-wiki-markup.ts
 *   npx tsx scripts/clean-transfer-wiki-markup.ts --dry-run
 */
import { eq } from "drizzle-orm";
import { playerTransfers, players, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { reconcileAllPlayerCareerStatuses } from "../apps/web/src/lib/player-career-status-service";
import {
  playerNameNeedsWikiCleanup,
  normalizePlayerCareerStatus,
} from "../apps/web/src/lib/player-career-status";
import {
  hasTransferClubDebris,
  isJunkTeamPickerName,
  sanitizeTransferClub,
  sanitizeTransferPlayerNameWithStatus,
} from "../apps/web/src/lib/transfer-display";

const dryRun = process.argv.includes("--dry-run");

function needsWikiCleanup(value: string): boolean {
  return (
    playerNameNeedsWikiCleanup(value) ||
    value.includes("{{") ||
    value.includes("<ref") ||
    value.includes("|url=")
  );
}

function needsClubCleanup(value: string): boolean {
  if (isJunkTeamPickerName(value)) return true;
  if (hasTransferClubDebris(value)) return true;
  const cleaned = sanitizeTransferClub(value);
  return (
    value.includes("{{") ||
    value.includes("<ref") ||
    value.includes("<span") ||
    value.includes("|url=") ||
    value.includes("→") ||
    (cleaned !== null && cleaned !== value)
  );
}

async function main() {
  const db = getDb();
  const allTeams = await db.select().from(teams);
  const teamById = new Map(allTeams.map((team) => [team.id, team.name]));

  let playersUpdated = 0;
  let statusesUpdated = 0;
  const playerRows = await db.select().from(players);
  for (const player of playerRows) {
    if (!needsWikiCleanup(player.name)) continue;
    const parsed = sanitizeTransferPlayerNameWithStatus(player.name);
    const nextStatus = parsed.statusHint
      ? normalizePlayerCareerStatus(parsed.statusHint)
      : player.careerStatus;
    const dirty =
      parsed.name !== player.name ||
      (parsed.statusHint && nextStatus !== player.careerStatus);
    if (!dirty) continue;
    playersUpdated += 1;
    if (parsed.statusHint && nextStatus !== player.careerStatus) statusesUpdated += 1;
    if (!dryRun) {
      await db
        .update(players)
        .set({
          name: parsed.name,
          ...(parsed.statusHint ? { careerStatus: nextStatus } : {}),
        })
        .where(eq(players.id, player.id));
    }
  }

  let teamsUpdated = 0;
  let teamsRemoved = 0;
  for (const team of allTeams) {
    const cleaned = sanitizeTransferClub(team.name);
    if (isJunkTeamPickerName(team.name) || isJunkTeamPickerName(cleaned)) {
      if (!dryRun) {
        try {
          await db.delete(teams).where(eq(teams.id, team.id));
          teamsRemoved += 1;
          teamById.delete(team.id);
        } catch {
          // Referenced by transfers/fixtures — picker filters these out.
        }
      } else {
        teamsRemoved += 1;
      }
      continue;
    }
    if (!needsClubCleanup(team.name)) continue;
    if (!cleaned || cleaned === team.name) continue;
    teamsUpdated += 1;
    teamById.set(team.id, cleaned);
    if (!dryRun) {
      await db.update(teams).set({ name: cleaned }).where(eq(teams.id, team.id));
    }
  }

  let transfersUpdated = 0;
  const transferRows = await db.select().from(playerTransfers);
  for (const transfer of transferRows) {
    const fromClub =
      (transfer.fromTeamId ? teamById.get(transfer.fromTeamId) : null) ??
      sanitizeTransferClub(transfer.fromClub);
    const toClub =
      (transfer.toTeamId ? teamById.get(transfer.toTeamId) : null) ??
      sanitizeTransferClub(transfer.toClub);

    const dirty =
      needsClubCleanup(transfer.fromClub ?? "") ||
      needsClubCleanup(transfer.toClub ?? "") ||
      fromClub !== transfer.fromClub ||
      toClub !== transfer.toClub;

    if (!dirty) continue;
    transfersUpdated += 1;
    if (!dryRun) {
      await db
        .update(playerTransfers)
        .set({ fromClub, toClub })
        .where(eq(playerTransfers.id, transfer.id));
    }
  }

  const seen = new Map<string, string>();
  let duplicatesRemoved = 0;
  for (const transfer of transferRows) {
    const fromClub =
      sanitizeTransferClub(
        (transfer.fromTeamId ? teamById.get(transfer.fromTeamId) : null) ?? transfer.fromClub,
      ) ?? "none";
    const toClub =
      sanitizeTransferClub(
        (transfer.toTeamId ? teamById.get(transfer.toTeamId) : null) ?? transfer.toClub,
      ) ?? "none";
    const key = [
      transfer.playerId,
      transfer.seasonId ?? "none",
      fromClub,
      toClub,
      transfer.movementType,
    ].join(":");
    const existingId = seen.get(key);
    if (!existingId) {
      seen.set(key, transfer.id);
      continue;
    }
    duplicatesRemoved += 1;
    if (!dryRun) {
      await db.delete(playerTransfers).where(eq(playerTransfers.id, transfer.id));
    }
  }

  let reconcileSummary: Awaited<ReturnType<typeof reconcileAllPlayerCareerStatuses>> | null = null;
  if (!dryRun) {
    reconcileSummary = await reconcileAllPlayerCareerStatuses();
  }

  console.log(
    `\n${dryRun ? "[dry-run] " : ""}Updated ${playersUpdated} players (${statusesUpdated} status hints), ${teamsUpdated} teams, removed ${teamsRemoved} junk teams, ${transfersUpdated} transfers, removed ${duplicatesRemoved} duplicates.`,
  );
  if (reconcileSummary) {
    console.log(
      `Career status reconcile: ${reconcileSummary.updated}/${reconcileSummary.total} changed`,
      reconcileSummary.byStatus,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
