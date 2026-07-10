#!/usr/bin/env npx tsx
/**
 * API-only Premiership Wikipedia season audit — no database writes.
 *
 * Usage:
 *   npx tsx scripts/audit-premiership-wikipedia-api-only.ts
 *   npx tsx scripts/audit-premiership-wikipedia-api-only.ts --from=1987 --to=2007
 *   npx tsx scripts/audit-premiership-wikipedia-api-only.ts --year=2005
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchWikipediaSeasonPage,
  fetchWikipediaTeamsSection,
  parseClubsTableFromWikitext,
  parsePremiershipSeasonWikitext,
  type WikipediaClubRow,
} from "@rugby365/import-sdk";
import { formatSeasonRangeLabel } from "../apps/web/src/lib/season-label-utils";
import { PREMIERSHIP_CHAMPIONS } from "../apps/web/src/lib/competition-champions-catalog";

const onlyYear = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];
const fromYear = Number.parseInt(
  process.argv.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1987",
  10,
);
const toYear = Number.parseInt(
  process.argv.find((a) => a.startsWith("--to="))?.split("=")[1] ?? "2025",
  10,
);
const delayMs = Number.parseInt(
  process.argv.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "4000",
  10,
);

type SeasonApiAudit = {
  startYear: number;
  label: string;
  wikipediaUrl: string;
  status: "ok" | "warn" | "fail";
  issues: string[];
  champion: string | null;
  catalogWinner: string | null;
  championMatchesCatalog: boolean | null;
  standingsTeams: number;
  played: number | null;
  playedConsistent: boolean;
  regularFixtures: number;
  playoffFixtures: number;
  clubs: WikipediaClubRow[];
  clubCount: number;
  clubsWithCoach: number;
  clubsWithCaptain: number;
  clubsWithStadium: number;
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function auditUrl(
  startYear: number,
  url: string,
  catalogWinner: string | null,
): Promise<SeasonApiAudit> {
  const label = formatSeasonRangeLabel(startYear);
  const issues: string[] = [];

  const page = await fetchWikipediaSeasonPage(url);
  await sleep(800);
  const teamsWikitext = await fetchWikipediaTeamsSection(page);
  const clubs = parseClubsTableFromWikitext(teamsWikitext);
  const parsed = parsePremiershipSeasonWikitext(page);

  const playedValues = parsed.standings.map((s) => s.played);
  const played = playedValues.length ? playedValues[0]! : null;
  const playedConsistent =
    playedValues.length > 0 && playedValues.every((p) => p === playedValues[0]);

  const champion = parsed.championName;
  const championMatchesCatalog =
    catalogWinner && champion
      ? champion.toLowerCase().includes(catalogWinner.toLowerCase()) ||
        catalogWinner.toLowerCase().includes(champion.toLowerCase())
      : catalogWinner
        ? false
        : null;

  if (!parsed.standings.length) issues.push("No standings table parsed");
  if (!playedConsistent && parsed.standings.length) issues.push("Uneven games played in table");
  if (!champion) issues.push("No champion in infobox");
  if (championMatchesCatalog === false) {
    issues.push(`Champion vs catalog: wiki=${champion} catalog=${catalogWinner}`);
  }
  if (!clubs.length) issues.push("No clubs/stadiums table");
  for (const w of parsed.warnings) issues.push(`Wiki: ${w}`);

  const critical = issues.some(
    (i) => i.startsWith("No standings") || i.startsWith("No champion"),
  );

  return {
    startYear,
    label,
    wikipediaUrl: url,
    status: critical ? "fail" : issues.length ? "warn" : "ok",
    issues,
    champion,
    catalogWinner,
    championMatchesCatalog,
    standingsTeams: parsed.standings.length,
    played,
    playedConsistent,
    regularFixtures: parsed.fixtures.length,
    playoffFixtures: parsed.playoffFixtures.length,
    clubs,
    clubCount: clubs.length,
    clubsWithCoach: clubs.filter((c) => c.headCoach).length,
    clubsWithCaptain: clubs.filter((c) => c.captain).length,
    clubsWithStadium: clubs.filter((c) => c.stadium).length,
  };
}

function renderMarkdown(results: SeasonApiAudit[]): string {
  const date = new Date().toISOString().slice(0, 10);
  const ok = results.filter((r) => r.status === "ok").length;
  const warn = results.filter((r) => r.status === "warn").length;
  const fail = results.filter((r) => r.status === "fail").length;

  let md = `# Premiership Wikipedia API-Only Audit (${date})\n\n`;
  md += `Read-only MediaWiki API parse — **no database writes**.\n\n`;
  md += `| Status | Count |\n|--------|------:|\n| ok | ${ok} |\n| warn | ${warn} |\n| fail | ${fail} |\n\n`;

  md += `## Season summary\n\n`;
  md += `| Season | Status | Champion | Teams | P | Fixtures | Playoffs | Clubs | Coaches | Captains |\n`;
  md += `|--------|--------|----------|------:|--:|---------:|---------:|------:|--------:|---------:|\n`;
  for (const r of results) {
    md += `| ${r.label} | ${r.status} | ${r.champion ?? "—"} | ${r.standingsTeams} | ${r.played ?? "—"} | ${r.regularFixtures} | ${r.playoffFixtures} | ${r.clubCount} | ${r.clubsWithCoach} | ${r.clubsWithCaptain} |\n`;
  }

  md += `\n## Club tables\n\n`;
  for (const r of results) {
    if (!r.clubs.length) continue;
    md += `### ${r.label}\n\n`;
    if (r.issues.length) md += `Issues: ${r.issues.map((i) => `\`${i}\``).join("; ")}\n\n`;
    md += `| Club | Director of Rugby / Head Coach | Captain | Stadium | Capacity | City/Area |\n`;
    md += `|------|--------------------------------|---------|---------|----------:|----------|\n`;
    for (const c of r.clubs) {
      md += `| ${c.clubName} | ${c.headCoach ?? "—"} | ${c.captain ?? "—"} | ${c.stadium ?? "—"} | ${c.capacity ?? "—"} | ${c.cityArea ?? "—"} |\n`;
    }
    md += `\n`;
  }

  md += `## Sources\n\n`;
  for (const r of results) {
    md += `- ${r.label}: ${r.wikipediaUrl}\n`;
  }
  return md;
}

async function main() {
  const seasons = PREMIERSHIP_CHAMPIONS.filter((s) => {
    if (!s.wikipediaUrl) return false;
    if (onlyYear) return String(s.startYear) === onlyYear;
    return s.startYear >= fromYear && s.startYear <= toYear;
  }).sort((a, b) => a.startYear - b.startYear);

  if (!seasons.length) {
    console.error("No seasons matched catalog + filters.");
    process.exit(1);
  }

  console.log(`API-only audit of ${seasons.length} Wikipedia season(s) (no DB writes)…\n`);

  const results: SeasonApiAudit[] = [];
  for (const [index, season] of seasons.entries()) {
    if (index > 0) await sleep(delayMs);
    process.stdout.write(`${season.startYear}… `);
    try {
      const row = await auditUrl(season.startYear, season.wikipediaUrl!, season.winner);
      results.push(row);
      console.log(row.status.toUpperCase(), `champ=${row.champion ?? "—"} clubs=${row.clubCount}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log("FAIL", message);
      results.push({
        startYear: season.startYear,
        label: formatSeasonRangeLabel(season.startYear),
        wikipediaUrl: season.wikipediaUrl!,
        status: "fail",
        issues: [message],
        champion: null,
        catalogWinner: season.winner,
        championMatchesCatalog: false,
        standingsTeams: 0,
        played: null,
        playedConsistent: false,
        regularFixtures: 0,
        playoffFixtures: 0,
        clubs: [],
        clubCount: 0,
        clubsWithCoach: 0,
        clubsWithCaptain: 0,
        clubsWithStadium: 0,
      });
    }
  }

  const reportPath = join(
    process.cwd(),
    "docs/audits",
    `PREMIERSHIP_WIKIPEDIA_API_AUDIT_${fromYear}-${toYear}_${new Date().toISOString().slice(0, 10)}.md`,
  );
  writeFileSync(reportPath, renderMarkdown(results), "utf8");
  console.log(`\nReport: ${reportPath}`);
  console.log(
    `Summary: ${results.filter((r) => r.status === "ok").length} ok, ${results.filter((r) => r.status === "warn").length} warn, ${results.filter((r) => r.status === "fail").length} fail`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
