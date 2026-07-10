import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PlanetRugbyMatchPageAdapter,
  parsePlanetRugbyMatchUrl,
  buildPlanetRugbyMatchUrl,
  parsePlanetRugbyTournamentUrl,
} from "../../index";
import { parsePlanetRugbyMatchPageHtml } from "./parse-page";

const MATCH_URL =
  "https://www.planetrugby.com/matches/v907ry1j/premiership/m46vm6z5/northampton-saints-v-exeter-chiefs/2026-06-20";

const __dirname = dirname(fileURLToPath(import.meta.url));
const matchHtml = readFileSync(join(__dirname, "fixtures/northampton-exeter.html"), "utf8");
const fixturesHtml = readFileSync(join(__dirname, "fixtures/fixtures-page.html"), "utf8");

describe("parsePlanetRugbyMatchUrl", () => {
  it("extracts URL parts from match page", () => {
    const parts = parsePlanetRugbyMatchUrl(MATCH_URL);
    expect(parts).toEqual({
      match_external_id: "v907ry1j",
      competition_slug: "premiership",
      competition_external_id: "m46vm6z5",
      home_team: "northampton-saints",
      away_team: "exeter-chiefs",
      match_date: "2026-06-20",
    });
    expect(buildPlanetRugbyMatchUrl(parts)).toBe(MATCH_URL);
  });
});

describe("parsePlanetRugbyMatchPageHtml", () => {
  it("parses match title, competition, sections and links from page HTML", () => {
    const url = parsePlanetRugbyMatchUrl(MATCH_URL);
    const parsed = parsePlanetRugbyMatchPageHtml(matchHtml, MATCH_URL, url);

    expect(parsed.matchTitle).toContain("Northampton Saints");
    expect(parsed.matchTitle).toContain("Exeter Chiefs");
    expect(parsed.competition).toBe("Premiership");
    expect(parsed.homeTeamName).toBe("Northampton Saints");
    expect(parsed.awayTeamName).toBe("Exeter Chiefs");
    expect(parsed.sdmsMatchId).toBe("v907ry1j");
    expect(parsed.kickoffLabel).toMatch(/20 Jun 2026/);
    expect(parsed.sections.table.present).toBe(true);
    expect(parsed.sections.fixtures.present).toBe(true);
    expect(parsed.sections.results.present).toBe(true);
    expect(parsed.sections.table.competitionExternalId).toBe("m46vm6z5");
    expect(parsed.teamLinks.some((l) => l.kind === "team")).toBe(true);
    expect(parsed.competitionLinks.some((l) => l.kind === "competition")).toBe(true);
  });
});

describe("parsePlanetRugbyTournamentUrl", () => {
  it("parses internationals fixtures tournament URL", () => {
    const parsed = parsePlanetRugbyTournamentUrl(
      "https://www.planetrugby.com/tournament/international/fixtures",
    );
    expect(parsed).toEqual({ competitionSlug: "international", pageType: "fixtures" });
  });
});

describe("PlanetRugbyMatchPageAdapter", () => {
  const adapter = new PlanetRugbyMatchPageAdapter();

  it("adapts match page without live network when enrichSdms is false", async () => {
    const data = await adapter.adaptMatchPage(MATCH_URL, { html: matchHtml, enrichSdms: false });
    expect(data.provider).toBe("planet_rugby");
    expect(data.url.match_external_id).toBe("v907ry1j");
    expect(data.sections.table.widgetId).toBe("ps-table-league-lite");
  });

  it("adapts fixtures page from cached HTML", async () => {
    const data = await adapter.adaptFixturesPage("https://www.planetrugby.com/fixtures", {
      html: fixturesHtml,
    });
    expect(data.provider).toBe("planet_rugby");
    expect(data.sections[0]?.widgetId).toBe("ps-fixtures-league-all");
    expect(data.teamLinks.length).toBeGreaterThan(5);
  });
});
