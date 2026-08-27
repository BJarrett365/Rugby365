/**
 * Import South Africa squad + historical Springboks from Ultimate Rugby
 * (bio, career/club history, caps from bio text, news links).
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-ultimate-rugby-sa-squad.ts
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-ultimate-rugby-sa-squad.ts --write
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-ultimate-rugby-sa-squad.ts --write --historical
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-ultimate-rugby-sa-squad.ts --write --all
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/import-ultimate-rugby-sa-squad.ts --write --player=bryan-habana
 */
import {
  formatUltimateRugbyHistoricalReport,
  formatUltimateRugbyImportReport,
  importUltimateRugbyHistoricalSaPlayers,
  importUltimateRugbyPlayerProfile,
  importUltimateRugbySquad,
  SOUTH_AFRICA_SQUAD_PATH,
  SOUTH_AFRICA_TEAM_ID,
} from "../apps/web/src/lib/ultimate-rugby-import-service";
import {
  ULTIMATE_RUGBY_ORIGIN,
  fetchUltimateRugbyHtml,
  parseUltimateRugbyNewsHtml,
  parseUltimateRugbyPlayerHtml,
} from "../apps/web/src/lib/ultimate-rugby-parse";

const dryRun = !process.argv.includes("--write");
const historical = process.argv.includes("--historical") || process.argv.includes("--all");
const squadToo = process.argv.includes("--all") || (!process.argv.includes("--historical") && !argValue("--player"));

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function main() {
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const playerSlug = argValue("--player");

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Ultimate Rugby SA import` +
      (squadToo ? " [squad]" : "") +
      (historical ? " [historical]" : "") +
      (limit ? ` (limit=${limit})` : "") +
      (playerSlug ? ` (player=${playerSlug})` : ""),
  );

  if (playerSlug) {
    const path = playerSlug.startsWith("/") ? playerSlug : `/${playerSlug.replace(/^\/+/, "")}`;
    const url = `${ULTIMATE_RUGBY_ORIGIN}${path}`;
    console.log(`Fetching ${url}`);
    const html = await fetchUltimateRugbyHtml(url);
    const profile = parseUltimateRugbyPlayerHtml(html, path);
    let newsItems = [];
    try {
      const newsHtml = await fetchUltimateRugbyHtml(`${url}/news`);
      newsItems = parseUltimateRugbyNewsHtml(newsHtml, path);
    } catch {
      newsItems = [];
    }
    console.log(
      `Parsed ${profile.name}: bio=${profile.bioSummary?.length ?? 0} career=${profile.careerStints.length} caps=${profile.internationalCaps} news=${newsItems.length}`,
    );
    const result = await importUltimateRugbyPlayerProfile(profile, {
      internationalTeamId: SOUTH_AFRICA_TEAM_ID,
      countryName: "South Africa",
      dryRun,
      newsItems,
    });
    console.log(JSON.stringify(result, null, 2));
    if (dryRun) console.log("\nNo database writes. Re-run with --write to apply.");
    return;
  }

  if (squadToo) {
    const report = await importUltimateRugbySquad({
      squadPath: SOUTH_AFRICA_SQUAD_PATH,
      internationalTeamId: SOUTH_AFRICA_TEAM_ID,
      countryName: "South Africa",
      playersOnly: true,
      delayMs: 400,
      limit: Number.isFinite(limit) ? limit : undefined,
      dryRun,
      includeCareer: true,
      includeNews: true,
      onProgress: (msg) => console.log(msg),
    });
    console.log("\n" + formatUltimateRugbyImportReport(report));
  }

  if (historical) {
    const report = await importUltimateRugbyHistoricalSaPlayers({
      internationalTeamId: SOUTH_AFRICA_TEAM_ID,
      countryName: "South Africa",
      delayMs: 400,
      limit: Number.isFinite(limit) ? limit : undefined,
      dryRun,
      includeCareer: true,
      includeNews: true,
      onProgress: (msg) => console.log(msg),
    });
    console.log("\n" + formatUltimateRugbyHistoricalReport(report));
  }

  if (dryRun) console.log("\nNo database writes. Re-run with --write to apply.");
  else console.log("\nImport applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
