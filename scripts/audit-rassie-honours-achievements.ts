/**
 * Audit + sync Rassie Erasmus (first validation profile) against the shared
 * achievements model. Does NOT invent facts — reports gaps vs expected checklist.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/audit-rassie-honours-achievements.ts
 */
import { eq, ilike, or } from "drizzle-orm";
import { coachAwards, coachHonours, coachMedals, coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  listEntityAchievements,
  seedAwardDefinitions,
  syncCoachLegacyAchievements,
} from "../apps/web/src/lib/achievement-service";
import {
  normalizeAwardDisplayTitle,
  placingFromLegacyAchievementType,
} from "../apps/web/src/lib/achievement-types";

const EXPECTED = {
  personal: [
    { year: 2017, match: /pro12 coach of the season/i },
    { year: 2019, match: /world rugby coach of the year/i },
  ],
  medals: [
    { year: 1999, competition: /world cup/i, placing: /third|bronze/i, role: /player/i },
    { year: 2019, competition: /world cup/i, placing: /winner|gold/i, role: /coach/i },
    { year: 2023, competition: /world cup/i, placing: /winner|gold/i, role: /coach|director/i },
  ],
  coachingHonours: [
    { year: 2005, competition: /currie cup/i, placing: /winner/i },
    { year: 2006, competition: /currie cup/i, placing: /winner|shared/i },
    { year: 2010, competition: /super 14|super rugby/i, placing: /runner/i },
    { year: 2010, competition: /currie cup/i, placing: /runner/i },
    { year: 2017, competition: /pro12|urc/i, placing: /runner/i },
    { year: 2019, competition: /world cup/i, placing: /winner/i },
    { year: 2019, competition: /rugby championship|tri.?nations/i, placing: /winner/i },
    { year: 2023, competition: /world cup/i, placing: /winner/i },
    { year: 2024, competition: /rugby championship/i, placing: /winner/i },
    { year: 2025, competition: /rugby championship/i, placing: /winner/i },
  ],
};

async function main() {
  const db = getDb();
  const [coach] = await db
    .select()
    .from(coaches)
    .where(
      or(
        ilike(coaches.slug, "%rassie%"),
        ilike(coaches.name, "%rassie%erasmus%"),
        ilike(coaches.knownAs, "%rassie%"),
      ),
    )
    .limit(1);

  if (!coach) {
    console.error("Rassie coach row not found");
    process.exit(1);
  }

  console.log(`Coach: ${coach.name} (${coach.slug}) id=${coach.id}`);

  const defs = await seedAwardDefinitions();
  console.log(`Award definitions seeded/updated: ${defs}`);

  const synced = await syncCoachLegacyAchievements(coach.id);
  console.log("Legacy → achievements sync:", synced);

  const [honours, awards, medals, achievementRows] = await Promise.all([
    db.select().from(coachHonours).where(eq(coachHonours.coachId, coach.id)),
    db.select().from(coachAwards).where(eq(coachAwards.coachId, coach.id)),
    db.select().from(coachMedals).where(eq(coachMedals.coachId, coach.id)),
    listEntityAchievements("coach", coach.id),
  ]);

  console.log("\n=== LEGACY COUNTS ===");
  console.log({
    honours: honours.length,
    awards: awards.length,
    medals: medals.length,
    achievements: achievementRows.length,
  });

  console.log("\n=== PERSONAL AWARDS (legacy) ===");
  for (const a of awards) {
    const display = normalizeAwardDisplayTitle(a.awardName, a.awardingBody);
    console.log({
      year: a.year,
      raw: a.awardName,
      body: a.awardingBody,
      display: `${display.organisation ?? ""} ${display.title}`.trim(),
      result: a.result,
      verified: Boolean(a.verifiedAt),
    });
  }

  console.log("\n=== MEDALS (legacy) ===");
  for (const m of medals) {
    console.log({
      year: m.year,
      competition: m.competitionName,
      finish: m.finish,
      medal: m.medalType,
      role: m.roleType,
      team: m.teamName,
      competitionId: m.competitionId,
      teamId: m.teamId,
    });
  }

  console.log("\n=== TEAM HONOURS (legacy, sample) ===");
  for (const h of honours.slice(0, 40)) {
    console.log({
      year: h.year,
      competition: h.competitionName,
      type: h.achievementType,
      placing: placingFromLegacyAchievementType(h.achievementType),
      level: h.honourLevel,
      role: h.roleType,
      team: h.teamName,
      competitionId: h.competitionId,
      teamId: h.teamId,
      shared: h.shared,
    });
  }

  const missingPersonal = EXPECTED.personal.filter(
    (exp) =>
      !awards.some(
        (a) => a.year === exp.year && exp.match.test(`${a.awardingBody ?? ""} ${a.awardName}`),
      ),
  );
  const missingMedals = EXPECTED.medals.filter(
    (exp) =>
      !medals.some(
        (m) =>
          m.year === exp.year &&
          exp.competition.test(m.competitionName ?? "") &&
          exp.placing.test(`${m.finish} ${m.medalType}`) &&
          exp.role.test(m.roleType),
      ),
  );
  const missingCoaching = EXPECTED.coachingHonours.filter(
    (exp) =>
      !honours.some(
        (h) =>
          h.roleType === "coach" &&
          h.year === exp.year &&
          exp.competition.test(h.competitionName ?? "") &&
          exp.placing.test(h.achievementType),
      ),
  );

  const duplicateAwards = awards.filter((a) =>
    /world rugby\s+world rugby/i.test(a.awardName),
  );

  console.log("\n=== GAP REPORT (expected checklist) ===");
  console.log({
    missingPersonal,
    missingMedals,
    missingCoachingHonours: missingCoaching,
    duplicateAwardWording: duplicateAwards.map((a) => ({
      id: a.id,
      year: a.year,
      awardName: a.awardName,
      awardingBody: a.awardingBody,
    })),
    unlinkedCompetitions: honours.filter((h) => !h.competitionId).length,
    unlinkedTeams: honours.filter((h) => !h.teamId).length,
  });

  console.log("\n=== ACHIEVEMENTS BY TYPE ===");
  const byType = new Map<string, number>();
  for (const row of achievementRows) {
    const t = row.achievement.achievementType;
    byType.set(t, (byType.get(t) ?? 0) + 1);
  }
  console.log(Object.fromEntries(byType));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
