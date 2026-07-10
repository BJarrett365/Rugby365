/**
 * Assign international teams to player profiles, then run OpenAI assessment.
 *
 * Usage:
 *   npx tsx scripts/assign-international-teams-and-ai-assess.ts
 *   npx tsx scripts/assign-international-teams-and-ai-assess.ts --intl-only
 *   npx tsx scripts/assign-international-teams-and-ai-assess.ts --ai-only --ai-limit=100
 */
import { bulkAiAssessPlayersAndTeams } from "../apps/web/src/lib/ai-bulk-assessment-service";
import { assignAllPlayerInternationalTeams } from "../apps/web/src/lib/international-team-assign-service";
import { getPlayerProfileGapStats } from "../apps/web/src/lib/fill-player-profile-gaps-service";

const args = process.argv.slice(2);
const intlOnly = args.includes("--intl-only");
const aiOnly = args.includes("--ai-only");
const aiLimitArg = args.find((arg) => arg.startsWith("--ai-limit="));
const aiLimit = aiLimitArg ? Number(aiLimitArg.split("=")[1]) : undefined;

async function main() {
  const before = await getPlayerProfileGapStats();
  console.log(
    `Before: ${before.total} players — nation ${before.withNation} (${before.missingNation} missing), intl context from country+team data`,
  );
  console.log();

  if (!aiOnly) {
    console.log("Assigning nationalities and international team links…");
    let lastLog = 0;
    const intl = await assignAllPlayerInternationalTeams({
      onlyMissing: true,
      onProgress: ({ index, total, playerName }) => {
        if (index - lastLog >= 250 || index === total) {
          lastLog = index;
          console.log(`[intl ${index}/${total}] ${playerName}`);
        }
      },
    });
    console.log(
      `International assign: ${intl.nationalityFilled} nationalities filled, ${intl.internationalTeamLinked} team links, ${intl.teamsCreated} teams created, ${intl.failures.length} failed`,
    );
    console.log();
  }

  if (!intlOnly) {
    console.log("Running OpenAI profile assessment (check_missing + safe auto-apply)…");
    let lastLog = 0;
    const ai = await bulkAiAssessPlayersAndTeams({
      entityType: "both",
      onlyMissing: true,
      autoApply: true,
      limit: aiLimit,
      delayMs: 400,
      onProgress: ({ index, total, entityType, entityName, appliedFields, error }) => {
        if (index - lastLog >= 25 || index === total) {
          lastLog = index;
          const status = error
            ? `error: ${error}`
            : appliedFields.length
              ? `applied ${appliedFields.join(", ")}`
              : "assessed";
          console.log(`[ai ${entityType} ${index}/${total}] ${entityName} — ${status}`);
        }
      },
    });
    console.log(
      `AI assessment: ${ai.playersProcessed} players, ${ai.teamsProcessed} teams, ${ai.suggestionsCreated} suggestions, ${ai.fieldsApplied} fields applied, ${ai.internationalTeamsLinked} intl links, ${ai.failures.length} failed`,
    );
    console.log();
  }

  const after = await getPlayerProfileGapStats();
  console.log(
    `After: ${after.total} players — nation ${after.withNation} (${after.missingNation} missing)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
