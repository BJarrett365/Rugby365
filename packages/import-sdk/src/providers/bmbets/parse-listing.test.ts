import { describe, expect, it } from "vitest";
import {
  classifyBmbetsLeagueContamination,
  isBmbetsLeaguePath,
  parseBmbetsUrl,
} from "./parse-url";
import { parseBmbetsKickoffIso, parseBmbetsListingHtml } from "./parse-listing";

const SAMPLE_LISTING = `
<html><title>New Zealand. NPC</title>
<div class="page-header"><h1>NPC</h1></div>
<table class="table"><tbody class="main-table">
<tr class="match-info"><td colspan="2">Friday, July 31, 2026</td>
<td class="odds-name">1</td><td class="odds-name">X</td><td class="odds-name">2</td></tr>
<tr class="main-table-row">
  <td class="date-col"><div class="hour">07:10</div></td>
  <td class="players-name-col">
    <div class="player-1"><a href="/rugby-union/new-zealand/npc/tasman-v-north-harbour-9682676/">Tasman</a></div>
    <div class="player-2"><a href="/rugby-union/new-zealand/npc/tasman-v-north-harbour-9682676/">North Harbour</a></div>
  </td>
  <td class='odds-col4'><span class="mobile-bet-type">1</span>1.10</td>
  <td class='odds-col4'><span class="mobile-bet-type">X</span>51.00</td>
  <td class='odds-col4'><span class="mobile-bet-type">2</span>12.00</td>
  <td class='bk-count odds-col4'><span class="badge badge-primary">22</span></td>
</tr>
<tr class="match-info"><td colspan="2">Friday, July 31, 2026</td></tr>
<tr class="main-table-row">
  <td class="date-col"><div class="hour">20:00</div></td>
  <td class="players-name-col">
    <div class="player-1"><a href="/rugby-union/europe/super-league/hull-kingston-rovers-v-bradford-bulls-9683322/">Hull Kingston Rovers</a></div>
    <div class="player-2"><a href="/rugby-union/europe/super-league/hull-kingston-rovers-v-bradford-bulls-9683322/">Bradford Bulls</a></div>
  </td>
  <td class='odds-col4'><span class="mobile-bet-type">1</span>1.01</td>
  <td class='odds-col4'><span class="mobile-bet-type">X</span>101.00</td>
  <td class='odds-col4'><span class="mobile-bet-type">2</span>36.00</td>
  <td class='bk-count odds-col4'><span class="badge badge-primary">6</span></td>
</tr>
</tbody></table></html>
`;

describe("bmbets parse-url", () => {
  it("accepts rugby-union competition and match URLs", () => {
    const comp = parseBmbetsUrl("https://www.bmbets.com/rugby-union/new-zealand/npc/");
    expect(comp.kind).toBe("competition");
    expect(comp.competitionSlug).toBe("npc");

    const match = parseBmbetsUrl(
      "https://www.bmbets.com/rugby-union/new-zealand/npc/tasman-v-north-harbour-9682676/",
    );
    expect(match.kind).toBe("match");
    expect(match.eventId).toBe("9682676");
    expect(match.homeNameHint).toContain("Tasman");
  });

  it("rejects rugby-league URLs", () => {
    expect(() => parseBmbetsUrl("https://www.bmbets.com/matches/rugby-league/")).toThrow(
      /Rugby League/i,
    );
  });

  it("flags mislabelled Super League under union", () => {
    expect(isBmbetsLeaguePath("/rugby-union/europe/super-league/")).toBe(true);
    const hit = classifyBmbetsLeagueContamination({
      sourceUrl:
        "https://www.bmbets.com/rugby-union/europe/super-league/hull-kingston-rovers-v-bradford-bulls-9683322/",
      competitionName: "Super League",
      homeName: "Hull Kingston Rovers",
      awayName: "Bradford Bulls",
    });
    expect(hit.rejectedAsLeague).toBe(true);
  });
});

const MULTI_ROW_NPC = `
<html><title>New Zealand. NPC</title>
<div class="page-header"><h1>NPC</h1></div>
<table class="table"><tbody class="main-table">
<tr class="match-info"><td colspan="2">Friday, July 31, 2026</td>
<td class="odds-name">1</td><td class="odds-name">X</td><td class="odds-name">2</td></tr>
<tr class="main-table-row">
  <td class="date-col"><div class="hour">07:10</div></td>
  <td class="players-name-col">
    <div class="player-1"><a href="/rugby-union/new-zealand/npc/tasman-v-north-harbour-9682676/">Tasman</a></div>
    <div class="player-2"><a href="/rugby-union/new-zealand/npc/tasman-v-north-harbour-9682676/">North Harbour</a></div>
  </td>
  <td class='odds-col4'><span class="mobile-bet-type">1</span>1.10</td>
  <td class='odds-col4'><span class="mobile-bet-type">X</span>51.00</td>
  <td class='odds-col4'><span class="mobile-bet-type">2</span>12.00</td>
  <td class='bk-count odds-col4'><span class="badge badge-primary">22</span></td>
</tr>
<tr class="match-info"><td colspan="2">Saturday, August 1, 2026</td></tr>
<tr class="main-table-row">
  <td class="date-col"><div class="hour">02:05</div></td>
  <td class="players-name-col">
    <div class="player-1"><a href="/rugby-union/new-zealand/npc/counties-manukau-v-taranaki-9682677/">Counties Manukau</a></div>
    <div class="player-2"><a href="/rugby-union/new-zealand/npc/counties-manukau-v-taranaki-9682677/">Taranaki</a></div>
  </td>
  <td class='odds-col4'><span class="mobile-bet-type">1</span>2.20</td>
  <td class='odds-col4'><span class="mobile-bet-type">X</span>21.00</td>
  <td class='odds-col4'><span class="mobile-bet-type">2</span>1.65</td>
  <td class='bk-count odds-col4'><span class="badge badge-primary">18</span></td>
</tr>
</tbody></table></html>
`;

describe("bmbets parse-listing", () => {
  it("keeps NPC union rows and rejects Super League", () => {
    const preview = parseBmbetsListingHtml(
      SAMPLE_LISTING,
      "https://www.bmbets.com/rugby-union/new-zealand/npc/",
    );
    expect(preview.matches).toHaveLength(2);
    expect(preview.unionMatches).toHaveLength(1);
    expect(preview.rejectedLeagueMatches).toHaveLength(1);
    expect(preview.unionMatches[0]!.homeName).toBe("Tasman");
    expect(preview.unionMatches[0]!.bestHomeDecimal).toBe(1.1);
    expect(preview.unionMatches[0]!.bookmakerCount).toBe(22);
    expect(preview.rejectedLeagueMatches[0]!.homeName).toContain("Hull");
  });

  it("keeps page competition name on later rows (not previous away team)", () => {
    const preview = parseBmbetsListingHtml(
      MULTI_ROW_NPC,
      "https://www.bmbets.com/rugby-union/new-zealand/npc/",
    );
    expect(preview.unionMatches).toHaveLength(2);
    expect(preview.unionMatches.map((m) => m.competitionName)).toEqual(["NPC", "NPC"]);
    expect(preview.unionMatches[1]!.homeName).toBe("Counties Manukau");
  });

  it("parses kickoff iso from day + time", () => {
    const iso = parseBmbetsKickoffIso("Friday, July 31, 2026", "07:10");
    expect(iso).toContain("2026-07-31");
  });
});
