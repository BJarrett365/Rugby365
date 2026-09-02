/**
 * Store Stats Perform Rugby Union SDAPI docs login in local Postgres and Rugby365 Supabase.
 * Does not commit secrets. Pass credentials via env (never put them in this file).
 *
 * Usage:
 *   STATS_PERFORM_DOCS_USERNAME=… STATS_PERFORM_DOCS_PASSWORD=… \
 *     npx tsx --require ./scripts/stub-server-only.cjs scripts/seed-stats-perform-sdapi.ts
 *
 * Optional:
 *   STATS_PERFORM_OUTLET_AUTH_KEY=…   # 26-char Perform Feeds outlet key
 *   --skip-supabase
 *   --skip-test
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const args = new Set(process.argv.slice(2));
const skipSupabase = args.has("--skip-supabase");
const skipTest = args.has("--skip-test");

async function main() {
  const {
    STATS_PERFORM_SDAPI_SLUG,
    getStatsPerformSdapiConfig,
    getStatsPerformSdapiPublicConfig,
    saveStatsPerformSdapiCredentials,
    testResolvedStatsPerformDocsLogin,
    testResolvedStatsPerformSdapiConnection,
  } = await import("../apps/web/src/lib/integration-settings-service");

  const docsUsername = process.env.STATS_PERFORM_DOCS_USERNAME?.trim();
  const docsPassword = process.env.STATS_PERFORM_DOCS_PASSWORD;
  const outletAuthKey =
    process.env.STATS_PERFORM_OUTLET_AUTH_KEY?.trim() || "1vmmaetzoxkgg1qf6pkpfmku0k";
  const baseUrl = process.env.STATS_PERFORM_SDAPI_BASE_URL?.trim();

  if (!docsUsername || !docsPassword) {
    throw new Error(
      "Set STATS_PERFORM_DOCS_USERNAME and STATS_PERFORM_DOCS_PASSWORD in the environment (not in git).",
    );
  }

  const saved = await saveStatsPerformSdapiCredentials({
    docsUsername,
    docsPassword,
    outletAuthKey,
    baseUrl,
  });
  console.log("Local CMS:");
  console.log(
    `  slug=${STATS_PERFORM_SDAPI_SLUG} docs=${saved.docsConfigured} outletKey=${saved.apiConfigured} user=${saved.docsUsername}`,
  );

  if (!skipSupabase) {
    try {
      const { getSupabaseServerClient } = await import("../apps/web/src/lib/supabase-server");
      const supabase = await getSupabaseServerClient("service");
      const config = await getStatsPerformSdapiConfig();
      const { error } = await supabase.from("integration_settings").upsert(
        {
          slug: STATS_PERFORM_SDAPI_SLUG,
          label: "Stats Perform SDAPI",
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" },
      );
      if (error) {
        console.warn(`Supabase upsert failed: ${error.message}`);
      } else {
        console.log("Supabase: upserted integration_settings.stats_perform_sdapi");
      }
    } catch (error) {
      console.warn(
        `Supabase skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (skipTest) {
    const publicConfig = await getStatsPerformSdapiPublicConfig();
    console.log(`Saved without live tests. docsConfigured=${publicConfig.docsConfigured}`);
    return;
  }

  const docs = await testResolvedStatsPerformDocsLogin();
  console.log(`Docs login: ${docs.ok ? "OK" : "FAIL"} HTTP ${docs.status} ${docs.message}`);

  const api = await testResolvedStatsPerformSdapiConnection();
  console.log(`SDAPI: ${api.ok ? "OK" : "FAIL"} HTTP ${api.status} ${api.message}`);
  if (api.matches?.length) {
    for (const match of api.matches.slice(0, 8)) {
      console.log(
        `  ${match.home ?? "?"} ${match.homeScore ?? "–"}–${match.awayScore ?? "–"} ${match.away ?? "?"} (${match.competition ?? "n/a"})`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
