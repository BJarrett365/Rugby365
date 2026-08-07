/**
 * Scrape Wikipedia `{year}_Rugby_World_Cup_statistics` via MediaWiki wikitext.
 * Captures try/points boards + Individual records (tackles/metres/carries/breaks).
 *
 * Writes docs/scraped/wikipedia/rugby-world-cup-statistics/{year}.json
 *
 * Usage:
 *   npx tsx scripts/scrape-wikipedia-rwc-statistics.ts --force --delay=4000
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  RUGBY_WORLD_CUP_CHAMPIONS,
  rugbyWorldCupWikipediaStatisticsUrl,
} from "../apps/web/src/lib/competition-champions-catalog";

const ROOT = join(process.cwd(), "docs/scraped/wikipedia/rugby-world-cup-statistics");
const UA = "Rugby365Bot/1.0 (https://localhost; RWC historical stats research)";

const FLAG_TEAMS: Record<string, string> = {
  ARG: "Argentina",
  AUS: "Australia",
  CAN: "Canada",
  ENG: "England",
  FIJ: "Fiji",
  FRA: "France",
  GEO: "Georgia",
  IRE: "Ireland",
  ITA: "Italy",
  JPN: "Japan",
  NAM: "Namibia",
  NZL: "New Zealand",
  POR: "Portugal",
  ROM: "Romania",
  ROU: "Romania",
  RSA: "South Africa",
  RUS: "Russia",
  SAM: "Samoa",
  WSA: "Samoa",
  SCO: "Scotland",
  TGA: "Tonga",
  TON: "Tonga",
  URU: "Uruguay",
  USA: "United States",
  WAL: "Wales",
  ZIM: "Zimbabwe",
  CIV: "Ivory Coast",
  ESP: "Spain",
  CHL: "Chile",
};

const args = process.argv.slice(2);
const onlyYears = args
  .find((a) => a.startsWith("--years="))
  ?.split("=")[1]
  ?.split(",")
  .map((y) => Number(y.trim()))
  .filter((y) => Number.isFinite(y));
const force = args.includes("--force");
const delayMs = Number(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? 4000);

export type WikiStatEntry = {
  playerName: string;
  teamName?: string;
  tries?: number;
  points?: number;
  conversions?: number;
  penalties?: number;
  dropGoals?: number;
  tacklesCompleted?: number;
  metresCarried?: number;
  carries?: number;
  tryAssists?: number;
  defendersBeaten?: number;
  lineBreaks?: number;
  turnoversWon?: number;
};

export type WikiStatsYearFile = {
  year: number;
  sourceUrl: string;
  scrapedAt: string;
  entries: WikiStatEntry[];
  notes: string[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function wikiLinkName(raw: string): string {
  const m = raw.match(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/);
  if (!m) return raw.replace(/'{2,}/g, "").trim();
  return (m[2] ?? m[1] ?? "").replace(/'{2,}/g, "").trim();
}

function extractFlagTeam(chunk: string): string | undefined {
  const flag = chunk.match(/\{\{(?:flagicon|ru|Ru)\|([A-Z]{3})(?:\|[^}]*)?\}\}/i);
  if (flag) return FLAG_TEAMS[flag[1]!.toUpperCase()];
  const nation = chunk.match(/\(\[\[([^\|\]]+?)(?:\|([^\]]+))?\]\]\)/);
  if (nation) {
    const label = (nation[2] ?? nation[1] ?? "").replace(/ national rugby union team/i, "").trim();
    return label || undefined;
  }
  return undefined;
}

function section(wikitext: string, heading: string): string {
  const re = new RegExp(`==\\s*${heading}\\s*==([\\s\\S]*?)(?:\\n==[^=]|$)`, "i");
  return wikitext.match(re)?.[1] ?? "";
}

function subSection(wikitext: string, heading: string): string {
  const re = new RegExp(`===\\s*${heading}\\s*===([\\s\\S]*?)(?:\\n==[^=]|$)`, "i");
  return wikitext.match(re)?.[1] ?? "";
}

function parseCountLists(
  body: string,
  metric: "tries" | "points" | "conversions" | "penalties" | "dropGoals",
): WikiStatEntry[] {
  const entries: WikiStatEntry[] = [];
  const unit =
    metric === "tries"
      ? "tries?"
      : metric === "points"
        ? "points?"
        : metric === "conversions"
          ? "conversions?"
          : metric === "penalties"
            ? "penalt(?:y|ies)"
            : "drop goals?";
  const blocks = [
    ...body.matchAll(new RegExp(`;\\s*(\\d+)\\s+${unit}\\s*\\n([\\s\\S]*?)(?=\\n;\\s*\\d+|\\n==|$)`, "gi")),
  ];
  for (const block of blocks) {
    const count = Number(block[1]);
    const chunk = block[2] ?? "";
    for (const line of chunk.split("\n")) {
      if (!line.includes("[[")) continue;
      const playerName = wikiLinkName(line);
      if (!playerName || /penalty try|flagicon|\{\{/i.test(playerName)) continue;
      entries.push({
        playerName,
        teamName: extractFlagTeam(line),
        [metric]: count,
      });
    }
  }
  return entries;
}

function cellNumber(raw: string): number | null {
  // Prefer {{Sort|sortkey|display}} display value (2007+ leaderboards).
  const sort = raw.match(/\{\{\s*Sort\s*\|[^|}]*\|([^}|]+)\}\}/i);
  if (sort) {
    const n = Number(sort[1]!.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  // Handles '''68''', ! scope=row ... '''6''', plain ints
  const cleaned = raw
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/!+\s*scope=[^\s|]*/gi, " ")
    .replace(/style="[^"]*"/gi, " ");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function flattenWikiRowCells(row: string): string[] {
  const cells = row
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => {
      if (!l || l.startsWith("|+") || l.startsWith("|}") || l.startsWith("|-")) return false;
      if (l.startsWith("|")) return true;
      // 2007 points column uses !{{Sort|…|105}} as a header-style cell in data rows.
      if (l.startsWith("!")) {
        if (/\{\{\s*Sort\s*\|/i.test(l) || /scope\s*=\s*row/i.test(l)) return true;
        if (/^\d/.test(l.replace(/^!\s*/, "")) || /'''\d+'''/.test(l)) return true;
      }
      return false;
    });
  const flat: string[] = [];
  for (const cell of cells) {
    const parts = cell
      .replace(/^[|!]/, "")
      .split("||")
      .flatMap((part) => {
        if (/scope\s*=/i.test(part) && part.includes("|")) {
          return part.split("|").map((p) => p.trim()).filter(Boolean);
        }
        return [part.trim()];
      })
      .filter(Boolean);
    flat.push(...parts);
  }
  return flat;
}

