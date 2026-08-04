import type {
  YoutubeChannelFeedPreview,
  YoutubeFeedVideo,
  YoutubeHighlightListing,
  YoutubeHighlightMatchTitle,
} from "./types";

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2019;/gi, "'")
    .replace(/&#8217;/g, "'")
    .trim();
}

/** Normalize YouTube title team labels (unicode apostrophes / macrons). */
export function normalizeYoutubeTeamLabel(name: string): string {
  return decodeXml(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Straight + curly / typographic apostrophes → ASCII '
    .replace(/[\u2018\u2019\u201A\u2032`´']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip sponsor prefixes from YouTube titles only (never mutates CMS team names).
 * e.g. "Fidelity ADT Lions" → "Lions", "Sanlam Boland Kavaliers" → "Boland Kavaliers"
 */
export function stripYoutubeTeamSponsors(name: string): string {
  let next = normalizeYoutubeTeamLabel(name);
  const sponsor =
    /^(fidelity|adt|sanlam|suzuki|hollywoodbets|toyota|vodacom|dhl|cell\s*c|airlink|emirates|mtn|investec|sasol)\s+/i;
  for (let i = 0; i < 5; i++) {
    const stripped = next.replace(sponsor, "").trim();
    if (stripped === next) break;
    next = stripped;
  }
  // Common spelling variant on Mzansi titles
  next = next.replace(/\bkavaliers\b/gi, "Cavaliers");
  return next.trim();
}

function extractRoundNumber(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const m = text.match(/\b(?:rd|round)\s*(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse highlight titles from NPC / Currie Cup style channels.
 *
 * NPC: `RD 1 HIGHLIGHTS: Wellington v Hawke's Bay (Hilux NPC 2026)`
 * Currie Cup: `Fidelity ADT Lions vs Vodacom Bulls | Full Match Highlights | Currie Cup Round 3`
 */
export function parseYoutubeHighlightMatchTitle(
  title: string,
): YoutubeHighlightMatchTitle | null {
  const raw = decodeXml(title);
  if (!/highlights/i.test(raw)) return null;

  // Pipe format — Rugby Mzansi / similar
  const pipe = raw.match(
    /^(.+?)\s+vs?\.?\s+(.+?)\s*\|\s*(?:Full\s+)?Match\s+Highlights\s*\|\s*(.+?)\s*$/i,
  );
  if (pipe) {
    const homeName = stripYoutubeTeamSponsors(pipe[1] ?? "");
    const awayName = stripYoutubeTeamSponsors(pipe[2] ?? "");
    const competitionHint = decodeXml(pipe[3] ?? "").trim() || null;
    if (!homeName || !awayName) return null;
    const roundNumber = extractRoundNumber(competitionHint);
    return {
      homeName,
      awayName,
      competitionHint,
      roundHint: roundNumber != null ? `Round ${roundNumber}` : null,
      roundNumber,
    };
  }

  // Colon format — NZ Provincial Rugby
  const colon = raw.match(
    /(?:RD\s*(\d+)\s+)?HIGHLIGHTS:\s*(.+?)\s+v(?:s\.?)?\s+(.+?)(?:\s*\(([^)]*)\))?\s*$/i,
  );
  if (!colon) return null;

  const homeName = stripYoutubeTeamSponsors(colon[2] ?? "");
  const awayName = stripYoutubeTeamSponsors(colon[3] ?? "");
  if (!homeName || !awayName) return null;
  const roundFromPrefix = colon[1] ? Number(colon[1]) : null;
  const competitionHint = colon[4] ? decodeXml(colon[4]).trim() : null;
  const roundNumber =
    (Number.isFinite(roundFromPrefix) ? roundFromPrefix : null) ??
    extractRoundNumber(competitionHint);

  return {
    homeName,
    awayName,
    competitionHint,
    roundHint: roundNumber != null ? `Round ${roundNumber}` : colon[1] ? `RD ${colon[1]}` : null,
    roundNumber,
  };
}

export function parseYoutubeAtomFeed(
  xml: string,
  channelId: string,
): YoutubeFeedVideo[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
  const out: YoutubeFeedVideo[] = [];
  const seen = new Set<string>();

  for (const entryMatch of entries) {
    const body = entryMatch[1] ?? "";
    const videoId =
      body.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i)?.[1]?.trim() ??
      body.match(/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1] ??
      null;
    if (!videoId || seen.has(videoId)) continue;
    const titleRaw = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const title = decodeXml(titleRaw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
    const publishedAt =
      body.match(/<published>([^<]+)<\/published>/i)?.[1]?.trim() ??
      body.match(/<updated>([^<]+)<\/updated>/i)?.[1]?.trim() ??
      "";
    seen.add(videoId);
    out.push({
      videoId,
      title,
      publishedAt,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      channelId,
    });
  }

  return out;
}

export function toYoutubeHighlightListings(
  videos: YoutubeFeedVideo[],
): YoutubeHighlightListing[] {
  return videos.map((video) => ({
    ...video,
    match: parseYoutubeHighlightMatchTitle(video.title),
  }));
}

export function parseYoutubeChannelFeedXml(
  xml: string,
  channelId: string,
): YoutubeChannelFeedPreview {
  const sourceUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const videos = parseYoutubeAtomFeed(xml, channelId);
  return {
    kind: "youtube_channel_feed",
    channelId,
    sourceUrl,
    videos,
    highlightListings: toYoutubeHighlightListings(videos).filter((v) => v.match),
  };
}
