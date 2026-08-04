/**
 * YouTube channels that publish full-match highlight packages for competitions we cover.
 * Add more leagues here as channels are confirmed (Currie Cup, Premiership, etc.).
 */

export type YoutubeHighlightsChannel = {
  key: string;
  label: string;
  handle: string;
  channelId: string;
  /** Competition slugs in CMS (first match wins). */
  competitionSlugs: string[];
  /** Optional extra title filter (case-insensitive substring). */
  titleIncludes?: string[];
};

export const YOUTUBE_HIGHLIGHTS_CHANNELS: YoutubeHighlightsChannel[] = [
  {
    key: "npc",
    label: "Hilux NPC",
    handle: "@NZProvincialRugby",
    channelId: "UCK442Bjxkx0skmxEDi2BtSg",
    competitionSlugs: ["npc-n0628z68", "npc"],
    titleIncludes: ["npc"],
  },
  {
    key: "currie-cup",
    label: "Currie Cup",
    handle: "@RugbyMzansi",
    channelId: "UCdO4qwreCf8I0BOaikCv_2g",
    competitionSlugs: ["currie-cup-pd9ro98v", "currie-cup"],
    titleIncludes: ["currie cup"],
  },
];

export function getYoutubeHighlightsChannel(
  key: string,
): YoutubeHighlightsChannel | undefined {
  return YOUTUBE_HIGHLIGHTS_CHANNELS.find((c) => c.key === key);
}
