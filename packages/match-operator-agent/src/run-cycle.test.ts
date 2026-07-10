import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AgentEventOutputSchema,
  diffMatchSnapshots,
  parseSport365MatchSnapshotFromHtml,
  runCycle,
} from "./index";

const FIXTURE_URL =
  "https://www.sport365.com/rugby-union/international/men/south-africa-vs-barbarians/1-4307586";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureHtml = readFileSync(join(__dirname, "fixtures/sa-barb-sport365.html"), "utf8");

describe("sport365 rugby parse", () => {
  it("parses SA vs Barbarians snapshot from cached HTML", () => {
    const snapshot = parseSport365MatchSnapshotFromHtml(fixtureHtml, FIXTURE_URL);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.matchId).toBe("1-4307586");
    expect(snapshot!.homeTeam).toBe("South Africa");
    expect(snapshot!.awayTeam).toBe("Barbarians");
    expect(snapshot!.homeScore).toBe(80);
    expect(snapshot!.awayScore).toBe(31);
    expect(snapshot!.statusLabel).toBe("full_time");
    expect(snapshot!.kickoffAt).toBe("2026-06-20T13:00:00.000Z");
    expect(snapshot!.competitionProviderId).toBe("3a53e4b3-f4f9-4715-9b52-8db7d4d130ba");
    expect(snapshot!.venue?.name).toBe("Nelson Mandela Bay Stadium");
    expect(snapshot!.incidents.length).toBeGreaterThan(10);
    expect(snapshot!.homeTeamProviderId).toBeTruthy();
    expect(snapshot!.awayTeamProviderId).toBeTruthy();
    expect(snapshot!.lineups?.home.starting.length).toBeGreaterThan(10);
    expect(snapshot!.lineups?.away.starting.length).toBeGreaterThan(10);
    const tryIncident = snapshot!.incidents.find((i) => i.type === 34 && i.minute === 4);
    expect(tryIncident?.playerProviderId).toBe("2-953899");
    expect(tryIncident?.playerName).toBe("Edwill van der Merwe");
  });
});

describe("event diff", () => {
  it("detects new try incident between snapshots", () => {
    const full = parseSport365MatchSnapshotFromHtml(fixtureHtml, FIXTURE_URL)!;
    const partial: typeof full = {
      ...full,
      homeScore: 7,
      awayScore: 0,
      incidents: full.incidents.filter((i) => i.minute <= 5),
    };
    const changes = diffMatchSnapshots(partial, full);
    const tries = changes.filter((c) => c.kind === "incident");
    expect(tries.length).toBeGreaterThan(0);
    expect(tries.some((c) => c.kind === "incident" && c.incident.type === 34)).toBe(true);
  });
});

describe("agent run cycle", () => {
  it("produces valid AgentEventOutput with commentary suggestions", async () => {
    const full = parseSport365MatchSnapshotFromHtml(fixtureHtml, FIXTURE_URL)!;
    const partial: typeof full = {
      ...full,
      homeScore: 7,
      awayScore: 0,
      incidents: full.incidents.filter((i) => i.minute <= 5),
    };

    const result = await runCycle({
      sourceUrl: FIXTURE_URL,
      mode: "assisted",
      previousSnapshot: partial,
      pollNumber: 2,
      html: fixtureHtml,
    });

    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      const parsed = AgentEventOutputSchema.parse(event);
      expect(parsed.match_id).toBe("1-4307586");
      expect(parsed.commentary_suggestions.length).toBeGreaterThan(0);
      if (parsed.event_type === "try") {
        expect(parsed.requires_approval).toBe(true);
      }
    }
  });

  it("flags high-risk try events for approval", async () => {
    const full = parseSport365MatchSnapshotFromHtml(fixtureHtml, FIXTURE_URL)!;
    const beforeTry = full.incidents.find((i) => i.type === 34 && i.minute === 4)!;
    const partial: typeof full = {
      ...full,
      homeScore: 0,
      awayScore: 0,
      incidents: full.incidents.filter((i) => i.id !== beforeTry.id),
    };

    const result = await runCycle({
      sourceUrl: FIXTURE_URL,
      mode: "assisted",
      previousSnapshot: partial,
      pollNumber: 1,
      html: fixtureHtml,
    });

    const tryEvent = result.events.find((e) => e.event_type === "try");
    expect(tryEvent).toBeDefined();
    expect(tryEvent!.requires_approval).toBe(true);
    expect(tryEvent!.confidence).toBeGreaterThan(0.5);
    expect(tryEvent!.facts.player).toBe("Edwill van der Merwe");
  });
});