function detectLeaderboardSchema(
  headerRow: string,
): "played_first" | "points_first" | "points_leading" | "tries_board" | null {
  const h = headerRow.toLowerCase();
  if (!h.includes("player") && !h.includes("name")) return null;
  // 2007 style: Points | Name | … | Apps | Tries | Con | Pen | Drop
  if (h.includes("points") && h.includes("apps") && h.includes("tries")) {
    return "points_leading";
  }
  // 2007 try board: Rank | Name | … | Apps | Tries
  if (h.includes("tries") && (h.includes("apps") || h.includes("rank")) && !h.includes("points") && !h.includes("total")) {
    return "tries_board";
  }
  if (h.includes("played") && h.includes("tries") && (h.includes("total") || h.includes("points"))) {
    return "played_first";
  }
  if (h.includes("total") || (h.includes("points") && h.includes("tries"))) {
    return "points_first";
  }
  return null;
}

/** Top point/try tables: Played, Tries, Conv, Pen, Drop, Total — or older Total-first layouts. */
function parsePointsTable(body: string): WikiStatEntry[] {
  const entries: WikiStatEntry[] = [];
  const rows = body.split(/\n\|-/);
  let schema: "played_first" | "points_first" | "points_leading" | "tries_board" | null = null;

  for (const row of rows) {
    if (
      /!\s*(?:width=|Player|Team|Points|Name|Rank|Apps|Tries)/i.test(row) &&
      !row.includes("[[")
    ) {
      schema = detectLeaderboardSchema(row) ?? schema;
      continue;
    }
    if (!row.includes("[[")) continue;
    const flat = flattenWikiRowCells(row);
    if (flat.length < 2) continue;
    const playerCell = flat.find((c) => {
      if (!c.includes("[[")) return false;
      if (/\bnational rugby\b/i.test(c)) return false;
      // Reject position-template links (Wing (rugby union)|WG), keep "Nick Evans (rugby union)".
      if (/\|(?:FB|FH|SH|WG|CE|PR|HK|SR|FL|N8|LK|No\.?\s*8)\s*\]\]/i.test(c)) return false;
      if (/\[\[(?:Wing|Fly-half|Fullback|Centre|Flanker|Hooker|Prop|Lock|Number eight|Scrum-half)\b/i.test(c)) {
        return false;
      }
      return true;
    });
    if (!playerCell) continue;
    const playerName = wikiLinkName(playerCell);
    if (
      !playerName ||
      /^(player|team|position|name|rank|fb|fh|sh|wg|ce|pr|hk|sr|fl|n8|lk)$/i.test(playerName) ||
      playerName.length < 3
    ) {
      continue;
    }

    const teamName = extractFlagTeam(row);
    const nums = flat.map(cellNumber).filter((n): n is number => n != null);
    if (nums.length < 1) continue;

    const mode =
      schema ??
      (nums.length >= 6 ? "played_first" : nums.length >= 5 ? "points_first" : null);
    if (!mode) {
      // Minimal try board fallback: last number is tries when small.
      if (nums.length >= 2 && nums[nums.length - 1]! <= 20) {
        entries.push({
          playerName,
          teamName,
          tries: nums[nums.length - 1],
          points: (nums[nums.length - 1] ?? 0) * 5,
        });
      }
      continue;
    }

    let played: number | undefined;
    let tries: number | undefined;
    let conversions: number | undefined;
    let penalties: number | undefined;
    let dropGoals: number | undefined;
    let points: number | undefined;

    if (mode === "points_leading") {
      // Points, Apps, Tries, Conversions, Penalties, Drop goals
      points = nums[0];
      played = nums[1];
      tries = nums[2];
      conversions = nums[3];
      penalties = nums[4];
      dropGoals = nums[5];
    } else if (mode === "tries_board") {
      // Rank?, Apps?, Tries — take last number as tries.
      tries = nums[nums.length - 1];
      if (nums.length >= 2) played = nums[nums.length - 2];
      points = (tries ?? 0) * 5;
    } else if (mode === "played_first") {
      // Played, Tries, Conversions, Penalties, Drop goals, Total points [, yellow [, red]]
      const slice =
        nums[0]! >= 1 && nums[0]! <= 12 && nums.length >= 6
          ? nums.slice(0, 6)
          : nums.slice(Math.max(0, nums.length - 6));
      played = slice[0];
      tries = slice[1];
      conversions = slice[2];
      penalties = slice[3];
      dropGoals = slice[4];
      points = slice[5];
    } else {
      // Total, Tries, Conversions, Penalties, Drop goals (older pages)
      points = nums[0];
      tries = nums[1];
      conversions = nums[2];
      penalties = nums[3];
      dropGoals = nums[4];
    }

    // Heuristic: ignore team-stats style rows with no plausible player total.
    if (points != null && points > 200) continue;
    if (played != null && played > 12) continue;

    entries.push({
      playerName,
      teamName,
      points,
      tries,
      conversions,
      penalties,
      dropGoals,
    });
  }
  return entries;
}

