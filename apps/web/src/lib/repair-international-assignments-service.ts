import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "./db";
import { linkInternationalTeamForPlayer } from "./international-team-assign-service";
import {
  isInternationalTeamId,
  isValidInternationalCountryName,
  loadTeamClassificationContext,
  playerInternationalAssignmentInvalid,
  type TeamClassificationContext,
} from "./international-team-classify";
import { parseNationalityFromBirthPlace } from "@rugby365/import-sdk";
import { countryNameLooksLikeClubTeam } from "./player-profile-fields";

export type InvalidInternationalAssignment = {
  playerId: string;
  playerName: string;
  countryName: string | null;
  clubName: string | null;
  internationalTeamId: string | null;
  internationalTeamName: string | null;
  reasons: string[];
};

export async function listInvalidInternationalAssignments(options?: {
  limit?: number;
}): Promise<InvalidInternationalAssignment[]> {
  const db = getDb();
  const ctx = await loadTeamClassificationContext(true);
  const rows = await db
    .select({
      id: players.id,
      name: players.name,
      countryName: players.countryName,
      clubName: players.clubName,
      internationalTeamId: players.internationalTeamId,
    })
    .from(players);

  const invalid: InvalidInternationalAssignment[] = [];
  for (const row of rows) {
    const internationalTeamName = row.internationalTeamId
      ? (ctx.teamNameById.get(row.internationalTeamId) ?? null)
      : null;
    const check = playerInternationalAssignmentInvalid(ctx, {
      countryName: row.countryName,
      clubName: row.clubName,
      internationalTeamId: row.internationalTeamId,
    });
    if (!check.invalid) continue;
    invalid.push({
      playerId: row.id,
      playerName: row.name,
      countryName: row.countryName,
      clubName: row.clubName,
      internationalTeamId: row.internationalTeamId,
      internationalTeamName,
      reasons: check.reasons,
    });
    if (options?.limit && invalid.length >= options.limit) break;
  }

  return invalid.sort((a, b) => a.playerName.localeCompare(b.playerName));
}

async function clearInvalidInternationalFields(
  playerId: string,
  ctx: TeamClassificationContext,
): Promise<boolean> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return false;

  const patch: {
    countryName?: string | null;
    internationalTeamId?: string | null;
    nationCode?: string | null;
  } = {};

  if (
    player.internationalTeamId &&
    !isInternationalTeamId(ctx, player.internationalTeamId)
  ) {
    patch.internationalTeamId = null;
  }

  if (player.countryName && !isValidInternationalCountryName(ctx, player.countryName, player.clubName)) {
    patch.countryName = null;
  }

  if (Object.keys(patch).length === 0) return false;

  await db.update(players).set(patch).where(eq(players.id, playerId));
  return true;
}

async function inferNationalityForPlayer(playerId: string): Promise<string | null> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return null;

  if (player.birthPlace?.trim()) {
    const fromBirth = parseNationalityFromBirthPlace(player.birthPlace);
    if (fromBirth && !countryNameLooksLikeClubTeam(fromBirth, player.clubName)) {
      return fromBirth;
    }
  }

  return null;
}

export async function repairInvalidInternationalAssignments(options?: {
  limit?: number;
  onProgress?: (message: string) => void;
}): Promise<{
  scanned: number;
  cleared: number;
  relinked: number;
  nationalityInferred: number;
  remaining: number;
}> {
  const log = options?.onProgress ?? (() => {});
  const ctx = await loadTeamClassificationContext(true);
  const invalid = await listInvalidInternationalAssignments();

  let cleared = 0;
  let relinked = 0;
  let nationalityInferred = 0;
  const batch = options?.limit ? invalid.slice(0, options.limit) : invalid;

  for (const row of batch) {
    log(`Clearing invalid international data for ${row.playerName} (${row.reasons.join("; ")})`);
    if (await clearInvalidInternationalFields(row.playerId, ctx)) cleared += 1;

    const nationality = await inferNationalityForPlayer(row.playerId);
    if (nationality) {
      await getDb()
        .update(players)
        .set({ countryName: nationality })
        .where(eq(players.id, row.playerId));
      nationalityInferred += 1;
    }

    const linked = await linkInternationalTeamForPlayer(row.playerId, {
      createTeamIfMissing: true,
    });
    if (linked.linked) relinked += 1;
  }

  const remaining = (await listInvalidInternationalAssignments()).length;
  return {
    scanned: batch.length,
    cleared,
    relinked,
    nationalityInferred,
    remaining,
  };
}
