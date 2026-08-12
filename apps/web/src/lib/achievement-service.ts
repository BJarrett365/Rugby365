import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import {
  achievementSources,
  achievements,
  awardDefinitions,
  coachAwards,
  coachHonours,
  coachMedals,
} from "@rugby365/db";
import { getDb } from "./db";
import {
  buildAchievementDedupeKey,
  honourLevelFromLegacy,
  isMajorHonourWin,
  medalTypeFromPlacing,
  normalizeAwardDisplayTitle,
  placingFromLegacyAchievementType,
  roleGroupFromRoleType,
  type AchievementEntityType,
  type PublicAwardRow,
  type PublicMedalRow,
} from "./achievement-types";

export const DEFAULT_AWARD_DEFINITIONS = [
  {
    key: "WORLD_RUGBY_COACH_OF_YEAR",
    name: "World Rugby Coach of the Year",
    shortName: "Coach of the Year",
    organisation: "World Rugby",
    awardType: "personal",
    scope: "global",
    iconKey: "award_world",
  },
  {
    key: "WORLD_RUGBY_PLAYER_OF_YEAR",
    name: "World Rugby Player of the Year",
    shortName: "Player of the Year",
    organisation: "World Rugby",
    awardType: "personal",
    scope: "global",
    iconKey: "award_world",
  },
  {
    key: "PRO12_COACH_OF_SEASON",
    name: "Pro12 Coach of the Season",
    shortName: "Coach of the Season",
    organisation: "Pro12",
    awardType: "personal",
    scope: "competition",
    iconKey: "award_coach",
  },
  {
    key: "URC_COACH_OF_SEASON",
    name: "URC Coach of the Season",
    shortName: "Coach of the Season",
    organisation: "United Rugby Championship",
    awardType: "personal",
    scope: "competition",
    iconKey: "award_coach",
  },
  {
    key: "PREMIERSHIP_PLAYER_OF_SEASON",
    name: "Premiership Rugby Player of the Season",
    shortName: "Player of the Season",
    organisation: "Premiership Rugby",
    awardType: "personal",
    scope: "competition",
    iconKey: "award_player",
  },
] as const;

export async function seedAwardDefinitions(): Promise<number> {
  const db = getDb();
  let upserted = 0;
  for (const def of DEFAULT_AWARD_DEFINITIONS) {
    await db
      .insert(awardDefinitions)
      .values({
        key: def.key,
        name: def.name,
        shortName: def.shortName,
        organisation: def.organisation,
        awardType: def.awardType,
        scope: def.scope,
        iconKey: def.iconKey,
        active: true,
      })
      .onConflictDoUpdate({
        target: awardDefinitions.key,
        set: {
          name: def.name,
          shortName: def.shortName,
          organisation: def.organisation,
          awardType: def.awardType,
          scope: def.scope,
          iconKey: def.iconKey,
          active: true,
          updatedAt: new Date(),
        },
      });
    upserted += 1;
  }
  return upserted;
}

export async function listAwardDefinitions() {
  const db = getDb();
  return db
    .select()
    .from(awardDefinitions)
    .where(eq(awardDefinitions.active, true))
    .orderBy(asc(awardDefinitions.organisation), asc(awardDefinitions.name));
}

export async function findAwardDefinitionByName(awardName: string) {
  const defs = await listAwardDefinitions();
  const normalized = awardName.trim().toLowerCase().replace(/\s+/g, " ");
  const stripped = normalized.replace(/^(world rugby)\s+\1\s+/i, "$1 ");
  return (
    defs.find((d) => d.name.toLowerCase() === stripped) ??
    defs.find((d) => stripped.includes(d.name.toLowerCase())) ??
    defs.find((d) => d.name.toLowerCase().includes(stripped)) ??
    null
  );
}

export async function listEntityAchievements(
  entityType: AchievementEntityType,
  entityId: string,
  options: { publicOnly?: boolean; verifiedOnly?: boolean } = {},
) {
  const db = getDb();
  const conditions = [
    eq(achievements.entityType, entityType),
    eq(achievements.entityId, entityId),
  ];
  if (options.publicOnly) conditions.push(eq(achievements.visibility, "public"));
  if (options.verifiedOnly) {
    conditions.push(eq(achievements.verificationStatus, "verified"));
  }

  return db
    .select({
      achievement: achievements,
      award: awardDefinitions,
    })
    .from(achievements)
    .leftJoin(awardDefinitions, eq(achievements.awardDefinitionId, awardDefinitions.id))
    .where(and(...conditions))
    .orderBy(desc(achievements.year), asc(achievements.sortOrder));
}