function parseIndividualRecords(body: string): WikiStatEntry[] {
  const entries: WikiStatEntry[] = [];
  const patterns: Array<{ label: RegExp; field: keyof WikiStatEntry }> = [
    { label: /Most tackles made by an individual/i, field: "tacklesCompleted" },
    { label: /Most metres made by an individual/i, field: "metresCarried" },
    { label: /Most carries made by an individual/i, field: "carries" },
    { label: /Most clean breaks made by an individual/i, field: "lineBreaks" },
    { label: /Most turnovers(?: won)?(?: made)? by an individual/i, field: "turnoversWon" },
    { label: /Most defenders beaten by an individual/i, field: "defendersBeaten" },
    { label: /Most try assists by an individual/i, field: "tryAssists" },
  ];

  for (const { label, field } of patterns) {
    const re = new RegExp(
      String.raw`\*\s*${label.source}:\s*'*(\d+)'*\s*[–-]\s*([\s\S]*?)(?=\n\*(?!\*)|\n===|\n==[^=]|$)`,
      "i",
    );
    const m = body.match(re);
    if (!m) continue;
    const value = Number(m[1]);
    const chunk = m[2] ?? "";
    for (const link of chunk.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)) {
      const target = link[1] ?? "";
      const display = link[2] ?? link[1] ?? "";
      if (/national rugby|rugby union team/i.test(target) || /national rugby|rugby union team/i.test(display)) {
        continue;
      }
      const playerName = (link[2] ?? link[1] ?? "").trim();
      if (!playerName || playerName.length < 2) continue;
      const teamName = extractFlagTeam(chunk) ?? (() => {
        const nation = chunk.match(
          /\(\[\[([^\|\]]*national rugby[^\|\]]*)(?:\|([^\]]+))?\]\]\)/i,
        );
        return nation
          ? (nation[2] ?? nation[1] ?? "").replace(/ national rugby union team/i, "").trim()
          : undefined;
      })();
      entries.push({ playerName, teamName, [field]: value });
    }
  }
  return entries;
}

function mergeEntries(rows: WikiStatEntry[]): WikiStatEntry[] {
  const map = new Map<string, WikiStatEntry>();
  for (const row of rows) {
    const key = `${row.playerName.toLowerCase()}|${(row.teamName ?? "").toLowerCase()}`;
    const cur = map.get(key) ?? { playerName: row.playerName, teamName: row.teamName };
    for (const k of Object.keys(row) as Array<keyof WikiStatEntry>) {
      if (k === "playerName" || k === "teamName") continue;
      const v = row[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        const prev = cur[k];
        (cur as Record<string, unknown>)[k] =
          typeof prev === "number" ? Math.max(prev as number, v) : v;
      }
    }
    if (!cur.teamName && row.teamName) cur.teamName = row.teamName;
    map.set(key, cur);
  }
  return [...map.values()];
}

