/**
 * Lightweight OpenAI player profile check (Phase 3).
 * Stores structured review in ai_verification_reports.
 * Sourced facts still require editor approval — never auto-applied.
 */

import "server-only";

import { desc, eq, and } from "drizzle-orm";
import { aiVerificationReports } from "@rugby365/db";
import { getDb } from "./db";

export type PlayerOpenAiCheckSnapshot = {
  identity: Record<string, unknown>;
  career: Record<string, unknown>;
  ratings: Record<string, unknown>;
  value: Record<string, unknown>;
  health: Record<string, unknown>;
  gaps: string[];
};

export type PlayerOpenAiCheckResult = {
  reportId: string;
  model: string;
  status: "pending" | "skipped";
  report: Record<string, unknown>;
};

function buildHeuristicReport(snapshot: PlayerOpenAiCheckSnapshot) {
  return {
    summary:
      "Heuristic Phase 3 profile check (OpenAI skipped or unavailable). Editor must verify sourced facts.",
    identityCompleteness: snapshot.identity,
    careerGaps: snapshot.gaps,
    teamLinks: snapshot.career,
    ratingHealth: snapshot.ratings,
    valueHealth: snapshot.value,
    dataHealth: snapshot.health,
    recommendations: [
      "Verify proposed RWC / Championship honours before public show",
      "Backfill SA fixture archive to close caps coverage",
      "Leave preferred foot / contract blank until sourced",
      "Investigate VALUE OUTLIER REVIEW before publishing market value",
    ],
    autoApplyBlocked: true,
  };
}

export async function runPlayerOpenAiProfileCheck(
  playerId: string,
  snapshot: PlayerOpenAiCheckSnapshot,
): Promise<PlayerOpenAiCheckResult> {
  const db = getDb();
  const apiKey = process.env.OPENAI_API_KEY;
  let model = "heuristic-phase3";
  let report: Record<string, unknown> = buildHeuristicReport(snapshot);
  let status: "pending" | "skipped" = "skipped";

  if (apiKey) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey });
      model = process.env.OPENAI_PLAYER_CHECK_MODEL ?? "gpt-4o-mini";
      const completion = await client.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You review Rugby365 player profile data quality. Do not invent facts. Flag gaps, conflicts, and weak ratings/value. Never approve unverified sourced claims.",
          },
          {
            role: "user",
            content: JSON.stringify(snapshot, null, 2),
          },
        ],
        response_format: { type: "json_object" },
      });
      const text = completion.choices[0]?.message?.content ?? "{}";
      report = JSON.parse(text) as Record<string, unknown>;
      status = "pending";
    } catch (e) {
      report = {
        ...buildHeuristicReport(snapshot),
        openaiError: e instanceof Error ? e.message : String(e),
      };
      status = "skipped";
      model = "heuristic-phase3";
    }
  }

  const [row] = await db
    .insert(aiVerificationReports)
    .values({
      entityType: "player",
      entityId: playerId,
      status: "pending",
      model,
      promptSystem: "player-profile-check-v1",
      promptUser: JSON.stringify(snapshot),
      sourceSnapshot: snapshot,
      report,
      confidenceScore: status === "pending" ? 0.6 : 0.4,
    })
    .returning();

  return {
    reportId: row!.id,
    model,
    status,
    report,
  };
}

export async function listPlayerOpenAiProfileChecks(playerId: string, limit = 10) {
  const db = getDb();
  return db
    .select({
      id: aiVerificationReports.id,
      model: aiVerificationReports.model,
      createdAt: aiVerificationReports.createdAt,
      confidenceScore: aiVerificationReports.confidenceScore,
      report: aiVerificationReports.report,
      status: aiVerificationReports.status,
    })
    .from(aiVerificationReports)
    .where(
      and(
        eq(aiVerificationReports.entityType, "player"),
        eq(aiVerificationReports.entityId, playerId),
      ),
    )
    .orderBy(desc(aiVerificationReports.createdAt))
    .limit(limit);
}
