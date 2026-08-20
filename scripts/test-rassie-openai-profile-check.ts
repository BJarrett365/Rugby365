/**
 * Run OpenAI profile check on Rassie (falls back to rule pre-check if no API key).
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/test-rassie-openai-profile-check.ts
 */
import { runCoachOpenAiProfileCheck } from "../apps/web/src/lib/coach-openai-profile-check-service";

const COACH_ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";

async function main() {
  console.log("Running OpenAI Profile Check for Rassie…");
  const result = await runCoachOpenAiProfileCheck(COACH_ID, { scope: "full" });
  const r = result.report;
  console.log("\nPROFILE HEALTH:", r.profileHealth + "%");
  console.log("MODEL:", r.model);
  console.log("HEADLINE:", r.summary.headline);
  console.log("\nSECTIONS:");
  for (const s of r.sections) console.log(`  ${s.label}: ${s.score}%`);
  console.log("\nSUMMARY COUNTS:", r.summary);
  console.log("\nSOURCES USED:");
  for (const s of r.sourcesUsed) {
    console.log(`  ${s.label}: retrieved=${s.retrieved}${s.note ? ` (${s.note})` : ""}`);
  }
  console.log("\nNEXT BEST ACTIONS:");
  for (const a of r.nextBestActions) console.log(`  - ${a}`);
  console.log(`\nFINDINGS (${r.findings.length}):`);
  for (const f of r.findings.slice(0, 25)) {
    console.log(
      `  [${f.severity}] ${f.issueType} · ${f.label} · ${f.suggestionClass} → ${f.recommendedAction}`,
    );
    console.log(`    ${f.rationale}`);
  }
  console.log("\nReport ID:", result.reportId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
