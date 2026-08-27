/**
 * Seed / upsert verified public awards + honours for Sacha Feinberg-Mngomezulu.
 * Idempotent via achievements.dedupe_key.
 *
 * Usage: npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/seed-sacha-awards.ts
 */
import { eq } from "drizzle-orm";
import { achievements, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { buildAchievementDedupeKey } from "../apps/web/src/lib/achievement-types";

const SLUG = "sacha-feinberg-mngomezulu";

type SeedRow = {
  achievementType: "PERSONAL_AWARD" | "TEAM_HONOUR";
  title: string;
  year: number;
  seasonLabel?: string | null;
  placing: "WINNER" | "OTHER";
  notes?: string | null;
  honourLevel?: string;
  competitionName?: string | null;
  teamName?: string | null;
  iconKey?: string;
  showOnOverview?: boolean;
};

const ROWS: SeedRow[] = [
  // Regional / non-Wikipedia awards and nominations only.
  // Wikipedia Honours (Young Player, URC, MyPlayers, Rugby Championship) come from wiki import.
  {
    achievementType: "PERSONAL_AWARD",
    title: "Cape Town Sportsman of the Year",
    year: 2026,
    placing: "WINNER",
    honourLevel: "award",
    notes: "Cape Town Sport Council",
    iconKey: "award_player",
    showOnOverview: true,
  },
  {
    achievementType: "PERSONAL_AWARD",
    title: "Western Cape Sportsman of the Year",
    year: 2026,
    seasonLabel: "2025",
    placing: "WINNER",
    honourLevel: "award",
    notes: "Western Cape Sport Awards (ceremony Feb 2026)",
    iconKey: "award_player",
    showOnOverview: true,
  },
  {
    achievementType: "PERSONAL_AWARD",
    title: "SA Rugby Young Player of the Year",
    year: 2022,
    placing: "OTHER",
    notes: "Nominee",
    honourLevel: "award",
    iconKey: "award_player",
    showOnOverview: false,
  },
  {
    achievementType: "PERSONAL_AWARD",
    title: "Junior Springbok Player of the Year",
    year: 2022,
    placing: "OTHER",
    notes: "Nominee",
    honourLevel: "award",
    iconKey: "award_player",
    showOnOverview: false,
  },
];

async function main() {
  const db = getDb();
  const [player] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.slug, SLUG))
    .limit(1);
  if (!player) throw new Error(`Player not found: ${SLUG}`);

  let upserted = 0;
  for (const row of ROWS) {
    const dedupeKey = buildAchievementDedupeKey({
      achievementType: row.achievementType,
      competitionName: row.title,
      year: row.year,
      teamName: row.achievementType === "TEAM_HONOUR" ? (row.teamName ?? null) : null,
      roleType: "PLAYER",
      placing: row.placing,
    });

    await db
      .insert(achievements)
      .values({
        entityType: "player",
        entityId: player.id,
        achievementType: row.achievementType,
        competitionName: row.competitionName ?? row.title,
        seasonLabel: row.seasonLabel ?? null,
        teamName: row.teamName ?? null,
        titleOverride: row.title,
        year: row.year,
        roleType: "PLAYER",
        placing: row.placing,
        medalType: row.placing === "WINNER" ? "gold" : "none",
        honourLevel: row.honourLevel ?? "award",
        notes: row.notes ?? null,
        iconKey: row.iconKey ?? "award_player",
        showOnOverview: row.showOnOverview ?? false,
        eligibleForSnapshot: true,
        visibility: "public",
        verificationStatus: "verified",
        verifiedAt: new Date(),
        verifiedBy: "seed-sacha-awards",
        dedupeKey,
        sortOrder: 0,
      })
      .onConflictDoUpdate({
        target: [achievements.entityType, achievements.entityId, achievements.dedupeKey],
        set: {
          titleOverride: row.title,
          competitionName: row.competitionName ?? row.title,
          seasonLabel: row.seasonLabel ?? null,
          teamName: row.teamName ?? null,
          placing: row.placing,
          medalType: row.placing === "WINNER" ? "gold" : "none",
          honourLevel: row.honourLevel ?? "award",
          notes: row.notes ?? null,
          iconKey: row.iconKey ?? "award_player",
          showOnOverview: row.showOnOverview ?? false,
          visibility: "public",
          verificationStatus: "verified",
          verifiedAt: new Date(),
          verifiedBy: "seed-sacha-awards",
          updatedAt: new Date(),
        },
      });
    upserted += 1;
    console.log(`✓ ${row.year} ${row.title}${row.notes ? ` (${row.notes})` : ""}`);
  }

  console.log(`Upserted ${upserted} achievements for ${player.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
