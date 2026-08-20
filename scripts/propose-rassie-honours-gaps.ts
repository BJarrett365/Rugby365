/**
 * Propose missing Rassie checklist achievements as REVIEW (not verified).
 * Does not invent beyond the known checklist — editors must approve in CMS.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/propose-rassie-honours-gaps.ts
 */
import { and, eq, ilike, or } from "drizzle-orm";
import { achievements, coaches, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  findAwardDefinitionByName,
  seedAwardDefinitions,
  syncCoachLegacyAchievements,
} from "../apps/web/src/lib/achievement-service";
import { buildAchievementDedupeKey } from "../apps/web/src/lib/achievement-types";

type Proposal = {
  achievementType: "PERSONAL_AWARD" | "TEAM_HONOUR" | "MEDAL";
  year: number;
  competitionName?: string;
  teamName?: string;
  roleType: string;
  placing: string;
  medalType?: string;
  honourLevel: string;
  awardName?: string;
  shared?: boolean;
  notes: string;
};

const PROPOSALS: Proposal[] = [
  {
    achievementType: "PERSONAL_AWARD",
    year: 2017,
    awardName: "Pro12 Coach of the Season",
    teamName: "Munster",
    roleType: "DIRECTOR_OF_RUGBY",
    placing: "WINNER",
    honourLevel: "AWARD",
    notes: "Proposed from known checklist — verify role/title before publish.",
  },
  {
    achievementType: "MEDAL",
    year: 1999,
    competitionName: "Rugby World Cup",
    teamName: "South Africa",
    roleType: "PLAYER",
    placing: "THIRD_PLACE",
    medalType: "BRONZE",
    honourLevel: "PLACEMENT",
    notes: "Proposed medal record — verify squad membership.",
  },
  {
    achievementType: "MEDAL",
    year: 2019,
    competitionName: "Rugby World Cup",
    teamName: "South Africa",
    roleType: "HEAD_COACH",
    placing: "WINNER",
    medalType: "GOLD",
    honourLevel: "PLACEMENT",
    notes: "Proposed medal record (also have TEAM_HONOUR winner).",
  },
  {
    achievementType: "MEDAL",
    year: 2023,
    competitionName: "Rugby World Cup",
    teamName: "South Africa",
    roleType: "DIRECTOR_OF_RUGBY",
    placing: "WINNER",
    medalType: "GOLD",
    honourLevel: "PLACEMENT",
    notes: "Role must be historically verified (DoR / coaching leadership) before publish.",
  },
  {
    achievementType: "TEAM_HONOUR",
    year: 2005,
    competitionName: "Currie Cup",
    teamName: "Free State Cheetahs",
    roleType: "HEAD_COACH",
    placing: "WINNER",
    honourLevel: "CHAMPIONSHIP",
    notes: "Proposed coaching honour — link competition/team IDs on approve.",
  },
  {
    achievementType: "TEAM_HONOUR",
    year: 2006,
    competitionName: "Currie Cup",
    teamName: "Free State Cheetahs",
    roleType: "HEAD_COACH",
    placing: "WINNER",
    honourLevel: "CHAMPIONSHIP",
    shared: true,
    notes: "Shared title — verify before publish.",
  },
  {
    achievementType: "TEAM_HONOUR",
    year: 2010,
    competitionName: "Super 14",
    teamName: "Stormers",
    roleType: "HEAD_COACH",
    placing: "RUNNER_UP",
    honourLevel: "CHAMPIONSHIP",
    notes: "Proposed — not a Major Honour win.",
  },
  {
    achievementType: "TEAM_HONOUR",
    year: 2010,
    competitionName: "Currie Cup",
    teamName: "Western Province",
    roleType: "HEAD_COACH",
    placing: "RUNNER_UP",
    honourLevel: "CHAMPIONSHIP",
    notes: "Proposed — not a Major Honour win.",
  },
  {
    achievementType: "TEAM_HONOUR",
    year: 2017,
    competitionName: "Pro12",
    teamName: "Munster",
    roleType: "DIRECTOR_OF_RUGBY",
    placing: "RUNNER_UP",
    honourLevel: "CHAMPIONSHIP",
    notes: "Proposed — not a Major Honour win.",
  },
];

async function resolveTeamId(name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(ilike(teams.name, name))
    .limit(1);
  return row?.id ?? null;
}

async function main() {
  const db = getDb();
  await seedAwardDefinitions();

  const [coach] = await db
    .select()
    .from(coaches)
    .where(
      or(
        ilike(coaches.slug, "%rassie%"),
        ilike(coaches.knownAs, "%rassie%"),
      ),
    )
    .limit(1);
  if (!coach) throw new Error("Rassie not found");

  await syncCoachLegacyAchievements(coach.id);

  let created = 0;
  let skipped = 0;

  for (const p of PROPOSALS) {
    const def = p.awardName ? await findAwardDefinitionByName(p.awardName) : null;
    const teamId = await resolveTeamId(p.teamName);
    const dedupeKey = buildAchievementDedupeKey({
      achievementType: p.achievementType,
      competitionName: p.competitionName ?? p.awardName,
      year: p.year,
      teamId,
      teamName: p.teamName,
      roleType: p.roleType,
      placing: p.placing,
      awardDefinitionId: def?.id,
    });

    const [existing] = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(
        and(
          eq(achievements.entityType, "coach"),
          eq(achievements.entityId, coach.id),
          eq(achievements.dedupeKey, dedupeKey),
        ),
      )
      .limit(1);

    if (existing) {
      skipped += 1;
      continue;
    }

    await db.insert(achievements).values({
      entityType: "coach",
      entityId: coach.id,
      achievementType: p.achievementType,
      competitionName: p.competitionName ?? null,
      teamId,
      teamName: p.teamName ?? null,
      awardDefinitionId: def?.id ?? null,
      year: p.year,
      roleType: p.roleType,
      placing: p.placing,
      medalType: p.medalType ?? "NONE",
      honourLevel: p.honourLevel,
      shared: p.shared ?? false,
      titleOverride: p.awardName ?? null,
      notes: p.notes,
      showOnOverview: p.achievementType === "MEDAL" || p.achievementType === "PERSONAL_AWARD",
      visibility: "public",
      verificationStatus: "review",
      iconKey:
        p.medalType === "GOLD"
          ? "medal_gold"
          : p.medalType === "BRONZE"
            ? "medal_bronze"
            : p.achievementType === "PERSONAL_AWARD"
              ? def?.iconKey ?? "award_coach"
              : "trophy_domestic",
      dedupeKey,
    });
    created += 1;
    console.log("PROPOSED", p.year, p.achievementType, p.competitionName ?? p.awardName, p.placing);
  }

  console.log({ coachId: coach.id, created, skipped });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
