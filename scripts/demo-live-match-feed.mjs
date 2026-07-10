#!/usr/bin/env node
/**
 * Rugby365 demo match feed — replays SA vs Barbarians events.
 * Usage: npm run demo:feed [--speed=2000] [--base=http://localhost:3000]
 */

const FIXTURE_ID = "c0000000-0000-4000-8000-000000000001";
const TEAM_SA = "b0000000-0000-4000-8000-000000000001";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const base = args.base ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const delayMs = Number(args.speed ?? 2000);

const events = [
  { eventType: "kickoff", minute: 0, second: 0, payload: {} },
  { eventType: "carry", minute: 5, second: 0, payload: { zone: "midfield" } },
  { eventType: "phase_milestone", minute: 12, second: 0, payload: { zone: "midfield", phase: 3 } },
  { eventType: "lineout", minute: 18, second: 0, payload: { zone: "opposition_22" } },
  {
    eventType: "phase_milestone",
    minute: 23,
    second: 0,
    payload: { zone: "opposition_22", phase: 7, possession_retained: true },
  },
  { eventType: "try", minute: 24, second: 10, payload: { zone: "opposition_22", phase: 8 } },
  { eventType: "penalty", minute: 31, second: 0, payload: { infringement: "offside" } },
  { eventType: "scrum", minute: 38, second: 0, payload: {} },
];

async function postEvent(ev) {
  const res = await fetch(`${base}/api/fixtures/${FIXTURE_ID}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...ev, teamId: TEAM_SA }),
  });
  if (!res.ok) {
    console.error("Failed:", ev.eventType, await res.text());
    return;
  }
  const data = await res.json();
  console.log(`[${ev.minute}'] ${ev.eventType}`, data.suggestion ? "→ suggestions created" : "");
}

async function main() {
  console.log(`Rugby365 demo feed → ${base} (delay ${delayMs}ms)`);
  for (const ev of events) {
    await postEvent(ev);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  console.log("Demo feed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
