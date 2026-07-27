"use client";

import { MediaImage } from "@/components/media/MediaImage";
import { defaultAltText } from "@/lib/media-tokens";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

const SIZE_PX = { xs: 18, sm: 22, md: 32, lg: 44 } as const;

/**
 * Team crest — Planet Rugby circular badge.
 * Sized via a fixed wrapper so MediaImage's 100% fill cannot blow up the layout.
 */
export function TeamCrest({
  name,
  imageUrl,
  size = "md",
  labelled = false,
}: {
  name: string;
  imageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  /** When true, crest is meaningful alone and gets an alt name. */
  labelled?: boolean;
}) {
  const px = SIZE_PX[size];
  const initials = teamInitials(name);
  const className = `pr-team-crest pr-team-crest--${size}`;

  if (imageUrl) {
    return (
      <span className={className} style={{ width: px, height: px }}>
        <MediaImage
          src={imageUrl}
          alt={labelled ? `${name} crest` : ""}
          decorative={!labelled}
          width={px}
          height={px}
          objectFit="contain"
          sizes={`${px}px`}
          fallback={
            <span className="pr-team-crest__fallback" aria-hidden>
              {initials}
            </span>
          }
        />
      </span>
    );
  }

  return (
    <span
      className={`${className} pr-team-crest--placeholder`}
      style={{ width: px, height: px }}
      aria-hidden={!labelled}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? `${name} crest` : undefined}
    >
      {initials}
    </span>
  );
}

export { defaultAltText };
