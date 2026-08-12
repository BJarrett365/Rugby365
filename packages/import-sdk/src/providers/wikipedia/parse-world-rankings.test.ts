import { describe, expect, it } from "vitest";
import { parseWikipediaWorldRankingsHtml } from "./parse-world-rankings";

const SAMPLE_HTML = `
<p>Rankings as of 20 July 2026.</p>
<table class="wikitable sortable">
<tr><th>Rank</th><th>Change</th><th>Team</th><th>Points</th></tr>
<tr><td>1</td><td></td><td>South Africa</td><td>93.96</td></tr>
<tr><td>2</td><td>▲ 1</td><td>New Zealand</td><td>92.28</td></tr>
<tr><td>3</td><td>▼ 1</td><td>Ireland</td><td>88.08</td></tr>
<tr><td>4</td><td></td><td>France</td><td>87.43</td></tr>
<tr><td>5</td><td></td><td>England</td><td>85.68</td></tr>
</table>
<table class="wikitable sortable">
<tr><th>Team</th><th colspan="2">Best</th><th colspan="2">Worst</th></tr>
<tr><th></th><th>Rank</th><th>Year(s)</th><th>Rank</th><th>Year(s)</th></tr>
<tr><td>Argentina</td><td>3</td><td>2007–08</td><td>12</td><td>2014</td></tr>
<tr><td>Australia</td><td>2</td><td>2003</td><td>10</td><td>2023</td></tr>
<tr><td>Canada</td><td>11</td><td>2011</td><td>25</td><td>2025</td></tr>
<tr><td>England</td><td>1</td><td>2003</td><td>8</td><td>2009</td></tr>
<tr><td>Fiji</td><td>7</td><td>2023</td><td>16</td><td>2011</td></tr>
<tr><td>France</td><td>1</td><td>2022</td><td>10</td><td>2018</td></tr>
</table>
<table class="wikitable sortable">
<tr><th>Team</th><th colspan="2">Most</th><th colspan="2">Least</th></tr>
<tr><th></th><th>Rating Points</th><th>Date Achieved</th><th>Rating Points</th><th>Date Achieved</th></tr>
<tr><td>Argentina</td><td>87.45</td><td>22 October 2007</td><td>73.97</td><td>23 June 2014</td></tr>
<tr><td>Australia</td><td>91.75</td><td>26 October 2015</td><td>76.50</td><td>25 September 2023</td></tr>
<tr><td>Canada</td><td>73.74</td><td>19 September 2011</td><td>57.75</td><td>21 July 2025</td></tr>
<tr><td>England</td><td>93.99</td><td>24 November 2003</td><td>77.79</td><td>17 September 2007</td></tr>
<tr><td>Fiji</td><td>81.16</td><td>2 October 2023</td><td>68.78</td><td>26 September 2011</td></tr>
<tr><td>France</td><td>90.59</td><td>11 September 2023</td><td>77.02</td><td>4 February 2019</td></tr>
</table>
<table class="wikitable sortable">
<tr><th>Team</th><th>Start date</th><th>End date</th><th>Weeks</th><th>Total Weeks</th></tr>
<tr><td>England</td><td>8 September 2003</td><td>10 November 2003</td><td>9</td><td>9</td></tr>
<tr><td>New Zealand</td><td>10 November 2003</td><td>17 November 2003</td><td>1</td><td>1</td></tr>
<tr><td>England (2)</td><td>17 November 2003</td><td>14 June 2004</td><td>30</td><td>39</td></tr>
<tr><td>South Africa</td><td>15 September 2025</td><td>Present</td><td>45</td><td>330</td></tr>
</table>
`;

describe("parseWikipediaWorldRankingsHtml", () => {
  it("parses current table, leaders, and milestones", () => {
    const parsed = parseWikipediaWorldRankingsHtml(SAMPLE_HTML, { category: "mru" });

    expect(parsed.asOfDate).toBe("2026-07-20");
    expect(parsed.currentTable).toHaveLength(5);
    expect(parsed.currentTable[0]).toMatchObject({
      position: 1,
      teamName: "South Africa",
      teamCode: "RSA",
      points: 93.96,
    });
    expect(parsed.currentTable[1].change).toBe(1);
    expect(parsed.currentTable[2].change).toBe(-1);

    expect(parsed.leaderSpans.length).toBeGreaterThanOrEqual(4);
    expect(parsed.leaderSpans[0]).toMatchObject({
      teamName: "England",
      startDate: "2003-09-08",
      endDate: "2003-11-10",
      weeks: 9,
    });
    expect(parsed.leaderSpans[2].reignIndex).toBe(2);
    expect(parsed.leaderSpans.at(-1)?.endDate).toBeNull();

    expect(parsed.rankMilestones[0]).toMatchObject({
      teamName: "Argentina",
      bestRank: 3,
      worstRank: 12,
    });
    expect(parsed.pointsMilestones[0]).toMatchObject({
      teamName: "Argentina",
      peakPoints: 87.45,
      peakDate: "2007-10-22",
      troughPoints: 73.97,
      troughDate: "2014-06-23",
    });
  });
});
