/**
 * Audit coach Recent Results perspective scores.
 */
import { getCoachPerspectiveResult, formatCoachResultDate } from "../apps/web/src/lib/coach-perspective-result";
import { loadCoachEligibleMatches } from "../apps/web/src/lib/coach-career-record-service";
import { getDb } from "../apps/web/src/lib/db";
import { coaches, fixtures, teams } from "@rugby365/db";
import { alias } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const [coach] = await db
    .select()
    .from(coaches)
    .where(eq(coaches.slug, "rassie-erasmus"))
    .limit(1);
  if (!coach) {
    console.log("Coach not found");
    return;
  }

  const eligible = await loadCoachEligibleMatches(coach.id, { limit: 8 });
  const last8 = eligible.slice(-8).reverse();
  const home = alias(teams, "h");
  const away = alias(teams, "a");

  console.log("=== AUDIT: score fields / perspective / H-A-N / crests ===");
  for (const m of last8) {
    const [row] = await db
      .select({
        homeScore: fixtures.homeScore,
        awayScore: fixtures.awayScore,
        homeName: home.name,
        awayName: away.name,
        homeCrest: home.imageUrl,
        awayCrest: away.imageUrl,
        neutral: fixtures.isNeutralVenue,
        homeId: fixtures.homeTeamId,
        awayId: fixtures.awayTeamId,
        kickoffAt: fixtures.kickoffAt,
        competitionName: fixtures.competitionName,
      })
      .from(fixtures)
      .leftJoin(home, eq(fixtures.homeTeamId, home.id))
      .leftJoin(away, eq(fixtures.awayTeamId, away.id))
      .where(eq(fixtures.id, m.id))
      .limit(1);

    const perspective = getCoachPerspectiveResult(
      {
        homeScore: row?.homeScore,
        awayScore: row?.awayScore,
        homeTeamId: row?.homeId,
        awayTeamId: row?.awayId,
        homeTeamName: row?.homeName,
        awayTeamName: row?.awayName,
        homeCrestUrl: row?.homeCrest,
        awayCrestUrl: row?.awayCrest,
        isNeutralVenue: row?.neutral,
        competitionName: row?.competitionName,
        kickoffAt: row?.kickoffAt,
        storedResult: m.result,
      },
      m.teamId,
    );

    console.log({
      date: formatCoachResultDate(m.kickoffAt?.toISOString() ?? null),
      rawHomeAway: `${row?.homeName} ${row?.homeScore}–${row?.awayScore} ${row?.awayName}`,
      display: `${perspective.opponentName}  ${perspective.venueType}  ${perspective.pointsFor}–${perspective.pointsAgainst}  ${perspective.result}`,
      coachTeamId: perspective.coachTeamId,
      opponentId: perspective.opponentTeamId,
      hasCrestFallback: Boolean(perspective.opponentCrest),
      issues: perspective.dataIssues,
      consistent:
        perspective.result === "W"
          ? (perspective.pointsFor ?? 0) > (perspective.pointsAgainst ?? 0)
          : perspective.result === "L"
            ? (perspective.pointsFor ?? 0) < (perspective.pointsAgainst ?? 0)
            : perspective.pointsFor === perspective.pointsAgainst,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
