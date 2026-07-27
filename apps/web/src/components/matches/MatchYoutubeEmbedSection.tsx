"use client";

import { youtubeEmbedSrc, youtubeWatchUrl } from "@/lib/youtube-embed";

type Props = {
  title: string;
  description: string;
  youtubeUrl: string | null | undefined;
  emptyMessage: string;
  /** Auto-start playback when the tab/section mounts (muted for browser policy). */
  autoplay?: boolean;
};

/** Public match tab: responsive YouTube embed for Watchalong / Highlights. */
export function MatchYoutubeEmbedSection({
  title,
  description,
  youtubeUrl,
  emptyMessage,
  autoplay = false,
}: Props) {
  const embedSrc = youtubeEmbedSrc(youtubeUrl, autoplay ? { autoplay: true } : undefined);
  const watchHref = youtubeWatchUrl(youtubeUrl);

  return (
    <section className="pr-yt" aria-label={title}>
      <header className="pr-yt__header">
        <h2 className="pr-yt__title">{title}</h2>
        <p className="pr-yt__desc">{description}</p>
      </header>

      {embedSrc ? (
        <div className="pr-yt__frame-wrap">
          <iframe
            key={embedSrc}
            className="pr-yt__frame"
            src={embedSrc}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="pr-yt__empty" role="status">
          {emptyMessage}
        </p>
      )}

      {watchHref ? (
        <p className="pr-yt__footer">
          <a href={watchHref} target="_blank" rel="noopener noreferrer" className="pr-yt__link">
            Open on YouTube
          </a>
        </p>
      ) : null}
    </section>
  );
}
