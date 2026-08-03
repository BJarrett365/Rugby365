import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  competitions,
  fixturePlayers,
  fixtures,
  playerInjuries,
  playerMarketValues,
  playerMatchRatings,
  playerRatings,
  players,
  playerSuspensions,
} from "@rugby365/db";
import { getDb } from "./db";
import { calculatePlayerAge, normalizeSocialAccounts } from "./player-profile-utils";
import {
  buildValueTimeline,
  computePlayerValue,
  formatGbpCompact,
  PLAYER_VALUE_MODEL,
  type PlayerValueFactor,
  type PlayerValueResult,
  type PlayerValueTimelinePoint,
} from "./player-value-math";
import {
  reviewPlayerValueMediaSnippets,
  type PlayerValueMediaCheckResult,
  type PlayerValueMediaSnippet,
} from "./player-value-media-check";

export type PublicPlayerValue = {
  modelVersion: string;
  currency: "GBP";
  marketValueGbp: number;
  transferValueGbp: number;
  contractValueGbp: number;
  futureValueGbp: number;
  peakCareerValueGbp: number;
  marketValueLabel: string;
  transferValueLabel: string;
  contractValueLabel: string;
  futureValueLabel: string;
  peakCareerValueLabel: string;
  riskScore: number;
  confidence: number;
  confidenceLabel: string;
  trendLabel: string;
  ratingBandLabel: string;
  factors: PlayerValueFactor[];
  recommendations: PlayerValueResult["recommendations"];
  timeline: PlayerValueTimelinePoint[];
  mediaCheck: {
    status: string;
    summary: string;
    citedUrls: string[];
  } | null;
  disclaimer: string;
  calculatedAt: string | null;
};

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function toPublic(row: {
  modelVersion: string;
  marketValueGbp: number;
  transferValueGbp: number;
  contractValueGbp: number;
  futureValueGbp: number;
  peakCareerValueGbp: number;
  riskScore: number;
  confidence: number;
  trendLabel: string | null;
  ratingBandLabel: string | null;
  factors: unknown;
  recommendations: unknown;
  timeline: unknown;
  mediaCheck: unknown;
  calculatedAt: Date | null;
}): PublicPlayerValue {
  const factors = Array.isArray(row.factors) ? (row.factors as PlayerValueFactor[]) : [];
  const recommendations =
    row.recommendations && typeof row.recommendations === "object"
      ? (row.recommendations as PlayerValueResult["recommendations"])
      : { transfer: "—", contract: "—", resale: "—" };
  const timeline = Array.isArray(row.timeline)
    ? (row.timeline as PlayerValueTimelinePoint[])
    : [];
  const media =
    row.mediaCheck && typeof row.mediaCheck === "object"
      ? (row.mediaCheck as PlayerValueMediaCheckResult)
      : null;

  return {
    modelVersion: row.modelVersion,
    currency: "GBP",
    marketValueGbp: row.marketValueGbp,
    transferValueGbp: row.transferValueGbp,
    contractValueGbp: row.contractValueGbp,
    futureValueGbp: row.futureValueGbp,
    peakCareerValueGbp: row.peakCareerValueGbp,
    marketValueLabel: formatGbpCompact(row.marketValueGbp),
    transferValueLabel: formatGbpCompact(row.transferValueGbp),
    contractValueLabel: formatGbpCompact(row.contractValueGbp),
    futureValueLabel: formatGbpCompact(row.futureValueGbp),
    peakCareerValueLabel: formatGbpCompact(row.peakCareerValueGbp),
    riskScore: row.riskScore,
    confidence: row.confidence,
    confidenceLabel: `${Math.round(row.confidence * 100)}%`,
    trendLabel: row.trendLabel ?? "→ Stable",
    ratingBandLabel: row.ratingBandLabel ?? "—",
    factors,
    recommendations,
    timeline,
    mediaCheck: media
      ? {
          status: media.status,
          summary: media.summary,
          citedUrls: media.citedUrls ?? [],
        }
      : null,
    disclaimer:
      "Rugby365 Player Value is a model estimate of market worth — not an official transfer fee. Rugby Union has no Transfermarkt equivalent; figures combine Rugby365 ratings with age, form, caps, competition and availability. Contract length is used when known.",
    calculatedAt: row.calculatedAt?.toISOString() ?? null,
  };
}

