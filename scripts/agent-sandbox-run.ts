#!/usr/bin/env tsx
/**
 * Rugby Match Operator Agent — sandbox CLI
 * Usage: npm run agent:sandbox
 *        npm run agent:sandbox:live
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  runCycle,
  buildMatchReport,
  confirmFixture,
  type AgentMode,
  type MatchSnapshot,
} from "@rugby365/match-operator-agent";

const TEST_URL =
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const mode = (args.mode ?? "assisted") as AgentMode;
const pollInterval = Number(args["poll-interval"] ?? 0);
const once = args.once !== "false";
const useFixture = args.fixture !== "false";
const runId = randomUUID().slice(0, 8);
const outDir = join(process.cwd(), "output", "agent-sandbox", runId);
mkdirSync(outDir, { recursive: true });

let fixtureHtml: string | undefined;
if (useFixture) {
  fixtureHtml = readFileSync(
    join(process.cwd(), "packages/match-operator-agent/src/fixtures/sa-barb-sport365.html"),
    "utf8",
  );
}

console.log(`Rugby Match Operator Agent — sandbox run ${runId}`);
console.log(`Mode: ${mode} | fixture: ${useFixture}`);

let previousSnapshot: MatchSnapshot | null = null;
let pollNumber = 0;
const allEvents: Awaited<ReturnType<typeof runCycle>>["events"] = [];

async function doPoll() {
  pollNumber += 1;
  const cycle = await runCycle({
    sourceUrl: TEST_URL,
    mode,
    previousSnapshot,
    pollNumber,
    html: fixtureHtml,
  });

  previousSnapshot = cycle.snapshot;
  allEvents.push(...cycle.events);
  const fixture = confirmFixture(cycle.snapshot);

  const payload = {
    run_id: runId,
    poll_number: pollNumber,
    fixture,
    flags: cycle.flags,
    events: cycle.events,
    snapshot: {
      score: `${cycle.snapshot.homeScore}-${cycle.snapshot.awayScore}`,
      status: cycle.snapshot.statusLabel,
      incidents: cycle.snapshot.incidents.length,
    },
    polled_at: cycle.snapshot.polledAt,
  };

  const file = join(outDir, `poll-${String(pollNumber).padStart(3, "0")}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`Poll ${pollNumber}: ${cycle.events.length} events → ${file}`);

  for (const e of cycle.events.slice(0, 5)) {
    console.log(`  [${e.minute}' ${e.event_type}] ${e.team} (conf ${e.confidence})`);
    if (e.commentary_suggestions[0]) console.log(`    → ${e.commentary_suggestions[0]}`);
  }
  if (cycle.events.length > 5) console.log(`  … and ${cycle.events.length - 5} more`);

  return cycle;
}

async function main() {
  await doPoll();

  if (!once && pollInterval > 0) {
    console.log(`Polling every ${pollInterval}s (Ctrl+C to stop)`);
    setInterval(() => {
      doPoll().catch((e) => console.error(e));
    }, pollInterval * 1000);
  } else if (!once && previousSnapshot) {
    const partial: MatchSnapshot = {
      ...previousSnapshot,
      incidents: previousSnapshot.incidents.slice(0, 8),
      homeScore: 7,
      awayScore: 0,
    };
    previousSnapshot = partial;
    await doPoll();
  }

  if (previousSnapshot) {
    const report = buildMatchReport(previousSnapshot, allEvents, { mode, runId, pollCount: pollNumber });
    writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
    console.log(`Report: ${join(outDir, "report.json")} (${allEvents.length} total events)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
