"use client";

import { MediaImage } from "@/components/media/MediaImage";
import { defaultAltText } from "@/lib/media-tokens";

export type MediaGalleryItem = {
  id: string;
  imageUrl: string;
  altText?: string | null;
  caption?: string | null;
  credit?: string | null;
  imageType?: string | null;
  role?: string | null;
  focalX?: number | null;
  focalY?: number | null;
};

export function MediaGallery({
  items,
  playerName,
  title = "Gallery",
}: {
  items: MediaGalleryItem[];
  playerName: string;
  title?: string;
}) {
  if (!items.length) return null;

  return (
    <section className="pr-media-gallery" aria-labelledby="pr-media-gallery-heading">
      <h2 id="pr-media-gallery-heading" className="pr-media-gallery__title">
        {title}
      </h2>
      <ul className="pr-media-gallery__grid">
        {items.map((item) => (
          <li key={item.id} className="pr-media-gallery__item">
            <figure className="pr-media-gallery__figure">
              <MediaImage
                src={item.imageUrl}
                alt={item.altText?.trim() || defaultAltText(playerName, item.imageType ?? "photo")}
                width={640}
                height={360}
                aspect="landscape"
                sizes="(max-width: 768px) 90vw, 320px"
                focalX={item.focalX}
                focalY={item.focalY}
                className="pr-media-gallery__img"
              />
              {(item.caption || item.credit || item.role) && (
                <figcaption className="pr-media-gallery__caption">
                  {item.caption ? <span>{item.caption}</span> : null}
                  {item.credit ? (
                    <span className="pr-media-gallery__credit">{item.credit}</span>
                  ) : null}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
