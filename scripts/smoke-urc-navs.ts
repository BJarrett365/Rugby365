/**
 * Smoke-test all URC competition nav APIs across historic + current seasons.
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/smoke-urc-navs.ts
 *   BASE_URL=http://localhost:8080 npx tsx ... scripts/smoke-urc-navs.ts
 */
const BASE = (process.env.BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
const SLUG = "united-rugby-championship";

const SEASONS = [
  "2001–02",
  "2011–12",
  "2017–18",
  "2021–22",
  "2023–24",
  "2025–26",
  "2026–27",
];

type Check = {
  nav: string;
  path: string;
  ok: boolean;
  status: number;
  detail: string;
  ms: number;
};

function encodeSeason(label: string) {
  return encodeURIComponent(label);
}

async function check(nav: string, path: string, inspect: (json: unknown) => string): Promise<Check> {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { accept: "application/json" },
    });
    const ms = Date.now() - started;
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      return {
        nav,
        path,
        ok: false,
        status: res.status,
        detail: `non-JSON (${text.slice(0, 120)})`,
        ms,
      };
    }
    if (!res.ok) {
      const err =
        json && typeof json === "object" && "error" in json
          ? String((json as { error: unknown }).error)
          : text.slice(0, 160);
      return { nav, path, ok: false, status: res.status, detail: err, ms };
    }
    return { nav, path, ok: true, status: res.status, detail: inspect(json), ms };
  } catch (error) {
    return {
      nav,
      path,
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message : String(error),
      ms: Date.now() - started,
    };
  }
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

async function seasonChecks(season: string): Promise<Check[]> {
  const q = `season=${encodeSeason(season)}`;
  return [
    await check("Fixtures/Results hub", `/api/competitions/by-slug/${SLUG}?${q}`, (json) => {
      const data = json as {
        fixtures?: unknown[];
        seasons?: unknown[];
        season?: { label?: string } | null;
      };
      return `season=${data.season?.label ?? "?"} fixtures=${countArray(data.fixtures)} seasons=${countArray(data.seasons)}`;
    }),
    await check("Table (standings)", `/api/competitions/by-slug/${SLUG}/standings?${q}&view=overall`, (json) => {
      const data = json as { standings?: unknown[]; seasons?: unknown[] };
      return `standings=${countArray(data.standings)} seasons=${countArray(data.seasons)}`;
    }),
    await check("Table (live)", `/api/competitions/by-slug/${SLUG}/live-table?${q}&view=overall`, (json) => {
      const data = json as { result?: { rows?: unknown[] }; standings?: unknown[]; rows?: unknown[] };
      const rows = countArray(data.result?.rows) || countArray(data.standings) || countArray(data.rows);
      return `rows=${rows}`;
    }),
    await check("Player stats", `/api/competitions/by-slug/${SLUG}/player-stats?${q}`, (json) => {
      const data = json as { rows?: unknown[]; players?: unknown[]; leaderboards?: unknown };
      const n =
        countArray(data.rows) ||
        countArray(data.players) ||
        (data.leaderboards && typeof data.leaderboards === "object"
          ? Object.keys(data.leaderboards as object).length
          : 0);
      return `entries=${n}`;
    }),
    await check("Team stats", `/api/competitions/by-slug/${SLUG}/team-stats?${q}`, (json) => {
      const data = json as { rows?: unknown[]; teams?: unknown[]; leaderboards?: unknown };
      const n =
        countArray(data.rows) ||
        countArray(data.teams) ||
        (data.leaderboards && typeof data.leaderboards === "object"
          ? Object.keys(data.leaderboards as object).length
          : 0);
      return `entries=${n}`;
    }),
    await check("Compare roster", `/api/competitions/by-slug/${SLUG}/compare-roster?${q}`, (json) => {
      const data = json as { teams?: unknown[]; players?: unknown[] };
      return `teams=${countArray(data.teams)} players=${countArray(data.players)}`;
    }),
    await check("Rankings", `/api/competitions/by-slug/${SLUG}/rankings?${q}`, (json) => {
      const data = json as { rows?: unknown[]; rankings?: unknown[]; players?: unknown[] };
      return `rows=${countArray(data.rows) || countArray(data.rankings) || countArray(data.players)}`;
    }),
  ];
}

async function pageChecks(season: string): Promise<Check[]> {
  const q = `?season=${encodeSeason(season)}`;
  const paths = [
    ["Fixtures page", `/competitions/${SLUG}/fixtures${q}`],
    ["Results page", `/competitions/${SLUG}/results${q}`],
    ["Table page", `/competitions/${SLUG}/table${q}`],
    ["Player stats page", `/competitions/${SLUG}/stats${q}`],
    ["Team stats page", `/competitions/${SLUG}/team-stats${q}`],
    ["Team of the Week page", `/competitions/${SLUG}/team-of-the-week`],
    ["Compare players page", `/competitions/${SLUG}/compare${q}`],
    ["Compare teams page", `/competitions/${SLUG}/compare-teams${q}`],
    ["Rankings page", `/competitions/${SLUG}/rankings${q}`],
  ] as const;

  const out: Check[] = [];
  for (const [nav, path] of paths) {
    const started = Date.now();
    try {
      const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
      const html = await res.text();
      const ms = Date.now() - started;
      const hasNav = html.includes("competition-nav") || html.includes("Player stats");
      const emptyish =
        /No published Team of the Week|No fixtures|No results|No standings|No data|failed to load/i.test(
          html,
        );
      out.push({
        nav,
        path,
        ok: res.ok,
        status: res.status,
        detail: `html=${html.length}b nav=${hasNav ? "yes" : "no"}${emptyish ? " empty-ish" : ""}`,
        ms,
      });
    } catch (error) {
      out.push({
        nav,
        path,
        ok: false,
        status: 0,
        detail: error instanceof Error ? error.message : String(error),
        ms: Date.now() - started,
      });
    }
  }
  return out;
}

async function main() {
  console.log(`=== URC nav smoke @ ${BASE} ===\n`);
  const all: Check[] = [];

  for (const season of SEASONS) {
    console.log(`--- ${season} ---`);
    const checks = await seasonChecks(season);
    for (const c of checks) {
      all.push(c);
      console.log(`  ${c.ok ? "✓" : "✗"} ${c.nav} [${c.status} ${c.ms}ms] ${c.detail}`);
    }
  }

  console.log("\n--- Page renders (2025–26) ---");
  const pages = await pageChecks("2025–26");
  for (const c of pages) {
    all.push(c);
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.nav} [${c.status} ${c.ms}ms] ${c.detail}`);
  }

  console.log("\n--- Page renders (2001–02 historic) ---");
  const historicPages = await pageChecks("2001–02");
  for (const c of historicPages) {
    all.push(c);
    console.log(`  ${c.ok ? "✓" : "✗"} ${c.nav} [${c.status} ${c.ms}ms] ${c.detail}`);
  }

  const failed = all.filter((c) => !c.ok);
  console.log(`\nDone. ${all.length - failed.length}/${all.length} ok`);
  if (failed.length) {
    console.log("Failures:");
    for (const f of failed) console.log(`  - ${f.nav}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
