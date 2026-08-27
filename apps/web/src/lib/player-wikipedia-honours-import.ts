/**
 * Upsert Wikipedia player Honours into shared achievements (idempotent via dedupe_key).
 */
import "server-only";

import { achievements } from "@rugby365/db";
import type { WikipediaPlayerArchive } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { buildAchievementDedupeKey } from "./achievement-types";

export async function importWikipediaPlayerHonours(
  playerId: string,
  archive: Pick<WikipediaPlayerArchive, "honours" | "wikipediaUrl">,
): Promise<{ upserted: number }> {
  const rows = archive.honours ?? [];
  if (!rows.length) return { upserted: 0 };

  const db = getDb();
  let upserted = 0;

  for (const row of rows) {
    const achievementType = row.kind === "team_honour" ? "TEAM_HONOUR" : "PERSONAL_AWARD";
    const title =
      row.kind === "personal_award" && row.groupLabel?.toLowerCase().includes("myplayers")
        ? `MyPlayers ${row.title}`.replace(/^MyPlayers MyPlayers\s+/i, "MyPlayers ")
        : row.title;

    const dedupeKey = buildAchievementDedupeKey({
      achievementType,
      // Title-based key so Wikipedia + curated seeds merge cleanly.
      competitionName: title,
      year: row.year,
      teamName: row.kind === "team_honour" ? (row.teamName ?? null) : null,
      roleType: "PLAYER",
      placing: row.placing,
    });

    // Prefer more specific competition name for team honours
    const competitionName =
      row.kind === "team_honour" ? row.title : (row.groupLabel ?? row.title);

    await db
      .insert(achievements)
      .values({
        entityType: "player",
        entityId: playerId,
        achievementType,
        competitionName,
        seasonLabel: row.seasonLabel ?? null,
        teamName: row.teamName ?? null,
        titleOverride: title,
        year: row.year,
        roleType: "PLAYER",
        placing: row.placing,
        medalType: row.placing === "WINNER" ? "gold" : "none",
        honourLevel: row.kind === "team_honour" ? "championship" : "award",
        notes: row.groupLabel && row.kind === "personal_award" ? row.groupLabel : null,
        iconKey: row.kind === "team_honour" ? "trophy_major" : "award_player",
        showOnOverview: row.placing === "WINNER",
        eligibleForSnapshot: true,
        visibility: "public",
        verificationStatus: "verified",
        verifiedAt: new Date(),
        verifiedBy: "wikipedia-honours",
        legacySourceTable: "wikipedia",
        dedupeKey,
        sortOrder: 0,
      })
      .onConflictDoUpdate({
        target: [achievements.entityType, achievements.entityId, achievements.dedupeKey],
        set: {
          titleOverride: title,
          competitionName,
          seasonLabel: row.seasonLabel ?? null,
          teamName: row.teamName ?? null,
          placing: row.placing,
          medalType: row.placing === "WINNER" ? "gold" : "none",
          honourLevel: row.kind === "team_honour" ? "championship" : "award",
          notes: row.groupLabel && row.kind === "personal_award" ? row.groupLabel : null,
          iconKey: row.kind === "team_honour" ? "trophy_major" : "award_player",
          showOnOverview: row.placing === "WINNER",
          visibility: "public",
          verificationStatus: "verified",
          verifiedAt: new Date(),
          verifiedBy: "wikipedia-honours",
          legacySourceTable: "wikipedia",
          updatedAt: new Date(),
        },
      });
    upserted += 1;
  }

  return { upserted };
}
