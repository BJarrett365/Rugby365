/**
 * Ingest The Rugby Championship seasons 2012–2025.
 *
 * Phase A — Planet Rugby SDMS auto seasons (typically 2021–2025): fixtures/results/standings
 * Phase B — LiveSport 2012–2020: fixtures/results/tables (SDMS does not list these seasons)
 * Phase C — optional Planet Rugby match details (lineups/stats) for 2021–2025
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-championship-2012-2025.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-rugby-championship-2012-2025.ts --no-match-details
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  importFromPlanetRugbyTournamentUrl,
  importPlanetRugbyAllSeasons,
} from "../apps/web/src/lib/planet-rugby-import-service";
import { importFromLiveSportTournamentUrl } from "../apps/web/src/lib/livesport-import-service";

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
process.env.DATABASE_URL ??= "postgresql://rugby365:rugby365@localhost:5433/rugby365";

const PLANET_URL = "https://www.planetrugby.com/tournament/rugby-championship/results";
const LIVESPORT_URL = "https://www.livesport.com/uk/rugby-union/world/rugby-championship/";
const SLUG = "rugby-championship";

const ALL_YEARS = Array.from({ length: 14 }, (_, i) => String(2012 + i)); // 2012–2025
const HISTORIC_YEARS = ALL_YEARS.filter((y) => Number(y) <= 2020);
const MODERN_YEARS = ALL_YEARS.filter((y) => Number(y) >= 2021);

const skipMatchDetails = process.argv.includes("--no-match-details");
const skipPlanetAuto = process.argv.includes("--skip-planet-auto");
const skipLivesport = process.argv.includes("--skip-livesport");

function logProgress(event: {
  phase?: string;
  message?: string;
  seasonLabel?: string;
  progress?: number;
}) {
  const bits = [
    event.phase ? `[${event.phase}]` : null,
    event.seasonLabel ? event.seasonLabel : null,
    event.message,
    event.progress != null ? `(${event.progress}%)` : null,
  ].filter(Boolean);
  console.log(`  ${bits.join(" ")}`);
}

async function main() {
  console.log(`Rugby Championship ingest ${ALL_YEARS[0]}–${ALL_YEARS.at(-1)}\n`);

  // A) Planet Rugby — create competition + auto SDMS seasons (fixtures/results/standings)
  if (skipPlanetAuto) {
    console.log("→ A) Skipped Planet Rugby auto seasons (--skip-planet-auto)");
  } else {
    console.log("→ A) Planet Rugby: auto SDMS seasons (fixtures/results/standings)");
    const auto = await importFromPlanetRugbyTournamentUrl(PLANET_URL, {
      importAllSeasons: true,
      importFixtures: true,
      importResults: true,
      syncStandings: true,
      importMatchDetails: false,
      onProgress: logProgress,
    });
    if ("seasonsImported" in auto) {
      console.log(
        `  ✓ auto: ${auto.seasonsImported} seasons · +${auto.totals.created} created, ${auto.totals.updated} updated`,
      );
      for (const s of auto.seasons) {
        console.log(`    ${s.seasonLabel}: +${s.created}/${s.updated}`);
      }
    }
  }

  // B) LiveSport — historic fixtures/results/tables (SDMS season/all only lists 2021+)
  if (skipLivesport) {
    console.log("\n→ B) Skipped LiveSport (--skip-livesport)");
  } else {
    console.log("\n→ B) LiveSport: fixtures/results/standings 2012–2020");
    for (const year of HISTORIC_YEARS) {
      const started = Date.now();
      try {
        const result = await importFromLiveSportTournamentUrl(LIVESPORT_URL, {
          seasonLabel: year,
          importFixtures: true,
          importResults: true,
          syncStandings: true,
          onProgress: logProgress,
        });
        console.log(
          `  ✓ ${year}: +${result.created}/${result.updated} matches` +
            `, ${result.standingsRows} standings, ${result.resultCount} results` +
            ` (${Math.round((Date.now() - started) / 1000)}s)`,
        );
      } catch (e) {
        console.error(`  ✗ ${year}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // C) Match details (lineups/stats) for modern seasons with SDMS results
  if (!skipMatchDetails) {
    console.log("\n→ C) Planet Rugby: match details 2021–2025");
    const details = await importPlanetRugbyAllSeasons({
      competitionSlug: SLUG,
      seasonLabels: MODERN_YEARS,
      importFixtures: true,
      importResults: true,
      syncStandings: true,
      importMatchDetails: true,
      onProgress: logProgress,
    });
    console.log(
      `  ✓ match details: ${details.seasonsImported} seasons` +
        (details.totals.matchDetailsEnriched
          ? `, ${details.totals.matchDetailsEnriched} enriched`
          : ""),
    );
  } else {
    console.log("\n→ C) Skipped match details (--no-match-details)");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
