/**
 * Phase A — Pollard monthly input coverage + £35k calibration audit.
 * Usage: npx tsx --require ./scripts/stub-server-only.cjs scripts/audit-pollard-value-coverage.ts
 */
import { and, asc, desc, eq, lte, sql } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerInjuries,
  playerMarketValues,
  playerMatchRatings,
  playerRatingHistory,
  playerRatings,
  players,
  playerTeamMemberships,
  playerValueHistory,
  teams,
} from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { calculatePlayerAge } from "../apps/web/src/lib/player-profile-utils";
import { computePlayerValue } from "../apps/web/src/lib/player-value-math";

process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

const SLUG = "handre-pollard-og9nmd6l";

/** Weighted factor presence for backfill threshold. */
const WEIGHTS = {
  age: 12,
  club: 14,
  competition: 12,
  international: 10,
  rating: 18,
  form: 10,
  position: 12,
  contract: 6,
  availability: 6,
  potential: 0, // optional — does not block
} as const;

const CORE_KEYS = ["age", "position", "club", "competition", "rating"] as const;

function monthEndUtc(year: number, monthIndex0: number): Date {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0, 23, 59, 59, 999));
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function membershipCoversYear(
  startYear: number | null,
  endYear: number | null,
  year: number,
  isCurrent: boolean,
): boolean {
  if (startYear != null && year < startYear) return false;
  if (endYear != null && year > endYear) return false;
  if (startYear == null && endYear == null && !isCurrent) return false;
  return true;
}

