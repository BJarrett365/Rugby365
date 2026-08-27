/**
 * Derive player_transfers from Wikipedia club career stints (adjacent club moves).
 */
import { and, asc, eq } from "drizzle-orm";
import { playerCareerStints } from "@rugby365/db";
import { getDb } from "./db";
import { createTransferRecord } from "./transfer-admin-service";
import { normalizeTeamName } from "./entity-normalize";

function slugPart(value: string): string {
  return normalizeTeamName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function effectiveDateIso(year: number | null | undefined): string {
  const y = year && year > 1900 ? year : new Date().getUTCFullYear();
  return `${y}-07-01T00:00:00.000Z`;
}

export type CareerTransferSyncResult = {
  playerId: string;
  stints: number;
  created: number;
  updated: number;
  skipped: number;
};

/**
 * For club stints ordered by career progression, create one transfer per club change
 * (e.g. Western Province → Stormers → Sharks).
 */
export async function syncTransfersFromClubCareerStints(
  playerId: string,
): Promise<CareerTransferSyncResult> {
  const db = getDb();
  const stints = await db
    .select()
    .from(playerCareerStints)
    .where(
      and(eq(playerCareerStints.playerId, playerId), eq(playerCareerStints.careerType, "club")),
    )
    .orderBy(asc(playerCareerStints.sortOrder), asc(playerCareerStints.startYear));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < stints.length - 1; i++) {
    const from = stints[i]!;
    const to = stints[i + 1]!;
    const fromName = from.teamName?.trim();
    const toName = to.teamName?.trim();
    if (!fromName || !toName) {
      skipped += 1;
      continue;
    }
    if (normalizeTeamName(fromName).toLowerCase() === normalizeTeamName(toName).toLowerCase()) {
      skipped += 1;
      continue;
    }
    if (from.teamId && to.teamId && from.teamId === to.teamId) {
      skipped += 1;
      continue;
    }

    const moveYear = to.startYear ?? from.endYear ?? null;
    const importKey = `wiki-career:${playerId}:${slugPart(fromName)}>${slugPart(toName)}:${moveYear ?? "unk"}`;

    const result = await createTransferRecord({
      playerId,
      fromClub: fromName,
      toClub: toName,
      fromTeamId: from.teamId ?? undefined,
      toTeamId: to.teamId ?? undefined,
      transferType: "club",
      movementType: "permanent",
      effectiveDate: effectiveDateIso(moveYear),
      sourceProvider: "wikipedia",
      sourceUrl: from.sourceUrl ?? to.sourceUrl ?? undefined,
      importKey,
      notes: `Derived from Wikipedia club career (${from.yearsLabel ?? "?"} → ${to.yearsLabel ?? "?"})`,
      updatePlayerAssignment: false,
      skipBioRefresh: true,
    });

    if (result.skipped) skipped += 1;
    else if (result.updated) updated += 1;
    else created += 1;
  }

  return { playerId, stints: stints.length, created, updated, skipped };
}
