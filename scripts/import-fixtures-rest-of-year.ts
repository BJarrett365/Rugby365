/**
 * Import latest Planet Rugby (SDMS) fixtures covering the rest of the calendar year.
 *
 * 1) Active (+ near-current) seasons for each league preset
 * 2) Global SDMS window Jul→Dec auto-import into CMS
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-fixtures-rest-of-year.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/import-fixtures-rest-of-year.ts --from=2026-07-24 --to=2026-12-31
 */
import { fetchSdmsGlobalFixtures, fetchSdmsSeasons } from "@rugby365/import-sdk";
import { importFromPlanetRugbyTournamentUrl } from "../apps/web/src/lib/planet-rugby-import-service";
import { PLANET_RUGBY_LEAGUE_PRESETS } from "../apps/web/src/lib/planet-rugby-import-presets";
import { autoImportSdmsFixtureRows } from "../apps/web/src/lib/sdms-auto-import-service";
import { getCompetitionBySlug } from "../apps/web/src/lib/competition-admin-service";

const args = process.argv.slice(2);
function argValue(name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

const FROM = argValue("from") ?? "2026-07-24";
const TO = argValue("to") ?? "2026-12-31";

function uniquePresets() {
  const seen = new Set<string>();
  return PLANET_RUGBY_LEAGUE_PRESETS.filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });
}

/** Seasons that could still hold fixtures in the FROM→TO window. */
function seasonsForRestOfYear(labels: string[], active: string | null, current: string | null): string[] {
  const wanted = new Set<string>();
  for (const label of [active, current, ...labels]) {
    if (!label) continue;
    const n = label.replace(/\s+/g, "");
    // Calendar 2026, or split seasons spanning 2025/26 and 2026/27
    if (
      n === "2026" ||
      /2025[\/\-]26/.test(n) ||
      /2026[\/\-]27/.test(n) ||
      n.includes("2026")
    ) {
      wanted.add(label);
    }
  }
  if (active) wanted.add(active);
  if (current) wanted.add(current);
  return [...wanted];
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthChunks(from: string, to: string): Array<{ start: string; end: string; season: string }> {
  const chunks: Array<{ start: string; end: string; season: string }> = [];
  let cursor = from;
  while (cursor <= to) {
    const [y, m] = cursor.split("-").map(Number);
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const endOfMonth = addDays(nextMonth, -1);
    const end = endOfMonth < to ? endOfMonth : to;
    chunks.push({
      start: cursor,
      end,
      season: String(y),
    });
    cursor = nextMonth > to ? addDays(to, 1) : nextMonth;
  }
  return chunks;
}

async function importPresetSeasons() {
  const presets = uniquePresets();
  console.log(`\n=== Planet Rugby active/near-current seasons (${presets.length} comps) ===\n`);

  let created = 0;
  let updated = 0;

  for (const preset of presets) {
    console.log(`→ ${preset.name} (${preset.slug})`);
    try {
      // Import active season first (creates/updates competition + fixtures)
      const activeResult = await importFromPlanetRugbyTournamentUrl(preset.url, {
        importFixtures: true,
        importResults: true,
        syncStandings: true,
        importMatchDetails: false,
      });
      if ("created" in activeResult) {
        created += activeResult.created;
        updated += activeResult.updated;
        console.log(
          `  ✓ ${activeResult.seasonLabel}: +${activeResult.created} created, ${activeResult.updated} updated`,
        );
      }

      const competition = await getCompetitionBySlug(preset.slug);
      if (!competition?.sdmsCompCode) {
        console.log("  ✗ no SDMS comp code after import");
        continue;
      }

      const seasons = await fetchSdmsSeasons(competition.sdmsCompCode);
      const importedLabel =
        "seasonLabel" in activeResult ? activeResult.seasonLabel : null;
      const labels = seasonsForRestOfYear(
        seasons?.seasons ?? [],
        seasons?.activeSeason ?? null,
        seasons?.currentSeason ?? null,
      ).filter((label) => label !== importedLabel);

      for (const seasonLabel of labels) {
        const started = Date.now();
        const result = await importFromPlanetRugbyTournamentUrl(preset.url, {
          seasonLabel,
          importFixtures: true,
          importResults: true,
          syncStandings: true,
          importMatchDetails: false,
        });
        if ("created" in result) {
          created += result.created;
          updated += result.updated;
          console.log(
            `  ✓ ${seasonLabel}: +${result.created} created, ${result.updated} updated (${Math.round((Date.now() - started) / 1000)}s)`,
          );
        }
      }
    } catch (e) {
      console.error(`  ✗ ${preset.slug}:`, e instanceof Error ? e.message : e);
    }
  }

  return { created, updated };
}

async function importGlobalWindow() {
  console.log(`\n=== SDMS global fixtures ${FROM} → ${TO} ===\n`);
  let imported = 0;
  let rowsSeen = 0;

  for (const chunk of monthChunks(FROM, TO)) {
    const startDatetime = `${chunk.start} 00:00:00`;
    const endDatetime = `${chunk.end} 23:59:59`;
    process.stdout.write(`→ ${chunk.start} … ${chunk.end} (season ${chunk.season}) `);
    try {
      const rows = await fetchSdmsGlobalFixtures(chunk.season, startDatetime, endDatetime, 1000);
      const list = rows ?? [];
      rowsSeen += list.length;
      if (list.length === 0) {
        console.log("(0 rows)");
        continue;
      }
      const count = await autoImportSdmsFixtureRows(list);
      imported += count;
      console.log(`→ ${list.length} rows, ${count} upserted`);
      if (list.length >= 1000) {
        console.warn("  ! hit 1000-row cap — some matches in this window may be missing");
      }
    } catch (e) {
      console.error(`\n  ✗ failed:`, e instanceof Error ? e.message : e);
    }
  }

  return { imported, rowsSeen };
}

async function main() {
  console.log(`Import fixtures rest of year: ${FROM} → ${TO}`);
  const seasons = await importPresetSeasons();
  const global = await importGlobalWindow();
  console.log("\n=== Done ===");
  console.log(`Season imports: +${seasons.created} created, ${seasons.updated} updated`);
  console.log(`Global window: ${global.rowsSeen} SDMS rows, ${global.imported} upserted`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
