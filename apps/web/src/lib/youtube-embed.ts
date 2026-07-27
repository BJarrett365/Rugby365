/** Parse YouTube watch URLs, embed URLs, video ids, or iframe HTML into a safe embed src. */

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function extractYoutubeVideoId(raw: string | null | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;

  // Bare 11-char id
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  // iframe paste
  const iframeSrc = input.match(/src=["']([^"']+)["']/i)?.[1];
  const candidate = iframeSrc ?? input;

  try {
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase();
    if (!YT_HOSTS.has(host)) return null;

    if (host === "youtu.be" || host === "www.youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    const embedIdx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
    if (embedIdx >= 0) {
      const id = parts[embedIdx + 1] ?? "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

export type YoutubeEmbedOptions = {
  /** Start playback when the iframe loads. Browsers require mute for this. */
  autoplay?: boolean;
  /** Defaults to true when autoplay is on (autoplay policy). */
  mute?: boolean;
};

export function youtubeEmbedSrc(
  raw: string | null | undefined,
  opts?: YoutubeEmbedOptions,
): string | null {
  const id = extractYoutubeVideoId(raw);
  if (!id) return null;
  const params = new URLSearchParams();
  if (opts?.autoplay) {
    params.set("autoplay", "1");
    params.set("mute", opts.mute === false ? "0" : "1");
    params.set("playsinline", "1");
  }
  const qs = params.toString();
  return qs
    ? `https://www.youtube.com/embed/${id}?${qs}`
    : `https://www.youtube.com/embed/${id}`;
}

export function youtubeWatchUrl(raw: string | null | undefined): string | null {
  const id = extractYoutubeVideoId(raw);
  if (!id) return null;
  return `https://www.youtube.com/watch?v=${id}`;
}