async function daysUnavailableLastYear(playerId: string): Promise<number> {
  const db = getDb();
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceStr = since.toISOString().slice(0, 10);

  const injuries = await db
    .select({
      injuryDate: playerInjuries.injuryDate,
      expectedReturnDate: playerInjuries.expectedReturnDate,
      actualReturnDate: playerInjuries.actualReturnDate,
      status: playerInjuries.status,
    })
    .from(playerInjuries)
    .where(
      and(
        eq(playerInjuries.playerId, playerId),
        sql`coalesce(${playerInjuries.injuryDate}, ${playerInjuries.dateReported}) >= ${sinceStr}`,
      ),
    );

  const suspensions = await db
    .select({
      start: playerSuspensions.suspensionStart,
      end: playerSuspensions.suspensionEnd,
    })
    .from(playerSuspensions)
    .where(
      and(
        eq(playerSuspensions.playerId, playerId),
        sql`coalesce(${playerSuspensions.suspensionStart}, ${playerSuspensions.incidentDate}) >= ${sinceStr}`,
      ),
    );

  const now = new Date();
  let days = 0;
  for (const row of injuries) {
    const start = row.injuryDate ? new Date(row.injuryDate) : null;
    if (!start) continue;
    const endRaw = row.actualReturnDate ?? row.expectedReturnDate;
    const end = endRaw ? new Date(endRaw) : now;
    days += daysBetween(start < since ? since : start, end > now ? now : end);
  }
  for (const row of suspensions) {
    const start = row.start ? new Date(row.start) : null;
    if (!start) continue;
    const end = row.end ? new Date(row.end) : now;
    days += daysBetween(start < since ? since : start, end > now ? now : end);
  }
  return days;
}

async function resolveCompetitionKey(playerId: string, clubTeamId: string | null): Promise<string | null> {
  if (!clubTeamId) return null;
  const db = getDb();
  // Prefer latest domestic club competition over cup competitions.
  const [domestic] = await db
    .select({
      slug: competitions.slug,
      name: competitions.name,
    })
    .from(fixtures)
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        sql`(${fixtures.homeTeamId} = ${clubTeamId} OR ${fixtures.awayTeamId} = ${clubTeamId})`,
        eq(competitions.competitionType, "domestic"),
      ),
    )
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);
  if (domestic) return domestic.slug ?? domestic.name ?? null;

  const [any] = await db
    .select({
      slug: competitions.slug,
      name: competitions.name,
    })
    .from(fixtures)
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(sql`(${fixtures.homeTeamId} = ${clubTeamId} OR ${fixtures.awayTeamId} = ${clubTeamId})`)
    .orderBy(desc(fixtures.kickoffAt))
    .limit(1);
  return any?.slug ?? any?.name ?? null;
}

async function ratingByYearMap(playerId: string): Promise<Record<number, number>> {
  const db = getDb();
  const rows = await db
    .select({
      year: sql<number>`extract(year from ${fixtures.kickoffAt})::int`,
      avgRating: sql<number>`avg(${playerMatchRatings.rating})`,
    })
    .from(playerMatchRatings)
    .innerJoin(fixtures, eq(playerMatchRatings.fixtureId, fixtures.id))
    .where(
      and(eq(playerMatchRatings.playerId, playerId), sql`${playerMatchRatings.rating} is not null`),
    )
    .groupBy(sql`extract(year from ${fixtures.kickoffAt})::int`);

  const out: Record<number, number> = {};
  for (const row of rows) {
    if (row.year && row.avgRating != null) {
      // map 0–10 match avg → rough career-ish 60–95 band
      out[row.year] = Math.round(55 + Number(row.avgRating) * 4);
    }
  }
  return out;
}

