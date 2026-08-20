import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-errors";
import { getPublicPlayerOverviewV2 } from "@/lib/public-player-overview-v2-service";
import {
  listPlayerOpenAiProfileChecks,
  runPlayerOpenAiProfileCheck,
} from "@/lib/player-openai-profile-check-service";
import { evaluatePlayerDataHealth } from "@/lib/player-data-health";
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "@/lib/db";

/**
 * GET — list prior OpenAI / heuristic player profile checks.
 * POST — run a new check. Nothing auto-publishes.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const history = await listPlayerOpenAiProfileChecks(id, 15);
    return NextResponse.json({
      ok: true,
      history: history.map((h) => ({
        id: h.id,
        model: h.model,
        checkedAt: h.createdAt?.toISOString?.() ?? null,
        confidenceScore: h.confidenceScore,
        status: h.status,
        report: h.report,
      })),
      lastChecked: history[0]?.createdAt?.toISOString?.() ?? null,
    });
  } catch (e) {
    return apiErrorResponse(e);
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const overview = await getPublicPlayerOverviewV2(player.slug, { preview: true });
    if (!overview) {
      return NextResponse.json({ error: "Overview unavailable" }, { status: 404 });
    }

    const health = evaluatePlayerDataHealth({
      playerId: id,
      nameHasAccent: Boolean(overview.name?.includes("é") || overview.name?.includes("É")),
      dobVerified: Boolean(overview.birthDate && overview.birthDate !== "1994-01-01"),
      clubIsNotNation:
        overview.club != null &&
        overview.internationalTeam != null &&
        overview.club.name !== overview.internationalTeam.name,
      clubTeamId: overview.club ? "set" : null,
      internationalTeamId: overview.internationalTeam ? "set" : null,
      preferredFoot: overview.preferredFoot,
      contractVerified: Boolean(overview.contract.expiresOn),
      membershipCount: overview.clubHistory.length,
      transferCount: overview.base.transfers.length,
      stintsLinked: overview.clubHistory.length + overview.internationalHistory.length,
      stintsTotal: overview.clubHistory.length + overview.internationalHistory.length,
      verifiedCaps: overview.verifiedInternationalCaps,
      linkedCaps: overview.linkedInternationalCaps,
      verifiedPoints: overview.verifiedInternationalPoints,
      linkedPoints: overview.career.internationalPoints,
      matchRatings: overview.ratingHistory.length,
      ratingSnapshots: overview.ratingHistory.length,
      intelligenceModel: overview.intelligence.modelVersion,
      overallRating: overview.intelligence.overall,
      marketValueGbp: overview.playerValue?.marketValueGbp ?? null,
      valueOutlier: overview.valueOutlier,
      honourCount: overview.achievements.length,
      honourVerifiedCount: overview.achievements.filter((a) => a.verificationStatus === "verified")
        .length,
      internationalPositionApps: overview.positionHistory.international.reduce(
        (a, r) => a + r.appearances,
        0,
      ),
      clubPositionApps: overview.positionHistory.club.reduce((a, r) => a + r.appearances, 0),
      hasPrimarySource: true,
    });

    const result = await runPlayerOpenAiProfileCheck(id, {
      identity: {
        name: overview.name,
        dob: overview.birthDate,
        club: overview.club?.name ?? null,
        international: overview.internationalTeam?.name ?? null,
      },
      career: {
        caps: overview.verifiedInternationalCaps,
        linkedCaps: overview.linkedInternationalCaps,
        stints: overview.clubHistory.length,
      },
      ratings: {
        overall: overview.intelligence.overall,
        model: overview.intelligence.modelVersion,
        confidence: overview.intelligence.confidence,
      },
      value: {
        marketValueGbp: overview.playerValue?.marketValueGbp ?? null,
        outlier: overview.valueOutlier,
      },
      health: health as unknown as Record<string, unknown>,
      gaps: health.rows.filter((r) => r.grade === "THIN" || r.grade === "MISSING").map((r) => r.note),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return apiErrorResponse(e);
  }
}