async function fetchWikitext(title: string): Promise<string> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", title);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`API ${res.status} for ${title}`);
  const json = (await res.json()) as { error?: { info?: string }; parse?: { wikitext?: string } };
  if (json.error?.info) throw new Error(json.error.info);
  const wt = json.parse?.wikitext;
  if (!wt) throw new Error(`No wikitext for ${title}`);
  return wt;
}

function firstSection(wikitext: string, headings: string[]): { body: string; heading: string } | null {
  for (const heading of headings) {
    // Prefer level-3 first: section() ==foo== also matches ===foo=== and can over-capture.
    const body = subSection(wikitext, heading) || section(wikitext, heading);
    if (body.trim()) return { body, heading };
  }
  return null;
}

function parseYear(year: number, sourceUrl: string, wikitext: string): WikiStatsYearFile {
  const notes: string[] = [];
  const collected: WikiStatEntry[] = [];

  const trySec = firstSection(wikitext, ["Top try scorers", "Most tries", "Try scorers"]);
  if (trySec) {
    collected.push(...parseCountLists(trySec.body, "tries"));
    collected.push(...parsePointsTable(trySec.body));
  } else {
    notes.push("no Try scorers section");
  }

  const pointsSec = firstSection(wikitext, [
    "Top point scorers",
    "Most points",
    "Point scorers",
    "Overall points scorers",
  ]);
  if (pointsSec) {
    collected.push(...parseCountLists(pointsSec.body, "points"));
    collected.push(...parsePointsTable(pointsSec.body));
  } else {
    // older pages may only have Overall Points Scorers tables under Player records
    collected.push(...parsePointsTable(wikitext));
    notes.push("no Point scorers section — scanned full page tables");
  }

  const convBody = section(wikitext, "Conversion scorers");
  if (convBody) collected.push(...parseCountLists(convBody, "conversions"));
  const penBody = section(wikitext, "Penalty goal scorers");
  if (penBody) collected.push(...parseCountLists(penBody, "penalties"));
  const dropBody = section(wikitext, "Drop goal scorers");
  if (dropBody) collected.push(...parseCountLists(dropBody, "dropGoals"));

  const individual = subSection(wikitext, "Individual") || section(wikitext, "Individual");
  if (individual) collected.push(...parseIndividualRecords(individual));
  else collected.push(...parseIndividualRecords(wikitext));

  const entries = mergeEntries(collected).filter((e) => e.playerName.length > 1);
  if (!entries.length) notes.push("parsed zero player entries");

  return {
    year,
    sourceUrl,
    scrapedAt: new Date().toISOString(),
    entries,
    notes,
  };
}

async function main() {
  mkdirSync(ROOT, { recursive: true });
  const seasons = RUGBY_WORLD_CUP_CHAMPIONS.filter(
    (s) => s.startYear <= 2023 && s.wikipediaStatisticsUrl,
  )
    .filter((s) => !onlyYears?.length || onlyYears.includes(s.startYear))
    .map((s) => ({
      startYear: s.startYear,
      url: s.wikipediaStatisticsUrl ?? rugbyWorldCupWikipediaStatisticsUrl(s.startYear),
      title: `${s.startYear} Rugby World Cup statistics`,
    }));

  console.log(`Wikipedia RWC statistics (wikitext): ${seasons.map((s) => s.startYear).join(", ")}`);

  for (const [index, season] of seasons.entries()) {
    const outPath = join(ROOT, `${season.startYear}.json`);
    if (!force && existsSync(outPath)) {
      console.log(`  ${season.startYear}: skip existing`);
      continue;
    }
    if (index > 0) await sleep(delayMs);
    console.log(`→ ${season.startYear}`);
    try {
      const wt = await fetchWikitext(season.title);
      const parsed = parseYear(season.startYear, season.url, wt);
      writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`);
      const adv = parsed.entries.filter(
        (e) => e.tacklesCompleted || e.metresCarried || e.carries || e.lineBreaks,
      ).length;
      console.log(
        `  entries=${parsed.entries.length} withTries=${parsed.entries.filter((e) => e.tries).length} withPoints=${parsed.entries.filter((e) => e.points).length} advanced=${adv}`,
      );
      if (parsed.notes.length) console.log(`  notes: ${parsed.notes.join("; ")}`);
    } catch (error) {
      console.error(`  ! ${season.startYear}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