export async function calculateAndPersistPlayerValue(
  playerId: string,
  options: { mediaSnippets?: PlayerValueMediaSnippet[] } = {},
): Promise<PublicPlayerValue | null> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return null;

  const [rating] = await db
    .select()
    .from(playerRatings)
    .where(eq(playerRatings.playerId, playerId))
    .limit(1);

  const lastFive = Array.isArray(rating?.lastFiveMatchRatings)
    ? (rating!.lastFiveMatchRatings as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
    : [];

  const [capsRow] = await db
    .select({ caps: sql<number>`count(*)::int` })
    .from(fixturePlayers)
    .innerJoin(fixtures, eq(fixturePlayers.fixtureId, fixtures.id))
    .innerJoin(competitions, eq(fixtures.competitionId, competitions.id))
    .where(
      and(
        eq(fixturePlayers.playerId, playerId),
        sql`(
          ${competitions.competitionType} in ('international', 'world_cup')
          or ${competitions.slug} ilike '%nations%'
          or ${competitions.slug} ilike '%world-cup%'
          or ${competitions.name} ilike '%nations%'
          or ${competitions.name} ilike '%world cup%'
        )`,
      ),
    );
  const caps = Number(capsRow?.caps ?? 0);

  const competitionKey = await resolveCompetitionKey(playerId, player.clubTeamId);
  const unavailable = await daysUnavailableLastYear(playerId);
  const social = normalizeSocialAccounts(player.socialAccounts);
  const hasSocial = Boolean(social.twitter || social.instagram || social.facebook || social.website);

  let contractMonthsRemaining: number | null = null;
  if (player.contractExpiresOn) {
    const end = new Date(String(player.contractExpiresOn));
    if (!Number.isNaN(end.getTime())) {
      contractMonthsRemaining = Math.max(
        0,
        Math.round((end.getTime() - Date.now()) / (30.44 * 86_400_000)),
      );
    }
  }

  // First pass without media nudge
  let media: PlayerValueMediaCheckResult | null = null;
  let mediaNudge: number | null = null;

  const draft = computePlayerValue({
    currentRating: rating?.manualOverrideRating ?? rating?.playerRating ?? null,
    seasonRating: rating?.seasonRating ?? null,
    formScore: rating?.formScore ?? null,
    lastFiveMatchRatings: lastFive,
    potential: rating?.potential ?? null,
    reputation: rating?.reputation ?? null,
    age: calculatePlayerAge(player.birthDate),
    positionName: player.positionName,
    competitionKey,
    internationalCaps: caps,
    contractMonthsRemaining,
    daysUnavailableLastYear: unavailable,
    isCaptain: null,
    hasSocialPresence: hasSocial,
    mediaNudgePct: null,
  });

  if (options.mediaSnippets?.length) {
    media = await reviewPlayerValueMediaSnippets({
      playerName: player.name,
      clubName: player.clubName,
      modelMarketValueGbp: draft.marketValueGbp,
      snippets: options.mediaSnippets,
    });
    mediaNudge = media.nudgePct || null;
  }

  const computed =
    mediaNudge != null
      ? computePlayerValue({
          currentRating: rating?.manualOverrideRating ?? rating?.playerRating ?? null,
          seasonRating: rating?.seasonRating ?? null,
          formScore: rating?.formScore ?? null,
          lastFiveMatchRatings: lastFive,
          potential: rating?.potential ?? null,
          reputation: rating?.reputation ?? null,
          age: calculatePlayerAge(player.birthDate),
          positionName: player.positionName,
          competitionKey,
          internationalCaps: caps,
          contractMonthsRemaining,
          daysUnavailableLastYear: unavailable,
          isCaptain: null,
          hasSocialPresence: hasSocial,
          mediaNudgePct: mediaNudge,
        })
      : draft;

  // CMS reported salary wins over modelled contract band when present.
  if (player.reportedSalaryGbp != null && Number.isFinite(Number(player.reportedSalaryGbp))) {
    computed.contractValueGbp = Math.round(Number(player.reportedSalaryGbp));
  }

  const year = new Date().getFullYear();
  const byYear = await ratingByYearMap(playerId);
  const timeline = buildValueTimeline({
    currentYear: year,
    currentMarketValueGbp: computed.marketValueGbp,
    ratingByYear: byYear,
  });

  await db
    .update(playerMarketValues)
    .set({ isCurrent: false, updatedAt: new Date() })
    .where(and(eq(playerMarketValues.playerId, playerId), eq(playerMarketValues.isCurrent, true)));

  const [saved] = await db
    .insert(playerMarketValues)
    .values({
      playerId,
      asOfYear: year,
      isCurrent: true,
      modelVersion: PLAYER_VALUE_MODEL,
      currency: "GBP",
      marketValueGbp: computed.marketValueGbp,
      transferValueGbp: computed.transferValueGbp,
      contractValueGbp: computed.contractValueGbp,
      futureValueGbp: computed.futureValueGbp,
      peakCareerValueGbp: computed.peakCareerValueGbp,
      riskScore: computed.riskScore,
      confidence: computed.confidence,
      trendPct: computed.trendPct,
      trendLabel: computed.trendLabel,
      ratingBandLabel: computed.ratingBandLabel,
      baseValueGbp: computed.baseValueGbp,
      factors: computed.factors,
      recommendations: computed.recommendations,
      mediaCheck: media ?? { status: "skipped", summary: "No media check", citedUrls: [], confidence: 0, warnings: [], nudgePct: 0 },
      timeline,
      calculatedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [playerMarketValues.playerId, playerMarketValues.asOfYear],
      set: {
        isCurrent: true,
        modelVersion: PLAYER_VALUE_MODEL,
        marketValueGbp: computed.marketValueGbp,
        transferValueGbp: computed.transferValueGbp,
        contractValueGbp: computed.contractValueGbp,
        futureValueGbp: computed.futureValueGbp,
        peakCareerValueGbp: computed.peakCareerValueGbp,
        riskScore: computed.riskScore,
        confidence: computed.confidence,
        trendPct: computed.trendPct,
        trendLabel: computed.trendLabel,
        ratingBandLabel: computed.ratingBandLabel,
        baseValueGbp: computed.baseValueGbp,
        factors: computed.factors,
        recommendations: computed.recommendations,
        mediaCheck: media ?? { status: "skipped", summary: "No media check", citedUrls: [], confidence: 0, warnings: [], nudgePct: 0 },
        timeline,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning();

  return saved ? toPublic(saved) : null;
}

export async function getPlayerValueForPublic(
  playerId: string,
  options: { calculateIfMissing?: boolean } = {},
): Promise<PublicPlayerValue | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(playerMarketValues)
    .where(and(eq(playerMarketValues.playerId, playerId), eq(playerMarketValues.isCurrent, true)))
    .orderBy(desc(playerMarketValues.calculatedAt))
    .limit(1);

  if (row) return toPublic(row);
  if (options.calculateIfMissing === false) return null;
  return calculateAndPersistPlayerValue(playerId);
}
