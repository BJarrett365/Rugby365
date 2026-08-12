/**
 * Audit Coach Impact for Rassie Erasmus — current tenure.
 */
import { eq } from "drizzle-orm";
import { coaches } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { getCoachImpact } from "../apps/web/src/lib/coach-career-record-service";
import { getCoachDetail } from "../apps/web/src/lib/coach-admin-service";

async function main() {
  const db = getDb();
  const [coach] = await db.select().from(coaches).where(eq(coaches.slug, "rassie-erasmus")).limit(1);
  if (!coach) {
    console.log("Coach not found");
    return;
  }
  const detail = await getCoachDetail(coach.id);
  const current = detail?.assignments.find((a) => a.isCurrent) ?? null;
  const impact = await getCoachImpact(coach.id);

  console.log("=== TENURE ===");
  console.log({
    coach: coach.fullName ?? coach.name,
    team: current?.teamName ?? null,
    role: current?.role ?? null,
    startDate: current?.startDate ?? null,
  });

  console.log("=== IMPACT ===");
  console.log({
    modelVersion: impact.modelVersion,
    baselineLabel: impact.baselineLabel,
    underLabel: impact.underLabel,
    beforeCount: impact.beforeCount,
    underCount: impact.underCount,
    enoughData: impact.enoughData,
    confidence: impact.confidence,
    confidencePct: impact.confidencePct,
    rows: impact.rows,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
