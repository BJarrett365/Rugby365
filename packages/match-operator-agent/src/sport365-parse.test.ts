import { describe, expect, it } from "vitest";
import { parseSport365MatchSnapshotFromHtml } from "./sport365-parse";

describe("parseSport365MatchSnapshotFromHtml venue capacity", () => {
  it("extracts venue capacity from Sport365 __NEXT_DATA__", () => {
    const html = `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          match: {
            teams: [
              { pos: 0, name: "New Zealand", id: "1" },
              { pos: 1, name: "Italy", id: "2" },
            ],
            score: [0, 0],
            status: 1,
            status_txt: "NS",
            venue: { name: "Hnry Stadium", city: "Wellington", capacity: "34500" },
            incs: [],
          },
        },
      },
    })}</script></html>`;

    const snapshot = parseSport365MatchSnapshotFromHtml(
      html,
      "https://www.sport365.com/rugby-union/test/main/new-zealand-vs-italy/1-4308582",
    );

    expect(snapshot?.venue?.capacity).toBe(34500);
  });
});
