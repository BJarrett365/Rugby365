/**
 * Report whether OpenAI / ElevenLabs / Supabase / Rugby Data keys are available.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/check-integration-keys.ts
 */
import {
  getElevenLabsPublicConfig,
  getOpenAiPublicConfig,
  getRugbyDataApiPublicConfig,
  getSupabasePublicConfig,
} from "../apps/web/src/lib/integration-settings-service";

async function main() {
  const openai = await getOpenAiPublicConfig();
  const eleven = await getElevenLabsPublicConfig();
  const supabase = await getSupabasePublicConfig();
  const rugbyData = await getRugbyDataApiPublicConfig();

  console.log("=== Integration keys ===\n");
  console.log(
    `OpenAI:      configured=${openai.configured} source=${openai.keySource} model=${openai.model}${
      openai.apiKeyMasked ? ` mask=${openai.apiKeyMasked}` : ""
    }`,
  );
  console.log(
    `ElevenLabs:  configured=${eleven.configured} source=${eleven.keySource}${
      eleven.apiKeyMasked ? ` mask=${eleven.apiKeyMasked}` : ""
    }`,
  );
  console.log(
    `Supabase:    configured=${supabase.configured} urlSource=${supabase.projectUrlSource} serviceRoleSource=${supabase.serviceRoleKeySource}${
      supabase.projectUrlHost ? ` host=${supabase.projectUrlHost}` : ""
    }`,
  );
  console.log(
    `Rugby Data:  configured=${rugbyData.configured} tokenSource=${rugbyData.tokenSource} baseUrlSource=${rugbyData.baseUrlSource}`,
  );
  console.log(`  baseUrl=${rugbyData.baseUrl}`);
  if (rugbyData.apiTokenMasked) console.log(`  token mask=${rugbyData.apiTokenMasked}`);

  const missing: string[] = [];
  if (!openai.configured) {
    missing.push("OPENAI_API_KEY (.env) or Admin → Keys → OpenAI");
  }
  if (!eleven.configured) {
    missing.push("ELEVENLABS_API_KEY (.env) or Admin → Keys → ElevenLabs");
  }
  if (!supabase.configured || supabase.serviceRoleKeySource === "none") {
    missing.push("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (.env) or Admin → Keys → Supabase");
  }
  if (rugbyData.tokenSource === "none") {
    missing.push("RUGBY_DATA_API_TOKEN (.env) or Admin → Keys → Rugby Data (optional for some feeds)");
  }

  console.log();
  if (missing.length) {
    console.log("Missing / optional gaps:");
    for (const row of missing) console.log(`  - ${row}`);
    console.log("\nWikipedia / RugbyPass / Planet image pulls do not require paid keys.");
    if (!openai.configured || !supabase.configured || supabase.serviceRoleKeySource === "none") {
      process.exit(1);
    }
  } else {
    console.log("All required integration keys are configured.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