function mapLegacyRole(roleType: string): string {
  if (roleType === "player") return "PLAYER";
  if (roleType === "coach") return "COACH";
  return roleType.toUpperCase();
}

/**
 * Bridge existing coach_honours / coach_awards / coach_medals into shared achievements.
 * Idempotent via dedupe_key + legacy_source mapping.
 */
export async function syncCoachLegacyAchievements(coachId: string): Promise<{
  honours: number;
  awards: number;
  medals: number;
}> {
  const db = getDb();
  await seedAwardDefinitions();

  const [honours, awards, medals] = await Promise.all([
    db.select().from(coachHonours).where(eq(coachHonours.coachId, coachId)),
    db.select().from(coachAwards).where(eq(coachAwards.coachId, coachId)),
    db.select().from(coachMedals).where(eq(coachMedals.coachId, coachId)),
  ]);

  let honourCount = 0;
  for (const h of honours) {
    const placing = placingFromLegacyAchievementType(h.achievementType);
    const roleType = mapLegacyRole(h.roleType);
    const honourLevel = honourLevelFromLegacy(h.honourLevel);
    const medalType = medalTypeFromPlacing(placing).toUpperCase();
    const dedupeKey = buildAchievementDedupeKey({
      achievementType: "TEAM_HONOUR",
      competitionId: h.competitionId,
      competitionName: h.competitionName,
      year: h.year,
      teamId: h.teamId,
      teamName: h.teamName,
      roleType,
      placing,
    });

    await db
      .insert(achievements)
      .values({
        entityType: "coach",
        entityId: coachId,
        achievementType: "TEAM_HONOUR",
        competitionId: h.competitionId,
        competitionName: h.competitionName,
        seasonId: h.seasonId,
        seasonLabel: h.seasonLabel,
        teamId: h.teamId,
        teamName: h.teamName,
        year: h.year,
        roleType,
        placing,
        medalType,
        honourLevel,
        shared: h.shared,
        notes: h.notes,
        showOnOverview: h.showOnOverview,
        visibility: h.visibility,
        verificationStatus: h.verifiedAt ? "verified" : "unverified",
        verifiedAt: h.verifiedAt,
        legacySourceTable: "coach_honours",
        legacySourceId: h.id,
        dedupeKey,
        sortOrder: h.sortOrder,
        iconKey: honourLevel === "MAJOR" ? "trophy_major" : "trophy_domestic",
      })
      .onConflictDoUpdate({
        target: [achievements.entityType, achievements.entityId, achievements.dedupeKey],
        set: {
          competitionId: h.competitionId,
          competitionName: h.competitionName,
          teamId: h.teamId,
          teamName: h.teamName,
          honourLevel,
          placing,
          medalType,
          shared: h.shared,
          verificationStatus: h.verifiedAt ? "verified" : "unverified",
          verifiedAt: h.verifiedAt,
          legacySourceTable: "coach_honours",
          legacySourceId: h.id,
          updatedAt: new Date(),
        },
      });

    if (h.sourceUrl) {
      // best-effort source row — ignore dupes
      try {
        const [row] = await db
          .select({ id: achievements.id })
          .from(achievements)
          .where(
            and(
              eq(achievements.entityType, "coach"),
              eq(achievements.entityId, coachId),
              eq(achievements.dedupeKey, dedupeKey),
            ),
          )
          .limit(1);
        if (row) {
          await db.insert(achievementSources).values({
            achievementId: row.id,
            sourceType: "MANUAL",
            sourceUrl: h.sourceUrl,
            verificationStatus: h.verifiedAt ? "verified" : "unverified",
            checkedAt: h.verifiedAt ?? new Date(),
          });
        }
      } catch {
        /* ignore */
      }
    }
    honourCount += 1;
  }

  let awardCount = 0;
  for (const a of awards) {
    const def = await findAwardDefinitionByName(a.awardName);
    const display = normalizeAwardDisplayTitle(a.awardName, a.awardingBody);
    const placing =
      a.result === "winner"
        ? "WINNER"
        : a.result === "runner_up"
          ? "RUNNER_UP"
          : "OTHER";
    const dedupeKey = buildAchievementDedupeKey({
      achievementType: "PERSONAL_AWARD",
      year: a.year,
      teamId: a.teamIdAtTime,
      roleType: "COACH",
      placing,
      awardDefinitionId: def?.id,
      competitionName: display.title,
    });

    await db
      .insert(achievements)
      .values({
        entityType: "coach",
        entityId: coachId,
        achievementType: "PERSONAL_AWARD",
        awardDefinitionId: def?.id ?? null,
        teamId: a.teamIdAtTime,
        year: a.year,
        roleType: "COACH",
        placing,
        medalType: "NONE",
        honourLevel: a.isMajor ? "AWARD" : "AWARD",
        titleOverride: display.title,
        notes: display.organisation
          ? `Organisation: ${display.organisation}`
          : a.awardingBody,
        showOnOverview: a.showOnOverview,
        visibility: a.visibility,
        verificationStatus: a.verifiedAt ? "verified" : "unverified",
        verifiedAt: a.verifiedAt,
        legacySourceTable: "coach_awards",
        legacySourceId: a.id,
        dedupeKey,
        sortOrder: a.sortOrder,
        iconKey: def?.iconKey ?? "award_coach",
      })
      .onConflictDoUpdate({
        target: [achievements.entityType, achievements.entityId, achievements.dedupeKey],
        set: {
          awardDefinitionId: def?.id ?? null,
          titleOverride: display.title,
          placing,
          verificationStatus: a.verifiedAt ? "verified" : "unverified",
          verifiedAt: a.verifiedAt,
          legacySourceTable: "coach_awards",
          legacySourceId: a.id,
          updatedAt: new Date(),
        },
      });
    awardCount += 1;
  }

  let medalCount = 0;
  for (const m of medals) {
    const placing =
      m.finish.toLowerCase().includes("third") || m.finish.toLowerCase().includes("bronze")
        ? "THIRD_PLACE"
        : m.finish.toLowerCase().includes("runner") || m.finish.toLowerCase().includes("silver")
          ? "RUNNER_UP"
          : m.finish.toLowerCase().includes("winner") || m.finish.toLowerCase().includes("gold")
            ? "WINNER"
            : "OTHER";
    const roleType = mapLegacyRole(m.roleType);
    const medalType = (m.medalType || "none").toUpperCase();
    const dedupeKey = buildAchievementDedupeKey({
      achievementType: "MEDAL",
      competitionId: m.competitionId,
      competitionName: m.competitionName,
      year: m.year,
      teamId: m.teamId,
      teamName: m.teamName,
      roleType,
      placing,
    });

    await db
      .insert(achievements)
      .values({
        entityType: "coach",
        entityId: coachId,
        achievementType: "MEDAL",
        competitionId: m.competitionId,
        competitionName: m.competitionName,
        teamId: m.teamId,
        teamName: m.teamName,
        year: m.year,
        roleType,
        placing,
        medalType,
        honourLevel: "PLACEMENT",
        titleOverride: m.finish,
        visibility: "public",
        verificationStatus: m.verifiedAt ? "verified" : "unverified",
        verifiedAt: m.verifiedAt,
        legacySourceTable: "coach_medals",
        legacySourceId: m.id,
        dedupeKey,
        sortOrder: m.sortOrder,
        iconKey:
          medalType === "GOLD"
            ? "medal_gold"
            : medalType === "SILVER"
              ? "medal_silver"
              : medalType === "BRONZE"
                ? "medal_bronze"
                : "trophy_major",
        showOnOverview: true,
      })
      .onConflictDoUpdate({
        target: [achievements.entityType, achievements.entityId, achievements.dedupeKey],
        set: {
          competitionName: m.competitionName,
          medalType,
          placing,
          titleOverride: m.finish,
          verificationStatus: m.verifiedAt ? "verified" : "unverified",
          verifiedAt: m.verifiedAt,
          legacySourceTable: "coach_medals",
          legacySourceId: m.id,
          updatedAt: new Date(),
        },
      });
    medalCount += 1;
  }

  return { honours: honourCount, awards: awardCount, medals: medalCount };
}

