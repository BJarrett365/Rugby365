import { describe, expect, it } from "vitest";
import { extractYoutubeVideoId, youtubeEmbedSrc } from "./youtube-embed";

describe("extractYoutubeVideoId", () => {
  it("parses watch, embed, short, and iframe paste", () => {
    expect(extractYoutubeVideoId("AhI9_TiQ5cM")).toBe("AhI9_TiQ5cM");
    expect(
      extractYoutubeVideoId("https://www.youtube.com/watch?v=AhI9_TiQ5cM&t=12"),
    ).toBe("AhI9_TiQ5cM");
    expect(
      extractYoutubeVideoId("https://www.youtube.com/embed/AhI9_TiQ5cM?si=HSm0Fz_g5Fxc1xHR"),
    ).toBe("AhI9_TiQ5cM");
    expect(extractYoutubeVideoId("https://youtu.be/AhI9_TiQ5cM")).toBe("AhI9_TiQ5cM");
    expect(
      extractYoutubeVideoId(
        `<iframe width="560" height="315" src="https://www.youtube.com/embed/AhI9_TiQ5cM?si=HSm0Fz_g5Fxc1xHR" title="YouTube video player"></iframe>`,
      ),
    ).toBe("AhI9_TiQ5cM");
  });

  it("rejects non-youtube input", () => {
    expect(extractYoutubeVideoId("https://vimeo.com/123")).toBeNull();
    expect(youtubeEmbedSrc("")).toBeNull();
  });

  it("adds muted autoplay params when requested", () => {
    expect(youtubeEmbedSrc("AhI9_TiQ5cM")).toBe(
      "https://www.youtube.com/embed/AhI9_TiQ5cM",
    );
    expect(youtubeEmbedSrc("AhI9_TiQ5cM", { autoplay: true })).toBe(
      "https://www.youtube.com/embed/AhI9_TiQ5cM?autoplay=1&mute=1&playsinline=1",
    );
  });

  it("parses highlights iframe paste independently of watchalong ids", () => {
    const iframe = `<iframe width="560" height="315" src="https://www.youtube.com/embed/gwRonbtu-tA?si=eO2z_G0kCctRCzKA" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`;
    expect(extractYoutubeVideoId(iframe)).toBe("gwRonbtu-tA");
    expect(youtubeEmbedSrc(iframe)).toBe("https://www.youtube.com/embed/gwRonbtu-tA");
  });
});
