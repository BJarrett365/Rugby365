import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  flattenRugbyDataLeagueMatches,
  flattenRugbyDataLeagueTable,
  flattenRugbyDataLeagueTeams,
  parseRugbyDataPlayerStats,
  parseRugbyDataTeamStats,
} from "./rugby-data-import-utils";

const samplesDir = path.resolve(__dirname, "../../../../docs/rugby-data-api/samples");

function loadSample<T = unknown>(filename: string): T {
  const raw = JSON.parse(readFileSync(path.join(samplesDir, filename), "utf8")) as {
    response?: { data?: T };
  };
  return raw.response?.data as T;
}

describe("rugby-data-import-utils mappers", () => {
  it("flattens league matches from sample", () => {
    const data = loadSample("league_104_prem_rugby_matches.json");
    const matches = flattenRugbyDataLeagueMatches(data, { id: 104, name: "PREM Rugby" });
    expect(matches.length).toBeGreaterThan(10);
    expect(matches[0]?.competitors?.htn).toBeTruthy();
    expect(matches[0]?.leagueId).toBeTruthy();
  });

  it("flattens league teams from sample", () => {
    const data = loadSample("league_104_prem_rugby_teams.json");
    const teams = flattenRugbyDataLeagueTeams(data);
    expect(teams).toHaveLength(10);
    expect(teams.map((team) => team.name)).toContain("Bath");
  });

  it("flattens league table from sample", () => {
    const data = loadSample("league_104_prem_rugby_table.json");
    const rows = flattenRugbyDataLeagueTable(data);
    expect(rows.length).toBeGreaterThan(5);
    expect(rows[0]?.rank).toBeGreaterThan(0);
    expect(rows[0]?.points).toBeGreaterThan(0);
  });

  it("parses team stats from sample", () => {
    const data = loadSample("prem_rugby_match_5370_stat.json");
    const parsed = parseRugbyDataTeamStats(data);
    expect(parsed.home.tries).toBe(4);
    expect(parsed.away.tries).toBe(3);
    expect(parsed.home.metres).toBeGreaterThan(0);
    expect(parsed.away.metres).toBeGreaterThan(0);
  });

  it("parses player stats from sample", () => {
    const data = loadSample("prem_rugby_match_5370_player_stat.json");
    const players = parseRugbyDataPlayerStats(data);
    expect(players.length).toBeGreaterThan(20);
    const oconnor = players.find((row) => row.playerName.includes("O'Connor"));
    expect(oconnor?.stats.Goals).toBe(3);
  });
});

describe("league 104 integration (mapper-level)", () => {
  it("maps a full league 104 fixture block without API calls", () => {
    const matches = flattenRugbyDataLeagueMatches(
      loadSample("league_104_prem_rugby_matches.json"),
      { id: 104, name: "PREM Rugby", season: "2025/26" },
    );
    const finished = matches.filter((match) => match.st === "Finished");
    expect(finished.length).toBeGreaterThan(0);
    expect(finished.every((match) => match.competitors?.htid && match.competitors?.atid)).toBe(true);
  });
});