export function buildPublicAwardsFromAchievements(
  rows: Awaited<ReturnType<typeof listEntityAchievements>>,
): PublicAwardRow[] {
  return rows
    .filter((r) => r.achievement.achievementType === "PERSONAL_AWARD")
    .filter(
      (r) =>
        r.achievement.visibility === "public" &&
        r.achievement.verificationStatus === "verified",
    )
    .map((r) => {
      const name = r.award?.name ?? r.achievement.titleOverride ?? "Award";
      const org = r.award?.organisation ?? null;
      const display = normalizeAwardDisplayTitle(name, org);
      return {
        id: r.achievement.id,
        year: r.achievement.year,
        title: display.title,
        organisation: display.organisation ?? org,
        resultLabel: (r.achievement.placing ?? "WINNER").replace(/_/g, " "),
        iconKey: r.achievement.iconKey ?? r.award?.iconKey ?? "award_coach",
      };
    });
}

export function buildPublicMedalsFromAchievements(
  rows: Awaited<ReturnType<typeof listEntityAchievements>>,
): PublicMedalRow[] {
  const medalOrHonour = rows.filter(
    (r) =>
      r.achievement.verificationStatus === "verified" &&
      (r.achievement.achievementType === "MEDAL" ||
        (r.achievement.achievementType === "TEAM_HONOUR" &&
          ["WINNER", "RUNNER_UP", "THIRD_PLACE"].includes(
            (r.achievement.placing ?? "").toUpperCase(),
          ) &&
          (r.achievement.honourLevel === "MAJOR" ||
            r.achievement.showOnOverview ||
            (r.achievement.competitionName ?? "").toLowerCase().includes("world cup")))),
  );

  // Prefer explicit MEDAL rows; fall back to major TEAM_HONOUR for overview
  const medals = medalOrHonour.filter((r) => r.achievement.achievementType === "MEDAL");
  const source = medals.length > 0 ? medals : medalOrHonour;

  return source
    .filter((r) => r.achievement.visibility === "public")
    .map((r) => {
      const medal = (r.achievement.medalType ?? "NONE").toLowerCase() as
        | "gold"
        | "silver"
        | "bronze"
        | "none";
      const placing = (r.achievement.placing ?? "").toUpperCase();
      const resultLabel =
        r.achievement.titleOverride ||
        (placing === "WINNER"
          ? "Winner"
          : placing === "THIRD_PLACE"
            ? "Third Place"
            : placing === "RUNNER_UP"
              ? "Runner-up"
              : placing.replace(/_/g, " "));
      return {
        id: r.achievement.id,
        year: r.achievement.year,
        competitionName: r.achievement.competitionName ?? "Competition",
        resultLabel,
        medalType: medal === "none" ? medalTypeFromPlacing(placing) : medal,
        roleType: r.achievement.roleType ?? "COACH",
        roleGroup: roleGroupFromRoleType(r.achievement.roleType),
      };
    });
}

