import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildStadiumCapacityListIndex,
  matchVenueToStadiumCapacityRow,
  parseWikipediaStadiumCapacityListHtml,
} from "./parse-stadium-capacity-list";

const fixtureHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "fixtures/stadium-capacity-list.html"),
  "utf8",
);

describe("parseWikipediaStadiumCapacityListHtml", () => {
  it("parses current stadium rows with capacity and city", () => {
    const rows = parseWikipediaStadiumCapacityListHtml(fixtureHtml);
    expect(rows.length).toBeGreaterThan(70);

    const twickenham = rows.find((row) => row.name === "Twickenham Stadium");
    expect(twickenham).toMatchObject({
      capacity: 82000,
      city: "London",
      country: "England",
      wikipediaTitle: "Twickenham Stadium",
      section: "current",
    });

    const murrayfield = rows.find((row) => row.name === "Murrayfield Stadium");
    expect(murrayfield).toMatchObject({
      capacity: 67144,
      city: "Edinburgh",
      section: "current",
    });
  });
});

describe("matchVenueToStadiumCapacityRow", () => {
  const index = buildStadiumCapacityListIndex(parseWikipediaStadiumCapacityListHtml(fixtureHtml));

  it("matches sponsor and shorthand venue names", () => {
    expect(matchVenueToStadiumCapacityRow("BT Murrayfield", index)?.row.name).toBe("Murrayfield Stadium");
    expect(matchVenueToStadiumCapacityRow("Affidea Stadium", index)?.row.capacity).toBe(18196);
    expect(matchVenueToStadiumCapacityRow("Ravenhill Stadium", index)?.row.capacity).toBe(18196);
  });

  it("does not over-match unrelated park venues", () => {
    expect(matchVenueToStadiumCapacityRow("Castle Park", index)).toBeNull();
    expect(matchVenueToStadiumCapacityRow("Athletic Ground", index)).toBeNull();
  });
});
