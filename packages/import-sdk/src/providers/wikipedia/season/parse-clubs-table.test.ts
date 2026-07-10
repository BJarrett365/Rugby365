import { describe, expect, it } from "vitest";
import { parseClubsTableFromWikitext } from "./parse-clubs-table";

const SAMPLE_2024_25 = `
{| class="wikitable sortable"
|-
!| Club
!| Director of Rugby/Head Coach
!| Captain
!| Stadium
!| Capacity
!| City/Area
|-
| [[Bath Rugby|Bath]]
| [[Johann van Graan]]
| [[Fergus MacLeod]]
| [[Recreation Ground (Bath)|Recreation Ground]]
| 10,500
| [[Bath, Somerset|Bath]], [[Somerset]]
|-
| [[Bristol Bears|Bristol]]
| [[Pat Lam]]
| [[Ellis Genge]]
| [[Ashton Gate (stadium)|Ashton Gate]]
| 27,000
| [[Bristol]]
|}
`;

const SAMPLE_2008_09 = `
{| class="wikitable sortable"
|-
!| Club
!| Stadium
!| Capacity
!| City/Area
|-
| [[Bath Rugby|Bath]]
| [[Recreation Ground (Bath)|Recreation Ground]]
| 10,600
| [[Bath, Somerset|Bath]], [[Somerset]]
|-
| [[Wasps RFC|London Wasps]]
| [[Adams Park]]
| 10,000
| [[High Wycombe]], [[Buckinghamshire]]
|}
`;

describe("parseClubsTableFromWikitext", () => {
  it("parses modern coach/captain/stadium table", () => {
    const rows = parseClubsTableFromWikitext(SAMPLE_2024_25);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      clubName: "Bath",
      headCoach: "Johann van Graan",
      captain: "Fergus MacLeod",
      stadium: "Recreation Ground",
      capacity: 10500,
      cityArea: "Bath Somerset",
    });
    expect(rows[1]?.captain).toBe("Ellis Genge");
  });

  it("parses legacy stadium-only table", () => {
    const rows = parseClubsTableFromWikitext(SAMPLE_2008_09);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      clubName: "Bath",
      headCoach: null,
      captain: null,
      stadium: "Recreation Ground",
      capacity: 10600,
    });
    expect(rows[1]?.clubName).toBe("London Wasps");
  });
});