export function countMajorHonoursWon(
  rows: Awaited<ReturnType<typeof listEntityAchievements>>,
): number {
  return rows.filter(
    (r) =>
      r.achievement.verificationStatus === "verified" &&
      isMajorHonourWin({
        honourLevel: r.achievement.honourLevel,
        placing: r.achievement.placing,
        achievementType: r.achievement.achievementType,
      }),
  ).length;
}

/** Build overview awards/medals from legacy coach tables when achievements empty. */
export function buildPublicAwardsFromLegacy(
  awards: Array<{
    id: string;
    year: number | null;
    awardName: string;
    awardingBody: string | null;
    result: string;
    visibility: string;
  }>,
): PublicAwardRow[] {
  return awards
    .filter((a) => a.visibility === "public")
    .map((a) => {
      const display = normalizeAwardDisplayTitle(a.awardName, a.awardingBody);
      return {
        id: a.id,
        year: a.year,
        title: display.title,
        organisation: display.organisation,
        resultLabel: (a.result || "winner").toUpperCase(),
        iconKey: /world rugby/i.test(a.awardName + (a.awardingBody ?? ""))
          ? "award_world"
          : "award_coach",
      };
    });
}

export function buildPublicMedalsFromLegacy(
  medals: Array<{
    id: string;
    year: number | null;
    competitionName: string | null;
    finish: string;
    medalType: string;
    roleType: string;
  }>,
): PublicMedalRow[] {
  return medals.map((m) => ({
    id: m.id,
    year: m.year,
    competitionName: m.competitionName ?? "Competition",
    resultLabel: m.finish,
    medalType: (m.medalType as "gold" | "silver" | "bronze" | "none") || "none",
    roleType: m.roleType,
    roleGroup: roleGroupFromRoleType(m.roleType === "player" ? "PLAYER" : "COACH"),
  }));
}