async function main() {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.slug, SLUG)).limit(1);
  if (!player) {
    console.error("Player not found");
    process.exit(1);
  }

  const [mv] = await db
    .select()
    .from(playerMarketValues)
    .where(and(eq(playerMarketValues.playerId, player.id), eq(playerMarketValues.isCurrent, true)))
    .limit(1);

  const valueHist = await db
    .select()
    .from(playerValueHistory)
    .where(eq(playerValueHistory.playerId, player.id))
    .orderBy(asc(playerValueHistory.snapshotDate));

  const memberships = await db
    .select({
      teamId: playerTeamMemberships.teamId,
      teamName: teams.name,
      type: playerTeamMemberships.membershipType,
      startYear: playerTeamMemberships.startYear,
      endYear: playerTeamMemberships.endYear,
      startDate: playerTeamMemberships.startDate,
      endDate: playerTeamMemberships.endDate,
      isCurrent: playerTeamMemberships.isCurrent,
      competitionId: playerTeamMemberships.competitionId,
    })
    .from(playerTeamMemberships)
    .leftJoin(teams, eq(playerTeamMemberships.teamId, teams.id))
    .where(eq(playerTeamMemberships.playerId, player.id));

  const ratingHist = await db
    .select({
      matchDate: playerRatingHistory.matchDate,
      overall: playerRatingHistory.overallRating,
      form: playerRatingHistory.form,
    })
    .from(playerRatingHistory)
    .where(eq(playerRatingHistory.playerId, player.id))
    .orderBy(desc(playerRatingHistory.matchDate));

  const matchRatings = await db
    .select({
      kickoffAt: fixtures.kickoffAt,
      rating: playerMatchRatings.rating,
      competitionId: fixtures.competitionId,
      competitionSlug: competitions.slug,
      competitionName: competitions.name,
      competitionType: competitions.competitionType,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .leftJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(eq(playerMatchRatings.playerId, player.id))
    .orderBy(asc(fixtures.kickoffAt));

  const intlAppearances = await db
    .select({ kickoffAt: fixtures.kickoffAt })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        eq(fixturePlayers.playerId, player.id),
        sql`(
          ${competitions.competitionType} in ('international', 'world_cup')
          or ${competitions.slug} ilike '%nations%'
          or ${competitions.slug} ilike '%world-cup%'
          or ${competitions.name} ilike '%nations%'
          or ${competitions.name} ilike '%world cup%'
        )`,
      ),
    )
    .orderBy(asc(fixtures.kickoffAt));

  const injuries = await db
    .select({
      injuryDate: playerInjuries.injuryDate,
      expectedReturnDate: playerInjuries.expectedReturnDate,
      actualReturnDate: playerInjuries.actualReturnDate,
    })
    .from(playerInjuries)
    .where(eq(playerInjuries.playerId, player.id));

  const now = new Date();
  const months: Date[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(monthEndUtc(d.getUTCFullYear(), d.getUTCMonth()));
  }

  const rows = months.map((asOf) => {
    const year = asOf.getUTCFullYear();
    const age = calculatePlayerAge(player.birthDate, asOf);
    const position = player.positionName;

    const clubMem = memberships.find(
      (m) =>
        (m.type === "club" || m.type === "provincial") &&
        membershipCoversYear(m.startYear, m.endYear, year, m.isCurrent),
    );
    // Prefer fixture activity in the trailing 6 months for club/competition
    const windowStart = new Date(asOf);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - 6);
    const recentMatches = matchRatings.filter(
      (m) => m.kickoffAt && m.kickoffAt <= asOf && m.kickoffAt >= windowStart,
    );
    const domesticMatch = [...recentMatches]
      .reverse()
      .find((m) => m.competitionType === "domestic");
    const anyMatch = recentMatches[recentMatches.length - 1] ?? null;

    const clubFromFixture = domesticMatch ?? anyMatch;
    let clubOk = Boolean(clubMem?.teamId) || Boolean(player.clubTeamId && year >= now.getUTCFullYear() - 1);
    // If we have fixture activity, treat club context as present
    if (clubFromFixture) clubOk = true;
    if (clubMem) clubOk = true;

    const competitionKey =
      domesticMatch?.competitionSlug ??
      domesticMatch?.competitionName ??
      anyMatch?.competitionSlug ??
      anyMatch?.competitionName ??
      null;
    const competitionOk = Boolean(competitionKey) || Boolean(clubMem?.competitionId);

    const capsAsOf = intlAppearances.filter((a) => a.kickoffAt && a.kickoffAt <= asOf).length;
    const verifiedCaps = player.verifiedInternationalCaps;
    // International status: prefer linked caps as-of date; fall back to verified only for recent months
    const intlOk = capsAsOf > 0 || (verifiedCaps != null && verifiedCaps > 0 && asOf >= new Date("2024-01-01"));

    const rhClosest = ratingHist.find((r) => r.matchDate && r.matchDate <= asOf) ?? null;
    const priorMatchAvgs = matchRatings.filter(
      (m) => m.kickoffAt && m.kickoffAt <= asOf && m.rating != null,
    );
    const lastFive = priorMatchAvgs.slice(-5).map((m) => Number(m.rating));
    const reconstructedRating =
      rhClosest?.overall ??
      (lastFive.length >= 3
        ? Math.round(55 + (lastFive.reduce((a, b) => a + b, 0) / lastFive.length) * 4)
        : null);
    const ratingOk = reconstructedRating != null;

    const formFromRh = rhClosest?.form ?? null;
    const formOk = formFromRh != null || lastFive.length >= 3;

    const contractOk = false; // historic contract unknown for Pollard periods
    // Availability: injuries overlapping trailing year before asOf
    const since = new Date(asOf);
    since.setUTCFullYear(since.getUTCFullYear() - 1);
    const availKnown = injuries.some((inj) => {
      if (!inj.injuryDate) return false;
      const start = new Date(inj.injuryDate);
      return start <= asOf && start >= since;
    });
    // Treat as known if we have any injury records in window OR zero injuries ever (assume healthy with low confidence)
    const availabilityOk = availKnown || injuries.length === 0;

    const potentialOk = false; // never use today's potential for historic

    const present: Record<keyof typeof WEIGHTS, boolean> = {
      age: age != null,
      club: clubOk,
      competition: competitionOk,
      international: intlOk,
      rating: ratingOk,
      form: formOk,
      position: Boolean(position),
      contract: contractOk,
      availability: availabilityOk,
      potential: potentialOk,
    };

    const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    const coveredWeight = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
      (sum, k) => sum + (present[k] ? WEIGHTS[k] : 0),
      0,
    );
    const coveragePct = Math.round((coveredWeight / totalWeight) * 1000) / 10;

    const missing = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[])
      .filter((k) => !present[k] && WEIGHTS[k] > 0)
      .map((k) => k);

    const coreOk = CORE_KEYS.every((k) => {
      if (k === "age") return present.age;
      if (k === "position") return present.position;
      if (k === "club") return present.club;
      if (k === "competition") return present.competition;
      if (k === "rating") return present.rating;
      return false;
    });

    const canCalculate = coveragePct >= 65 && coreOk;
    const confidence =
      canCalculate
        ? Math.min(0.85, 0.4 + coveragePct / 200 - (contractOk ? 0 : 0.08))
        : Math.min(0.55, coveragePct / 200);

    return {
      month: monthLabel(asOf),
      asOf: asOf.toISOString().slice(0, 10),
      coveragePct,
      canCalculate,
      confidence: Math.round(confidence * 100),
      missing,
      detail: {
        age,
        club: clubMem?.teamName ?? (clubFromFixture ? "via fixtures" : null),
        competition: competitionKey,
        capsAsOf,
        rating: reconstructedRating,
        formMatches: lastFive.length,
        position,
      },
    };
  });

  // Calibration for current £35k
  const factors = Array.isArray(mv?.factors) ? mv!.factors : [];
  let running = Number(mv?.baseValueGbp ?? 0);
  const steps: Array<{ key: string; pct: number; note: string; after: number }> = [];
  for (const f of factors as Array<{ key: string; pct: number; note: string; label?: string }>) {
    running = running * (1 + f.pct / 100);
    steps.push({
      key: f.key,
      pct: f.pct,
      note: f.note,
      after: Math.round(running),
    });
  }

  // Recompute from live inputs for transparency
  const [ratingRow] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, player.id))
    .limit(1);

  const lastFive = Array.isArray(ratingRow?.lastFiveMatchRatings)
    ? (ratingRow!.lastFiveMatchRatings as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
        .map((n) => (n > 10 ? n / 10 : n))
    : [];

  const recomputed = computePlayerValue({
    currentRating: ratingRow?.playerRating ?? null,
    seasonRating: ratingRow?.seasonRating ?? null,
    formScore: ratingRow?.formScore ?? null,
    lastFiveMatchRatings: lastFive,
    potential: ratingRow?.potential ?? null,
    reputation: ratingRow?.reputation ?? null,
    age: calculatePlayerAge(player.birthDate),
    positionName: player.positionName,
    competitionKey: "united-rugby-championship",
    internationalCaps: player.verifiedInternationalCaps ?? intlAppearances.length,
    contractMonthsRemaining: player.contractExpiresOn
      ? Math.max(
          0,
          Math.round(
            (new Date(String(player.contractExpiresOn)).getTime() - Date.now()) /
              (30.44 * 86_400_000),
          ),
        )
      : null,
    daysUnavailableLastYear: 0,
    isCaptain: null,
    hasSocialPresence: false,
    mediaNudgePct: null,
  });

  const calculable = rows.filter((r) => r.canCalculate);

  console.log(
    JSON.stringify(
      {
        player: {
          id: player.id,
          slug: player.slug,
          name: player.name,
          birthDate: player.birthDate,
          position: player.positionName,
          club: player.clubName,
          verifiedCaps: player.verifiedInternationalCaps,
          contractExpiresOn: player.contractExpiresOn,
        },
        liveSnapshot: valueHist.map((h) => ({
          date: h.snapshotDate.toISOString(),
          value: h.estimatedValue,
          type: h.snapshotType,
          confidence: h.confidence,
          ovr: h.overallRating,
          age: h.ageAtSnapshot,
        })),
        storedMarketValue: mv
          ? {
              marketValueGbp: mv.marketValueGbp,
              baseValueGbp: mv.baseValueGbp,
              ratingBandLabel: mv.ratingBandLabel,
              confidence: mv.confidence,
              factors: mv.factors,
            }
          : null,
        calibration: {
          baseValueGbp: mv?.baseValueGbp ?? null,
          ratingBand: mv?.ratingBandLabel ?? null,
          steps,
          finalStored: mv?.marketValueGbp ?? null,
          recomputed,
        },
        monthlyAudit: rows.map((r) => ({
          MONTH: r.month,
          "INPUT COVERAGE": `${r.coveragePct}%`,
          "CAN CALCULATE?": r.canCalculate ? "YES" : "NO",
          CONFIDENCE: `${r.confidence}%`,
          "MISSING FACTORS": r.missing.join(", ") || "—",
        })),
        summary: {
          monthsChecked: rows.length,
          calculableMonths: calculable.length,
          avgCoverage:
            Math.round((rows.reduce((s, r) => s + r.coveragePct, 0) / rows.length) * 10) / 10,
          suggestedBackfillMonths: Math.min(
            24,
            calculable.filter((r) => {
              const d = new Date(r.asOf);
              const cutoff6 = new Date(now);
              cutoff6.setUTCMonth(cutoff6.getUTCMonth() - 6);
              return d >= cutoff6;
            }).length >= 1
              ? calculable.filter((r) => {
                  const d = new Date(r.asOf);
                  const cutoff6 = new Date(now);
                  cutoff6.setUTCMonth(cutoff6.getUTCMonth() - 6);
                  return d >= cutoff6;
                }).length
              : 0,
          ),
        },
        dataInventory: {
          memberships: memberships.length,
          ratingHistoryPoints: ratingHist.length,
          matchRatings: matchRatings.length,
          intlAppearancesLinked: intlAppearances.length,
          injuries: injuries.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
