import { describe, expect, it } from "vitest";
import {
  normalizeYoutubeTeamLabel,
  parseYoutubeAtomFeed,
  parseYoutubeChannelFeedXml,
  parseYoutubeHighlightMatchTitle,
  stripYoutubeTeamSponsors,
} from "./parse-channel-feed";

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>41YnIcjTHqc</yt:videoId>
    <title>RD 1 HIGHLIGHTS: Wellington v Hawke’s Bay (Hilux NPC 2026)</title>
    <published>2026-08-02T10:00:00+00:00</published>
  </entry>
  <entry>
    <yt:videoId>9LYPIAcOTuA</yt:videoId>
    <title>Fidelity ADT Lions vs Vodacom Bulls | Full Match Highlights | Currie Cup Round 3</title>
    <published>2026-08-01T10:00:00+00:00</published>
  </entry>
  <entry>
    <yt:videoId>zZdB8cvfp4A</yt:videoId>
    <title>This Is Why Lucas Casey Is One to Watch</title>
    <published>2026-08-02T08:00:00+00:00</published>
  </entry>
</feed>
`;

describe("parseYoutubeHighlightMatchTitle", () => {
  it("parses NPC highlight titles", () => {
    expect(
      parseYoutubeHighlightMatchTitle(
        "RD 1 HIGHLIGHTS: Wellington v Hawke’s Bay (Hilux NPC 2026)",
      ),
    ).toEqual({
      homeName: "Wellington",
      awayName: "Hawke's Bay",
      competitionHint: "Hilux NPC 2026",
      roundHint: "Round 1",
      roundNumber: 1,
    });
  });

  it("parses Currie Cup pipe titles and strips sponsors", () => {
    expect(
      parseYoutubeHighlightMatchTitle(
        "Fidelity ADT Lions vs Vodacom Bulls | Full Match Highlights | Currie Cup Round 3",
      ),
    ).toEqual({
      homeName: "Lions",
      awayName: "Bulls",
      competitionHint: "Currie Cup Round 3",
      roundHint: "Round 3",
      roundNumber: 3,
    });
  });

  it("normalises Kavaliers and Boland sponsors", () => {
    expect(
      parseYoutubeHighlightMatchTitle(
        "Sanlam Boland Kavaliers vs DHL Stormers | Full Match Highlights | Currie Cup Round 2",
      ),
    ).toMatchObject({
      homeName: "Boland Cavaliers",
      awayName: "Stormers",
      roundNumber: 2,
    });
  });

  it("normalizes macrons in team names", () => {
    expect(normalizeYoutubeTeamLabel("Manawatū")).toBe("Manawatu");
    expect(stripYoutubeTeamSponsors("Toyota Cheetahs")).toBe("Cheetahs");
  });

  it("ignores non-highlight clips", () => {
    expect(parseYoutubeHighlightMatchTitle("This Is Why Lucas Casey Is One to Watch")).toBeNull();
  });
});

describe("parseYoutubeChannelFeedXml", () => {
  it("extracts videos and highlight listings only", () => {
    const preview = parseYoutubeChannelFeedXml(SAMPLE_FEED, "UCK442Bjxkx0skmxEDi2BtSg");
    expect(parseYoutubeAtomFeed(SAMPLE_FEED, "UCK442Bjxkx0skmxEDi2BtSg")).toHaveLength(3);
    expect(preview.highlightListings).toHaveLength(2);
    expect(preview.highlightListings[0]).toMatchObject({
      videoId: "41YnIcjTHqc",
      watchUrl: "https://www.youtube.com/watch?v=41YnIcjTHqc",
      match: { homeName: "Wellington", awayName: "Hawke's Bay", roundNumber: 1 },
    });
    expect(preview.highlightListings[1]).toMatchObject({
      videoId: "9LYPIAcOTuA",
      match: { homeName: "Lions", awayName: "Bulls", roundNumber: 3 },
    });
  });
});
