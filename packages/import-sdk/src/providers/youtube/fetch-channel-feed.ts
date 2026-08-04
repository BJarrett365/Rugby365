import { parseYoutubeChannelFeedXml } from "./parse-channel-feed";
import type { YoutubeChannelFeedPreview } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function youtubeChannelFeedUrl(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
}

export async function fetchYoutubeChannelFeedXml(channelId: string): Promise<string> {
  const url = youtubeChannelFeedUrl(channelId);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
      redirect: "follow",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`YouTube feed HTTP ${res.status} for channel ${channelId}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function previewYoutubeChannelFeed(
  channelId: string,
  options: { xml?: string } = {},
): Promise<YoutubeChannelFeedPreview> {
  const xml = options.xml?.trim()
    ? options.xml
    : await fetchYoutubeChannelFeedXml(channelId);
  return parseYoutubeChannelFeedXml(xml, channelId);
}
